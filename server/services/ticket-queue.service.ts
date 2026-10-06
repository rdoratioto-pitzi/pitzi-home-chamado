// Fila do grupo: assumir e transferir chamados. Usado pelo Worker e pelo Express;
// cada rota cuida só do e-mail, que tem implementação própria em cada backend.
import { z } from "zod";
import type { Ticket, User } from "../../shared/schema";
import { sameTenant } from "../../shared/tenant";
import { claimDenial, isGroupMember, transferDenial, type QueueViewer } from "../../shared/ticket-queue";
import type { IStorage } from "../storage";
import { isTechnician, TECHNICIAN_REQUIRED_ERROR } from "../../shared/user-type";
import { isTechnicianUserId } from "./user-type.service";

export interface QueueActor {
  userId: string;
  isAdmin: boolean;
  /** undefined = sem isolamento de tenant (Express local). */
  tenantId?: string | null;
}

export type QueueResult =
  | { ok: true; ticket: Ticket; newAssignee: User | null }
  | { ok: false; status: 400 | 403 | 404; error: string };

export const transferSchema = z.object({
  category: z.string().min(1),
  assigneeId: z.string().min(1).nullish(),
});

export async function getQueueViewer(storage: IStorage, actor: QueueActor): Promise<QueueViewer> {
  const groups = await storage.getSupportGroups(actor.tenantId ?? null);
  const user = actor.isAdmin ? undefined : await storage.getUser(actor.userId);
  return {
    userId: actor.userId,
    isAdmin: actor.isAdmin,
    groupKeys: groups.filter(g => g.memberIds.includes(actor.userId)).map(g => g.key),
    isTechnician: actor.isAdmin || isTechnician(user),
  };
}

async function loadTicket(storage: IStorage, actor: QueueActor, id: string): Promise<Ticket | null> {
  const ticket = await storage.getTicket(id);
  if (!ticket) return null;
  if (actor.tenantId !== undefined && !sameTenant(ticket.tenantId, actor.tenantId)) return null;
  return ticket;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

/** Registra a movimentação no histórico do chamado como nota interna. */
async function recordHistory(storage: IStorage, ticket: Ticket, actorId: string, text: string) {
  await storage.createTicketComment({
    ticketId: ticket.id,
    tenantId: ticket.tenantId,
    userId: actorId,
    content: `<p>${escapeHtml(text)}</p>`,
    isInternal: true,
    mentions: [],
  });
}

async function notifyAssignee(storage: IStorage, ticket: Ticket, assigneeId: string, actorId: string) {
  if (assigneeId === actorId) return;
  await storage.createNotification({
    userId: assigneeId,
    fromUserId: actorId,
    title: "Chamado atribuído a você",
    message: `O chamado "${ticket.title}" (${ticket.code || ""}) foi atribuído a você`,
    module: "chamados",
    entityId: ticket.id,
    linkUrl: `/chamados?ticket=${ticket.id}`,
  }).catch(console.error);
}

export async function claimTicket(storage: IStorage, actor: QueueActor, id: string): Promise<QueueResult> {
  const ticket = await loadTicket(storage, actor, id);
  if (!ticket) return { ok: false, status: 404, error: "Chamado não encontrado" };

  const viewer = await getQueueViewer(storage, actor);
  const denial = claimDenial(viewer, ticket);
  if (denial) return { ok: false, status: 403, error: denial };
  if (!(await isTechnicianUserId(storage, actor.userId))) {
    return { ok: false, status: 403, error: "Só técnicos podem assumir chamados" };
  }

  const updated = await storage.updateTicket(ticket.id, { assigneeId: actor.userId });
  if (!updated) return { ok: false, status: 404, error: "Chamado não encontrado" };

  const actorUser = await storage.getUser(actor.userId);
  await recordHistory(storage, updated, actor.userId, `Chamado assumido por ${actorUser?.name ?? "usuário"}.`);
  return { ok: true, ticket: updated, newAssignee: null };
}

export async function transferTicket(
  storage: IStorage,
  actor: QueueActor,
  id: string,
  body: unknown,
): Promise<QueueResult> {
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: "Informe o grupo de destino" };

  const ticket = await loadTicket(storage, actor, id);
  if (!ticket) return { ok: false, status: 404, error: "Chamado não encontrado" };

  const viewer = await getQueueViewer(storage, actor);
  const denial = transferDenial(viewer, ticket);
  if (denial) return { ok: false, status: 403, error: denial };

  // getSupportGroups só devolve grupos ativos: grupo desativado não recebe chamados.
  const groups = await storage.getSupportGroups(actor.tenantId ?? null);
  const target = groups.find(g => g.key === parsed.data.category);
  if (!target) return { ok: false, status: 400, error: "Grupo de atendimento inválido" };

  let assigneeId: string | null;
  if (parsed.data.assigneeId) {
    if (!target.memberIds.includes(parsed.data.assigneeId)) {
      return { ok: false, status: 400, error: "O responsável precisa ser membro do grupo de destino" };
    }
    if (parsed.data.assigneeId !== ticket.assigneeId && !(await isTechnicianUserId(storage, parsed.data.assigneeId))) {
      return { ok: false, status: 400, error: TECHNICIAN_REQUIRED_ERROR };
    }
    assigneeId = parsed.data.assigneeId;
  } else {
    // Sem responsável indicado: mantém o atual só se ele fizer parte do grupo de destino.
    assigneeId = ticket.assigneeId && target.memberIds.includes(ticket.assigneeId) ? ticket.assigneeId : null;
  }

  if (target.key === ticket.category && assigneeId === ticket.assigneeId) {
    return { ok: false, status: 400, error: "Escolha outro grupo ou outro responsável" };
  }

  const updated = await storage.updateTicket(ticket.id, { category: target.key, assigneeId });
  if (!updated) return { ok: false, status: 404, error: "Chamado não encontrado" };

  const fromGroup = groups.find(g => g.key === ticket.category)?.name ?? ticket.category;
  const [actorUser, newAssignee] = await Promise.all([
    storage.getUser(actor.userId),
    assigneeId && assigneeId !== ticket.assigneeId ? storage.getUser(assigneeId) : Promise.resolve(undefined),
  ]);
  const parts = [`Chamado transferido de ${fromGroup} para ${target.name} por ${actorUser?.name ?? "usuário"}`];
  if (newAssignee) parts.push(`responsável: ${newAssignee.name}`);
  else if (!assigneeId) parts.push("sem responsável");
  await recordHistory(storage, updated, actor.userId, `${parts.join(", ")}.`);

  if (newAssignee) await notifyAssignee(storage, updated, newAssignee.id, actor.userId);
  return { ok: true, ticket: updated, newAssignee: newAssignee && newAssignee.id !== actor.userId ? newAssignee : null };
}

/** Membros do grupo do chamado podem consultá-lo (e os comentários públicos) para decidir se assumem. */
export async function isTicketGroupMember(
  storage: IStorage,
  actor: QueueActor,
  ticket: Pick<Ticket, "category">,
): Promise<boolean> {
  return isGroupMember(await getQueueViewer(storage, actor), ticket);
}

/**
 * Mesma regra de GET /api/tickets/:id: admin, solicitante, responsável ou membro do grupo
 * do chamado, sempre no mesmo tenant. Usado por rotas que expõem dados do chamado por id.
 */
export async function canViewTicket(
  storage: IStorage,
  actor: QueueActor,
  ticket: (Pick<Ticket, "tenantId" | "requesterId" | "assigneeId" | "category"> & { id?: string }) | null | undefined,
): Promise<boolean> {
  if (!ticket) return false;
  if (actor.tenantId !== undefined && !sameTenant(ticket.tenantId, actor.tenantId)) return false;
  if (actor.isAdmin) return true;
  if (ticket.requesterId === actor.userId || ticket.assigneeId === actor.userId) return true;
  // Técnicos atendem qualquer chamado do tenant; a squad (grupo) organiza a fila, não restringe.
  if (isTechnician(await storage.getUser(actor.userId))) return true;
  if (await isTicketGroupMember(storage, actor, ticket)) return true;
  // Quem foi mencionado (@) em algum comentário foi acionado para ajudar e pode abrir o chamado.
  return "id" in ticket && typeof ticket.id === "string"
    ? storage.isUserMentionedInTicket(ticket.id, actor.userId)
    : false;
}
