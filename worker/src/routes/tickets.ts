// worker/src/routes/tickets.ts
import { sendCommentToSlackThread } from "../lib/slack-thread-sync";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import {
  insertTicketSchema,
  insertTicketResponsavelSchema,
  insertTicketCommentSchema,
} from "../../../shared/schema";
import { isValidApplicationKey } from "../../../shared/applications";
import { sameTenant } from "../../../shared/tenant";
import { filterVisibleComments, resolveIsInternal } from "../../../shared/ticket-comments";
import {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendTicketStatusChangedEmail,
  sendTicketCommentEmail,
  sendMentionNotificationEmail,
  sendCSATReceivedEmail,
} from "../lib/email";
import { runTicketCommentEffects } from "../lib/ticket-comment-effects";
import { notifyRequesterOfTeamChanges } from "../lib/ticket-update-email";
import { ticketStatusLabel } from "../../../shared/ticket-options";
import { mailContext } from "../lib/mailer";
import { createTicketFor } from "../lib/create-ticket";
import { slaPauseUpdate } from "../../../shared/sla";
import { normalizeRequestSelection } from "../../../shared/request-objects";
import { checkRequestSelection, resolveCustomFieldValues } from "../../../server/services/ticket-fields.service";
import { runTicketAutomations } from "../../../server/services/automations.service";
import { isTicketGroupMember } from "../../../server/services/ticket-queue.service";
import { isTechnicianUserId } from "../../../server/services/user-type.service";
import { canBeAssignee, isTechnician, TECHNICIAN_REQUIRED_ERROR } from "../../../shared/user-type";
import { mentionRecipients, mentionsToStore, resolveMentions } from "../../../server/services/mentions.service";
import type { Ticket } from "../../../shared/schema";
import { REQUESTER_EDITABLE_TICKET_FIELDS } from "../../../shared/requester-view";

const tickets = new Hono<AppEnv>();

type AuthUser = { userId: string; role?: string; tenantId?: string | null };

/**
 * Quem pode ver/comentar o chamado e o que vê nos comentários: admin, solicitante,
 * responsável, membro do grupo ou quem foi mencionado (@) em algum comentário. Técnico
 * mencionado também vê notas internas; Usuário mencionado só os comentários públicos.
 */
async function ticketCommentAccess(storage: ReturnType<typeof getStorage>, user: AuthUser, ticket: Ticket) {
  const isAdmin = user.role === "admin";
  const isParty = ticket.requesterId === user.userId || ticket.assigneeId === user.userId;
  const isGroupMember = !isAdmin && !isParty &&
    (await isTicketGroupMember(storage, { userId: user.userId, isAdmin: false, tenantId: user.tenantId ?? null }, ticket));
  const isMentioned = !isAdmin && !isParty && !isGroupMember &&
    (await storage.isUserMentionedInTicket(ticket.id, user.userId));
  const isMentionedTechnician = isMentioned && isTechnician(await storage.getUser(user.userId));
  return {
    allowed: isAdmin || isParty || isGroupMember || isMentioned,
    viewer: { userId: user.userId, isAdmin, isGroupMember, isMentionedTechnician },
  };
}

// IMPORTANT: Static paths MUST be registered BEFORE parameterized paths
// to avoid Hono matching "csat" as an :id parameter.

// GET /api/tickets/csat/analytics (admin only, checked in-route)
// Registered before /api/tickets/:id to avoid route shadowing
tickets.get("/api/tickets/csat/analytics", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") {
    return c.json({ error: "Apenas administradores podem acessar analytics" }, 403);
  }

  const storage = getStorage(c.get("db"));
  const allTickets = await storage.getTickets({ tenantId: user.tenantId });
  const users = await storage.getUsers();

  const ticketsWithCSAT = allTickets.filter(
    (t) => t.satisfactionRating !== null && t.satisfactionRating !== undefined
  );

  const totalTickets = allTickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  ).length;
  const totalEvaluations = ticketsWithCSAT.length;
  const evaluationRate =
    totalTickets > 0 ? (totalEvaluations / totalTickets) * 100 : 0;
  const averageRating =
    ticketsWithCSAT.length > 0
      ? ticketsWithCSAT.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) /
        ticketsWithCSAT.length
      : 0;

  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ticketsWithCSAT.filter((t) => t.satisfactionRating === rating).length,
    percentage:
      ticketsWithCSAT.length > 0
        ? (ticketsWithCSAT.filter((t) => t.satisfactionRating === rating).length /
            ticketsWithCSAT.length) *
          100
        : 0,
  }));

  const responsibleStats = users
    .map((u) => {
      const uTickets = ticketsWithCSAT.filter((t) => t.assigneeId === u.id);
      const avg =
        uTickets.length > 0
          ? uTickets.reduce((s, t) => s + (t.satisfactionRating || 0), 0) /
            uTickets.length
          : 0;
      return {
        userId: u.id,
        userName: u.name,
        totalEvaluations: uTickets.length,
        averageRating: Math.round(avg * 10) / 10,
        ratings: [1, 2, 3, 4, 5].map(
          (r) => uTickets.filter((t) => t.satisfactionRating === r).length
        ),
      };
    })
    .filter((s) => s.totalEvaluations > 0)
    .sort((a, b) => b.averageRating - a.averageRating);

  const negativeComments = ticketsWithCSAT
    .filter((t) => (t.satisfactionRating || 0) <= 2 && t.satisfactionComment)
    .map((t) => ({
      ticketId: t.id,
      ticketCode: t.code,
      ticketTitle: t.title,
      rating: t.satisfactionRating,
      comment: t.satisfactionComment,
      createdAt: t.satisfactionCreatedAt,
      assigneeId: t.assigneeId,
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 10);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentEvaluations = ticketsWithCSAT
    .filter(
      (t) =>
        t.satisfactionCreatedAt &&
        new Date(t.satisfactionCreatedAt) >= thirtyDaysAgo
    )
    .sort(
      (a, b) =>
        new Date(a.satisfactionCreatedAt || 0).getTime() -
        new Date(b.satisfactionCreatedAt || 0).getTime()
    );

  const trendByDay: Record<string, { sum: number; count: number }> = {};
  recentEvaluations.forEach((t) => {
    const day = t.satisfactionCreatedAt
      ? new Date(t.satisfactionCreatedAt).toISOString().split("T")[0]
      : "unknown";
    if (!trendByDay[day]) trendByDay[day] = { sum: 0, count: 0 };
    trendByDay[day].sum += t.satisfactionRating || 0;
    trendByDay[day].count++;
  });
  const trend = Object.entries(trendByDay)
    .map(([date, data]) => ({
      date,
      rating: Math.round((data.sum / data.count) * 10) / 10,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return c.json({
    overview: {
      totalTickets,
      totalEvaluations,
      evaluationRate: Math.round(evaluationRate * 100) / 100,
      averageRating: Math.round(averageRating * 100) / 100,
    },
    ratingDistribution,
    topResponsibles: responsibleStats.slice(0, 5),
    negativeComments,
    trend,
  });
});

// GET /api/tickets
tickets.get("/api/tickets", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));

  if (user.role === "admin") {
    const allTickets = await storage.getTickets({ tenantId: user.tenantId });
    return c.json(allTickets);
  }
  const userTickets = await storage.getTickets({
    requesterId: user.userId,
    assigneeId: user.userId,
    tenantId: user.tenantId,
  });
  return c.json(userTickets);
});

// GET /api/tickets/:id
tickets.get("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const ticket = await storage.getTicket(c.req.param("id"));
  if (!ticket || !sameTenant(ticket.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);
  if (!(await ticketCommentAccess(storage, user, ticket)).allowed) {
    return c.json({ error: "Ticket not found" }, 404);
  }
  return c.json(ticket);
});

// POST /api/tickets
tickets.post("/api/tickets", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const result = await createTicketFor(storage, mailContext(c), {
    userId: user.userId, isAdmin: user.role === "admin", tenantId: user.tenantId ?? null,
  }, body ?? {});
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.ticket, 201);
});

// PATCH /api/tickets/:id
tickets.patch("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const oldTicket = await storage.getTicket(id);
  if (!oldTicket || !sameTenant(oldTicket.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);

  if (
    user.role !== "admin" &&
    oldTicket.requesterId !== user.userId &&
    oldTicket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  // Campos de identidade e escopo não são alteráveis pela API.
  const { id: _id, code: _code, tenantId: _tenantId, createdAt: _createdAt, ...editable } = body ?? {};
  let updateData: any = { ...editable };

  if (updateData.applicationKey !== undefined && updateData.applicationKey !== null) {
    if (!isValidApplicationKey(updateData.applicationKey)) {
      return c.json({ error: "Aplicação inválida" }, 400);
    }
  }

  // Só confere o grupo quando ele muda: chamados antigos de grupos desativados continuam editáveis.
  if (
    updateData.category !== undefined &&
    updateData.category !== oldTicket.category &&
    !(await storage.getActiveSupportGroupByKey(updateData.category))
  ) {
    return c.json({ error: "Grupo de atendimento inválido" }, 400);
  }

  if (["requestObject", "requestAction", "requestDetail"].some((k) => updateData[k] !== undefined)) {
    normalizeRequestSelection(updateData);
    const merged = {
      requestObject: updateData.requestObject !== undefined ? updateData.requestObject : oldTicket.requestObject,
      requestAction: updateData.requestAction !== undefined ? updateData.requestAction : oldTicket.requestAction,
      requestDetail: updateData.requestDetail !== undefined ? updateData.requestDetail : oldTicket.requestDetail,
    };
    // Só valida quando muda: valores antigos seguem válidos depois de a lista ser editada.
    if (!(await checkRequestSelection(storage, merged, oldTicket))) {
      return c.json({ error: "Objeto da Requisição inválido" }, 400);
    }
  }

  // Non-admin field restriction. Quem não é técnico (solicitante "Usuário") só edita
  // título, descrição e anexos: status, gravidade, grupo e campos do atendimento ficam com a equipe.
  if (user.role !== "admin") {
    const allowedFields = (await isTechnicianUserId(storage, user.userId))
      ? [
          "status", "title", "description", "attachments",
          "applicationKey", "impact", "dueDate",
          "requestObject", "requestAction", "requestDetail", "customFields",
        ]
      : [...REQUESTER_EDITABLE_TICKET_FIELDS];
    const filteredData: any = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) filteredData[field] = updateData[field];
    });
    updateData = filteredData;
  }

  // Campos personalizados: mescla com o que já estava gravado; obrigatórios só se o grupo mudar.
  {
    const groupKey = updateData.category ?? oldTicket.category;
    const custom = await resolveCustomFieldValues(storage, {
      incoming: updateData.customFields,
      groupKey,
      previous: oldTicket.customFields,
      groupChanged: groupKey !== oldTicket.category,
    });
    if (!custom.ok) return c.json({ error: custom.error }, custom.status);
    if (custom.values !== undefined) updateData.customFields = custom.values;
    else delete updateData.customFields;
  }

  // Novo responsável precisa ser técnico (o atual continua válido mesmo que tenha mudado de tipo).
  if (
    updateData.assigneeId &&
    updateData.assigneeId !== oldTicket.assigneeId &&
    !(await isTechnicianUserId(storage, updateData.assigneeId))
  ) {
    return c.json({ error: TECHNICIAN_REQUIRED_ERROR }, 400);
  }

  // Status transitions
  if (updateData.status && updateData.status !== oldTicket.status) {
    const finalAssigneeId = updateData.assigneeId || oldTicket.assigneeId;
    if (!finalAssigneeId && ["resolved", "closed", "blocked"].includes(updateData.status)) {
      return c.json(
        {
          error:
            "Não é possível alterar o status para '" +
            (updateData.status === "resolved"
              ? "Resolvido"
              : updateData.status === "closed"
                ? "Fechado"
                : "Bloqueado") +
            "' sem um responsável atribuído ao chamado.",
        },
        400
      );
    }
    if (updateData.status === "resolved" && !oldTicket.dataResolucao) {
      updateData.dataResolucao = new Date();
    }
    if (updateData.status === "closed" && !oldTicket.dataFechamento) {
      updateData.dataFechamento = new Date();
    }
    // "Aguardando solicitante" para o relógio de resolução do SLA.
    Object.assign(updateData, slaPauseUpdate(oldTicket, updateData.status));
  }

  if (updateData.descriptionLastEditedAt) {
    updateData.descriptionLastEditedAt = new Date(updateData.descriptionLastEditedAt);
  }

  const saved = await storage.updateTicket(id, updateData);
  if (!saved || !sameTenant(saved.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);
  const statusChanged = !!updateData.status && updateData.status !== oldTicket.status;
  const ticket = statusChanged
    ? await runTicketAutomations(storage, "status_changed", saved, { actorId: user.userId, newStatus: updateData.status })
    : saved;

  // Grupo ou título mudados pela equipe: e-mail ao solicitante (evento ticket_updated).
  await notifyRequesterOfTeamChanges(mailContext(c), storage, oldTicket, ticket, user.userId);

  // Status change email + notification
  if (updateData.status && updateData.status !== oldTicket.status) {
    const requester = await storage.getUser(ticket.requesterId);
    const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;
    if (requester) {
      sendTicketStatusChangedEmail(
        mailContext(c), storage, ticket, oldTicket.status, updateData.status, requester, assignee || null
      ).catch(console.error);
    }
    if (ticket.requesterId) {
      storage.createNotification({
        userId: ticket.requesterId,
        title: "Status do chamado alterado",
        message: `O chamado "${ticket.title}" (${ticket.code || ""}) mudou para "${ticketStatusLabel(updateData.status)}"`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados?ticket=${ticket.id}`,
      }).catch(console.error);
    }
  }

  // Assignee change email + notification
  if (updateData.assigneeId && updateData.assigneeId !== oldTicket.assigneeId) {
    const assignee = await storage.getUser(updateData.assigneeId);
    if (assignee) {
      sendTicketAssignedEmail(mailContext(c), storage, ticket, assignee).catch(console.error);
    }
    storage.createNotification({
      userId: updateData.assigneeId,
      title: "Chamado atribuído a você",
      message: `O chamado "${ticket.title}" (${ticket.code || ""}) foi atribuído a você`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }

  return c.json(ticket);
});

// DELETE /api/tickets/:id
tickets.delete("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket || !sameTenant(ticket.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);
  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteTicket(id);
  if (!deleted) return c.json({ error: "Ticket not found" }, 404);
  return c.body(null, 204);
});

// GET /api/tickets/:id/comments
tickets.get("/api/tickets/:id/comments", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket || !sameTenant(ticket.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);
  const { allowed, viewer } = await ticketCommentAccess(storage, user, ticket);
  if (!allowed) return c.json({ error: "Access denied" }, 403);
  const comments = await storage.getTicketComments(id);
  return c.json(filterVisibleComments(comments, viewer, ticket));
});

// POST /api/tickets/:id/comments
tickets.post("/api/tickets/:id/comments", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket || !sameTenant(ticket.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);

  // Membros do grupo e mencionados também comentam; notas internas só quem pode vê-las.
  const { allowed, viewer } = await ticketCommentAccess(storage, user, ticket);
  if (!allowed) return c.json({ error: "Access denied" }, 403);

  const body = await c.req.json();
  const wantsInternal = resolveIsInternal(body?.isInternal, viewer, ticket);
  const mentions = await mentionsToStore(
    storage, await resolveMentions(storage, body?.content, ticket.tenantId), wantsInternal,
  );
  const validated = insertTicketCommentSchema.parse({
    ...body,
    ticketId: id,
    userId: user.userId,
    tenantId: ticket.tenantId,
    // Origem e id do Gmail só são gravados pelo processador de respostas por e-mail.
    source: "app",
    inboundEmailId: null,
    slackMessageKey: null,
    isInternal: wantsInternal,
    mentions,
  });
  const comment = await storage.createTicketComment(validated);
  const slackWork = sendCommentToSlackThread(c.env, ticket, comment).catch((error) => console.error("[slack-thread] outbound", error));
  try { c.executionCtx.waitUntil(slackWork); } catch { await slackWork; }
  const isInternal = comment.isInternal === true;
  const { commenter } = await runTicketCommentEffects(mailContext(c), storage, ticket, comment);

  // Menções: avisa quem foi acionado (e-mail na conversa do chamado + sino). Nunca o autor;
  // em nota interna, só técnicos.
  if (commenter) {
    const mentioned = await mentionRecipients(storage, mentions, user.userId, isInternal);
    for (const mentionedUser of mentioned) {
      sendMentionNotificationEmail(
        mailContext(c), storage, mentionedUser, commenter.name, ticket.title, ticket.id, validated.content, ticket
      ).catch(console.error);
      storage.createNotification({
        userId: mentionedUser.id,
        fromUserId: commenter.id,
        title: "Menção em chamado",
        message: `${commenter.name} mencionou você no chamado ${ticket.code} "${ticket.title}"`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados/${ticket.id}`,
      }).catch(console.error);
    }
  }

  return c.json(comment, 201);
});

// ============== TICKET RESPONSÁVEIS ==============

// GET /api/ticket-responsaveis
tickets.get("/api/ticket-responsaveis", async (c) => {
  const storage = getStorage(c.get("db"));
  return c.json(await storage.getTicketResponsaveis(c.get("user").tenantId ?? null));
});

/** Regra de responsável do tenant do usuário, ou undefined (404 para os demais). */
async function findTenantResponsavel(c: { get: (k: "user" | "db") => any }, id: string) {
  const responsavel = await getStorage(c.get("db")).getTicketResponsavel(id);
  return responsavel && sameTenant(responsavel.tenantId, c.get("user").tenantId) ? responsavel : undefined;
}

async function isValidResponsavelRule(c: { get: (k: "user" | "db") => any }, data: { categoria?: string; usuarioResponsavelId?: string }) {
  const storage = getStorage(c.get("db"));
  if (data.categoria !== undefined && !(await storage.getActiveSupportGroupByKey(data.categoria))) return false;
  if (data.usuarioResponsavelId !== undefined) {
    const target = await storage.getUser(data.usuarioResponsavelId);
    if (!target || !sameTenant(target.tenantId, c.get("user").tenantId) || !canBeAssignee(target)) return false;
  }
  return true;
}

// GET /api/ticket-responsaveis/:id
tickets.get("/api/ticket-responsaveis/:id", async (c) => {
  const responsavel = await findTenantResponsavel(c, c.req.param("id"));
  if (!responsavel) return c.json({ error: "Responsavel not found" }, 404);
  return c.json(responsavel);
});

// POST /api/ticket-responsaveis (admin only)
tickets.post("/api/ticket-responsaveis", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const { tenantId: _tenantId, ...fields } = body ?? {};
  const validated = insertTicketResponsavelSchema.parse(fields);
  if (!(await isValidResponsavelRule(c, validated))) {
    return c.json({ error: "Grupo inválido ou responsável não é técnico" }, 400);
  }
  const responsavel = await storage.createTicketResponsavel({ ...validated, tenantId: c.get("user").tenantId ?? null });
  return c.json(responsavel, 201);
});

// PATCH /api/ticket-responsaveis/:id (admin only)
tickets.patch("/api/ticket-responsaveis/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const { tenantId: _tenantId, ...fields } = body ?? {};
  const validated = insertTicketResponsavelSchema.partial().parse(fields);
  if (!(await findTenantResponsavel(c, c.req.param("id")))) {
    return c.json({ error: "Responsavel not found" }, 404);
  }
  if (!(await isValidResponsavelRule(c, validated))) {
    return c.json({ error: "Grupo inválido ou responsável não é técnico" }, 400);
  }
  const responsavel = await storage.updateTicketResponsavel(
    c.req.param("id"),
    validated
  );
  if (!responsavel) return c.json({ error: "Responsavel not found" }, 404);
  return c.json(responsavel);
});

// DELETE /api/ticket-responsaveis/:id (admin only)
tickets.delete("/api/ticket-responsaveis/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  if (!(await findTenantResponsavel(c, c.req.param("id")))) {
    return c.json({ error: "Responsavel not found" }, 404);
  }
  const deleted = await storage.deleteTicketResponsavel(c.req.param("id"));
  if (!deleted) return c.json({ error: "Responsavel not found" }, 404);
  return c.body(null, 204);
});

// GET /api/ticket-responsaveis/find/:categoria/:tipo
tickets.get("/api/ticket-responsaveis/find/:categoria/:tipo", async (c) => {
  const storage = getStorage(c.get("db"));
  const responsavelId = await storage.findResponsavelForTicket(
    c.req.param("categoria"),
    c.req.param("tipo"),
    c.get("user").tenantId ?? null,
  );
  return c.json({ responsavelId });
});

// ============== CSAT — Satisfaction Rating ==============

// PATCH /api/tickets/:id/satisfaction
tickets.patch("/api/tickets/:id/satisfaction", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);

  if (!ticket || !sameTenant(ticket.tenantId, user.tenantId)) return c.json({ error: "Ticket not found" }, 404);
  if (ticket.requesterId !== user.userId) {
    return c.json({ error: "Apenas o solicitante pode avaliar este chamado" }, 403);
  }
  if (ticket.status !== "closed" && ticket.status !== "resolved") {
    return c.json(
      { error: "Apenas chamados fechados ou resolvidos podem ser avaliados" },
      400
    );
  }
  if (ticket.satisfactionRating !== null && ticket.satisfactionRating !== undefined) {
    return c.json({ error: "Este chamado já foi avaliado" }, 400);
  }

  const { rating, comment } = await c.req.json();
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return c.json(
      { error: "Rating deve ser um número inteiro entre 1 e 5" },
      400
    );
  }
  if (comment && comment.length > 500) {
    return c.json(
      { error: "Comentário deve ter no máximo 500 caracteres" },
      400
    );
  }

  const updatedTicket = await storage.updateTicket(id, {
    satisfactionRating: rating,
    satisfactionComment: comment || null,
    satisfactionCreatedAt: new Date(),
  });
  if (!updatedTicket) return c.json({ error: "Ticket not found after update" }, 404);

  // CSAT email to assignee
  if (updatedTicket.assigneeId) {
    const assignee = await storage.getUser(updatedTicket.assigneeId);
    if (assignee) {
      sendCSATReceivedEmail(mailContext(c), storage, updatedTicket, rating, comment || null, assignee).catch(
        console.error
      );
    }
  }

  // In-app notification
  if (updatedTicket.assigneeId && updatedTicket.assigneeId !== user.userId) {
    const starsText =
      rating === 5 ? "⭐⭐⭐⭐⭐" : rating === 4 ? "⭐⭐⭐⭐" : rating === 3 ? "⭐⭐⭐" : rating === 2 ? "⭐⭐" : "⭐";
    storage.createNotification({
      userId: updatedTicket.assigneeId,
      fromUserId: user.userId,
      title: "Avaliação de chamado recebida",
      message: `Seu atendimento no chamado "${ticket.title}" foi avaliado com ${starsText} (${rating}/5)`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }

  return c.json(updatedTicket);
});

export { tickets };
