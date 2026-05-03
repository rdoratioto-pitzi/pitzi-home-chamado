// worker/src/routes/tickets.ts
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
import { extractMentions } from "../lib/sanitize-rich-text";
import {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendTicketStatusChangedEmail,
  sendTicketCommentEmail,
  sendMentionNotificationEmail,
  sendCSATReceivedEmail,
} from "../lib/email";

const tickets = new Hono<AppEnv>();

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
  const allTickets = await storage.getTickets();
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
    const allTickets = await storage.getTickets();
    return c.json(allTickets);
  }
  const userTickets = await storage.getTickets({
    requesterId: user.userId,
    assigneeId: user.userId,
  });
  return c.json(userTickets);
});

// GET /api/tickets/:id
tickets.get("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const ticket = await storage.getTicket(c.req.param("id"));
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Ticket not found" }, 404);
  }
  return c.json(ticket);
});

// POST /api/tickets
tickets.post("/api/tickets", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const body = await c.req.json();
  const data = { ...body };

  if (user.role !== "admin" || !data.requesterId) {
    data.requesterId = user.userId;
  }

  if (!isValidApplicationKey(data.applicationKey)) {
    return c.json({ error: "Aplicação é obrigatória e deve ser válida" }, 400);
  }

  const validated = insertTicketSchema.parse(data);

  // Auto-assignment
  if (!validated.assigneeId && validated.category && validated.type) {
    const autoAssignee = await storage.findResponsavelForTicket(
      validated.category,
      validated.type
    );
    if (autoAssignee) validated.assigneeId = autoAssignee;
  }

  const ticket = await storage.createTicket(validated);
  const requester = await storage.getUser(ticket.requesterId);
  const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

  // Emails (fire-and-forget)
  if (requester) {
    sendTicketCreatedEmail(env, storage, ticket, requester, assignee || null).catch(
      console.error
    );
  }
  if (assignee && assignee.id !== ticket.requesterId) {
    sendTicketAssignedEmail(env, storage, ticket, assignee).catch(console.error);
  }

  // Notification
  if (ticket.assigneeId && ticket.assigneeId !== ticket.requesterId) {
    storage
      .createNotification({
        userId: ticket.assigneeId,
        fromUserId: ticket.requesterId,
        title: "Novo chamado atribuído",
        message: `O chamado "${ticket.title}" (${ticket.code}) foi criado e atribuído a você`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados?ticket=${ticket.id}`,
      })
      .catch(console.error);
  }

  return c.json(ticket, 201);
});

// PATCH /api/tickets/:id
tickets.patch("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const oldTicket = await storage.getTicket(id);
  if (!oldTicket) return c.json({ error: "Ticket not found" }, 404);

  if (
    user.role !== "admin" &&
    oldTicket.requesterId !== user.userId &&
    oldTicket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  let updateData: any = { ...body };

  if (updateData.applicationKey !== undefined && updateData.applicationKey !== null) {
    if (!isValidApplicationKey(updateData.applicationKey)) {
      return c.json({ error: "Aplicação inválida" }, 400);
    }
  }

  // Non-admin field restriction
  if (user.role !== "admin") {
    const allowedFields = [
      "status", "title", "description", "attachments",
      "applicationKey", "impact", "dueDate",
    ];
    const filteredData: any = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) filteredData[field] = updateData[field];
    });
    updateData = filteredData;
  }

  // Status transitions
  if (body.status && body.status !== oldTicket.status) {
    const finalAssigneeId = body.assigneeId || oldTicket.assigneeId;
    if (!finalAssigneeId && ["resolved", "closed", "blocked"].includes(body.status)) {
      return c.json(
        {
          error:
            "Não é possível alterar o status para '" +
            (body.status === "resolved"
              ? "Resolvido"
              : body.status === "closed"
                ? "Fechado"
                : "Bloqueado") +
            "' sem um responsável atribuído ao chamado.",
        },
        400
      );
    }
    if (body.status === "resolved" && !oldTicket.dataResolucao) {
      updateData.dataResolucao = new Date();
    }
    if (body.status === "closed" && !oldTicket.dataFechamento) {
      updateData.dataFechamento = new Date();
    }
  }

  if (updateData.descriptionLastEditedAt) {
    updateData.descriptionLastEditedAt = new Date(updateData.descriptionLastEditedAt);
  }

  const ticket = await storage.updateTicket(id, updateData);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);

  // Status change email + notification
  if (body.status && body.status !== oldTicket.status) {
    const requester = await storage.getUser(ticket.requesterId);
    const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;
    if (requester) {
      sendTicketStatusChangedEmail(
        env, storage, ticket, oldTicket.status, body.status, requester, assignee || null
      ).catch(console.error);
    }
    const statusLabels: Record<string, string> = {
      open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido",
      closed: "Fechado", pending: "Pendente",
    };
    if (ticket.requesterId) {
      storage.createNotification({
        userId: ticket.requesterId,
        title: "Status do chamado alterado",
        message: `O chamado "${ticket.title}" (${ticket.code || ""}) mudou para "${statusLabels[body.status] || body.status}"`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados?ticket=${ticket.id}`,
      }).catch(console.error);
    }
  }

  // Assignee change email + notification
  if (body.assigneeId && body.assigneeId !== oldTicket.assigneeId) {
    const assignee = await storage.getUser(body.assigneeId);
    if (assignee) {
      sendTicketAssignedEmail(env, storage, ticket, assignee).catch(console.error);
    }
    storage.createNotification({
      userId: body.assigneeId,
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
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
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
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const comments = await storage.getTicketComments(id);
  return c.json(comments);
});

// POST /api/tickets/:id/comments
tickets.post("/api/tickets/:id/comments", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);

  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const validated = insertTicketCommentSchema.parse({
    ...body,
    ticketId: id,
    userId: user.userId,
    mentions: extractMentions(body?.content),
  });
  const comment = await storage.createTicketComment(validated);

  // First response tracking
  if (
    ticket.assigneeId &&
    comment.userId === ticket.assigneeId &&
    !ticket.dataPrimeiraResposta
  ) {
    await storage.updateTicket(ticket.id, { dataPrimeiraResposta: new Date() });
  }

  const commenter = await storage.getUser(comment.userId);
  const requester = await storage.getUser(ticket.requesterId);
  const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

  // Comment email
  if (commenter && requester) {
    sendTicketCommentEmail(env, storage, ticket, comment, commenter, requester, assignee || null).catch(
      console.error
    );
  }

  // Notifications for requester and assignee
  if (requester && commenter && commenter.id !== requester.id) {
    storage.createNotification({
      userId: requester.id,
      fromUserId: commenter.id,
      title: "Novo comentário no chamado",
      message: `${commenter.name} comentou no chamado "${ticket.title}"`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }
  if (
    assignee &&
    commenter &&
    commenter.id !== assignee.id &&
    assignee.id !== requester?.id
  ) {
    storage.createNotification({
      userId: assignee.id,
      fromUserId: commenter.id,
      title: "Novo comentário no chamado",
      message: `${commenter.name} comentou no chamado "${ticket.title}"`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }

  // Mention handling
  const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
  if (mentionMatches) {
    const users = await storage.getUsers();
    for (const mention of mentionMatches) {
      const mentionedName = mention.slice(1).trim();
      const mentionedUser = users.find(
        (u) =>
          u.name.toLowerCase() === mentionedName.toLowerCase() &&
          u.status === "active"
      );
      if (mentionedUser && commenter) {
        sendMentionNotificationEmail(
          env, storage, mentionedUser, commenter.name, ticket.title, ticket.id, validated.content
        ).catch(console.error);
        storage.createNotification({
          userId: mentionedUser.id,
          fromUserId: commenter.id,
          title: "Menção em chamado",
          message: `${commenter.name} mencionou você em um comentário no chamado "${ticket.title}"`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }
    }
  }

  return c.json(comment, 201);
});

// ============== TICKET RESPONSÁVEIS ==============

// GET /api/ticket-responsaveis
tickets.get("/api/ticket-responsaveis", async (c) => {
  const storage = getStorage(c.get("db"));
  return c.json(await storage.getTicketResponsaveis());
});

// GET /api/ticket-responsaveis/:id
tickets.get("/api/ticket-responsaveis/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const responsavel = await storage.getTicketResponsavel(c.req.param("id"));
  if (!responsavel) return c.json({ error: "Responsavel not found" }, 404);
  return c.json(responsavel);
});

// POST /api/ticket-responsaveis (admin only)
tickets.post("/api/ticket-responsaveis", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertTicketResponsavelSchema.parse(body);
  const responsavel = await storage.createTicketResponsavel(validated);
  return c.json(responsavel, 201);
});

// PATCH /api/ticket-responsaveis/:id (admin only)
tickets.patch("/api/ticket-responsaveis/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertTicketResponsavelSchema.partial().parse(body);
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
  const deleted = await storage.deleteTicketResponsavel(c.req.param("id"));
  if (!deleted) return c.json({ error: "Responsavel not found" }, 404);
  return c.body(null, 204);
});

// GET /api/ticket-responsaveis/find/:categoria/:tipo
tickets.get("/api/ticket-responsaveis/find/:categoria/:tipo", async (c) => {
  const storage = getStorage(c.get("db"));
  const responsavelId = await storage.findResponsavelForTicket(
    c.req.param("categoria"),
    c.req.param("tipo")
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

  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
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
      sendCSATReceivedEmail(env, storage, updatedTicket, rating, comment || null, assignee).catch(
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
