// Visão do solicitante ("Usuário", quem não é técnico): status em linguagem simples e os
// campos do chamado que ele pode editar. Regra única para telas, Worker e Express.

export type RequesterStatusTone = "neutral" | "progress" | "attention" | "done";

export interface RequesterStatus {
  label: string;
  tone: RequesterStatusTone;
  /** Chamado ainda em aberto do ponto de vista do solicitante (aba "Abertos"). */
  open: boolean;
}

const REQUESTER_STATUS: Record<string, RequesterStatus> = {
  open: { label: "Recebido", tone: "neutral", open: true },
  triage: { label: "Recebido", tone: "neutral", open: true },
  in_progress: { label: "Em atendimento", tone: "progress", open: true },
  blocked: { label: "Em atendimento", tone: "progress", open: true },
  waiting_requester: { label: "Aguardando você", tone: "attention", open: true },
  resolved: { label: "Resolvido", tone: "done", open: false },
  closed: { label: "Encerrado", tone: "done", open: false },
};

export function requesterStatus(status: string | null | undefined): RequesterStatus {
  return (status && REQUESTER_STATUS[status]) || { label: "Recebido", tone: "neutral", open: true };
}

/**
 * Campos que um solicitante que não é técnico pode alterar no próprio chamado. Status,
 * gravidade, grupo, responsável e campos do atendimento ficam com a equipe.
 */
export const REQUESTER_EDITABLE_TICKET_FIELDS: readonly string[] = ["title", "description", "attachments"];

export const REQUESTER_FORBIDDEN_CHANGE_ERROR =
  "Somente a equipe de atendimento pode alterar status, prioridade, grupo ou responsável";
