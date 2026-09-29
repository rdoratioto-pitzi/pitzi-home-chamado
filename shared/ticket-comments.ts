// Visibilidade de notas internas de chamados.
// Compartilhado por Express (server/routes/tickets.ts) e Worker (worker/src/routes/tickets.ts)
// para que as duas APIs apliquem a mesma regra.

export interface CommentViewer {
  userId: string;
  isAdmin: boolean;
}

interface TicketParticipants {
  assigneeId: string | null;
}

/** Notas internas são visíveis apenas para administradores e para o responsável pelo chamado. */
export function canSeeInternalComments(viewer: CommentViewer, ticket: TicketParticipants): boolean {
  return viewer.isAdmin || (ticket.assigneeId !== null && ticket.assigneeId === viewer.userId);
}

export function filterVisibleComments<T extends { isInternal: boolean | null }>(
  comments: T[],
  viewer: CommentViewer,
  ticket: TicketParticipants,
): T[] {
  if (canSeeInternalComments(viewer, ticket)) return comments;
  return comments.filter((comment) => !comment.isInternal);
}

/** Quem não pode ver notas internas também não pode criá-las. */
export function resolveIsInternal(
  requested: unknown,
  viewer: CommentViewer,
  ticket: TicketParticipants,
): boolean {
  return requested === true && canSeeInternalComments(viewer, ticket);
}
