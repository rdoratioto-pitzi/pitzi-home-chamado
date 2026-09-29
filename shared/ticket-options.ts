// Tipos e status de chamado — fonte única para frontend, Worker e Express.
// Os valores gravados no banco não mudam: "bug" continua "bug", só o rótulo segue o
// vocabulário do Freshdesk ("Falha / Erro").

export interface TicketOption {
  value: string;
  label: string;
}

export const TICKET_TYPES: readonly TicketOption[] = [
  { value: "bug", label: "Falha / Erro" },
  { value: "requisicao", label: "Requisição" },
  { value: "duvida", label: "Dúvida / Investigação" },
  { value: "melhoria", label: "Melhoria" },
];

// Tipos que não são mais oferecidos na abertura, mas existem em chamados antigos.
const LEGACY_TICKET_TYPES: readonly TicketOption[] = [
  { value: "negocio", label: "Negócio" },
  { value: "processo", label: "Processo" },
];

export function ticketTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return [...TICKET_TYPES, ...LEGACY_TICKET_TYPES].find((t) => t.value === value)?.label ?? value;
}

export const TICKET_STATUSES: readonly TicketOption[] = [
  { value: "open", label: "Aberto" },
  { value: "triage", label: "Triagem" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "waiting_requester", label: "Aguardando solicitante" },
  { value: "blocked", label: "Bloqueado" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
];

/** Status em que o chamado ainda está com a equipe (entra nas contagens de "em aberto"). */
export const OPEN_TICKET_STATUSES: readonly string[] = [
  "open", "triage", "in_progress", "waiting_requester", "blocked",
];

export function ticketStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return TICKET_STATUSES.find((s) => s.value === value)?.label ?? value;
}
