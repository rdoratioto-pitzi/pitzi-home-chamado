// Fila do grupo de atendimento — regras de quem vê, assume e transfere chamados.
// Compartilhado por Worker, Express e frontend para que todos apliquem a mesma regra.
// O grupo do chamado é a chave gravada em tickets.category (ver support_groups).

import { OPEN_TICKET_STATUSES } from "./ticket-options";

export interface QueueViewer {
  userId: string;
  isAdmin: boolean;
  /** Chaves dos grupos ativos de que o usuário é membro. */
  groupKeys: readonly string[];
  /** Técnico (ou admin): atende e transfere qualquer chamado, mesmo fora das squads dele. */
  isTechnician?: boolean;
}

interface QueueTicket {
  category: string;
  assigneeId: string | null;
  status: string;
}

export function isGroupMember(viewer: QueueViewer, ticket: Pick<QueueTicket, "category">): boolean {
  return viewer.groupKeys.includes(ticket.category);
}

/** Entra na fila do usuário: chamado em aberto de um grupo dele (admin vê todos os grupos). */
export function isInQueue(viewer: QueueViewer, ticket: QueueTicket): boolean {
  if (!OPEN_TICKET_STATUSES.includes(ticket.status)) return false;
  return viewer.isAdmin || isGroupMember(viewer, ticket);
}

/**
 * Assumir: técnico pega um chamado sem responsável; admin pega qualquer um.
 * Devolve a mensagem de erro, ou null quando pode.
 */
export function claimDenial(viewer: QueueViewer, ticket: QueueTicket): string | null {
  if (!OPEN_TICKET_STATUSES.includes(ticket.status)) return "Chamado já encerrado";
  if (ticket.assigneeId === viewer.userId) return "O chamado já está com você";
  if (viewer.isAdmin) return null;
  // Qualquer técnico assume chamado sem responsável (a rota já exige técnico); quem já tem
  // responsável só o admin reatribui pelo Assumir.
  if (ticket.assigneeId) return "O chamado já tem responsável";
  return null;
}

/** Transferir: qualquer técnico, membros do grupo atual, o responsável ou admin. */
export function transferDenial(viewer: QueueViewer, ticket: QueueTicket): string | null {
  if (!OPEN_TICKET_STATUSES.includes(ticket.status)) return "Chamado já encerrado";
  if (viewer.isAdmin || viewer.isTechnician === true) return null;
  if (ticket.assigneeId === viewer.userId || isGroupMember(viewer, ticket)) return null;
  return "Apenas membros do grupo ou o responsável podem transferir este chamado";
}
