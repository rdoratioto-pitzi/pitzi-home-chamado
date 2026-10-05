// Avisa o solicitante quando a equipe muda o grupo ou o título do chamado
// (PATCH /api/tickets/:id e PATCH /api/workspace/chamados/:id).
import type { Ticket } from "../../../shared/schema";
import { describeTeamChanges } from "../../../shared/ticket-changes";
import type { IStorage } from "./storage";
import { sendTicketUpdatedEmail } from "./email";
import type { MailContext } from "./mailer";

export async function notifyRequesterOfTeamChanges(
  ctx: MailContext,
  storage: IStorage,
  before: Ticket,
  after: Ticket,
  actorId: string,
): Promise<void> {
  if (before.category === after.category && before.title === after.title) return;
  // O aviso nunca pode derrubar a alteração do chamado.
  try {
    const groups = await storage.getSupportGroups(after.tenantId ?? null).catch(() => []);
    const names = new Map(groups.map((g) => [g.key, g.name]));
    const changes = describeTeamChanges(before, after, actorId, (key) => names.get(key) ?? key);
    if (!changes) return;
    const [requester, actor] = await Promise.all([storage.getUser(after.requesterId), storage.getUser(actorId)]);
    if (!requester) return;
    sendTicketUpdatedEmail(ctx, storage, after, changes, requester, actor ?? null).catch(console.error);
  } catch (error) {
    console.error("[email] aviso de alteração do chamado não enviado:", error);
  }
}
