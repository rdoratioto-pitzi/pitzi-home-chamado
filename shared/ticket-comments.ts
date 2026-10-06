// Visibilidade de notas internas de chamados.
// Compartilhado por Express (server/routes/tickets.ts) e Worker (worker/src/routes/tickets.ts)
// para que as duas APIs apliquem a mesma regra.

export interface CommentViewer {
  userId: string;
  isAdmin: boolean;
  /** Membro do grupo de atendimento do chamado (fila do grupo). */
  isGroupMember?: boolean;
  /** Técnico mencionado em algum comentário do chamado (foi acionado para ajudar). */
  isMentionedTechnician?: boolean;
  /** Técnico (ou admin): atende qualquer chamado do tenant, inclusive notas internas. */
  isTechnician?: boolean;
}

interface TicketParticipants {
  assigneeId: string | null;
}

/**
 * Notas internas são visíveis para administradores e técnicos (qualquer chamado), o responsável,
 * os membros do grupo do chamado e técnicos mencionados. Usuário (não técnico) nunca vê.
 */
export function canSeeInternalComments(viewer: CommentViewer, ticket: TicketParticipants): boolean {
  return viewer.isAdmin || viewer.isTechnician === true || viewer.isGroupMember === true ||
    viewer.isMentionedTechnician === true ||
    (ticket.assigneeId !== null && ticket.assigneeId === viewer.userId);
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
