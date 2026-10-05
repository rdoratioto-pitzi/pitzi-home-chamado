// Efeitos de um comentário novo no chamado — os mesmos para o comentário feito na tela
// (POST /api/tickets/:id/comments) e para a resposta recebida por e-mail
// (worker/src/lib/inbound-email.ts): primeira resposta (SLA), e-mail para a outra parte e
// avisos no sino. Menções ficam na rota (só existem no editor da tela).
import type { Ticket, TicketComment, User } from "../../../shared/schema";
import type { IStorage } from "./storage";
import { sendTicketCommentEmail } from "./email";
import type { MailContext } from "./mailer";

export async function runTicketCommentEffects(
  ctx: MailContext,
  storage: IStorage,
  ticket: Ticket,
  comment: TicketComment,
): Promise<{ commenter: User | undefined; requester: User | undefined; assignee: User | null }> {
  const isInternal = comment.isInternal === true;

  // Primeira resposta: comentário público de quem não é o solicitante (nota interna não conta).
  if (!isInternal && comment.userId !== ticket.requesterId && !ticket.dataPrimeiraResposta) {
    await storage.updateTicket(ticket.id, { dataPrimeiraResposta: new Date() });
  }

  const commenter = await storage.getUser(comment.userId);
  const requester = await storage.getUser(ticket.requesterId);
  const assignee = ticket.assigneeId ? (await storage.getUser(ticket.assigneeId)) ?? null : null;

  if (commenter && requester) {
    sendTicketCommentEmail(ctx, storage, ticket, comment, commenter, requester, assignee).catch(console.error);
  }

  if (!isInternal && requester && commenter && commenter.id !== requester.id) {
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
  if (assignee && commenter && commenter.id !== assignee.id && assignee.id !== requester?.id) {
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
  return { commenter, requester, assignee };
}
