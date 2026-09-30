// SLA de chamados — cálculo único para Worker e Express.
//
// - O prazo corre em horário comercial de Brasília: segunda a sexta, 9h às 18h (o mesmo do
//   Freshdesk). Feriados não são descontados.
// - A regra (sla_rules) é escolhida por tipo × gravidade. A gravidade é o campo "impact"
//   (baixo/medio/alto/critico), que o Freshdesk chama de "Prioridade / Classificação";
//   em sla_rules ela continua gravada como low/medium/high/critical.

export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 18;

// America/Sao_Paulo não tem horário de verão desde 2019: UTC-3 fixo. O Worker roda em UTC,
// então o relógio de Brasília é obtido deslocando o instante e lendo os campos UTC.
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const IMPACT_TO_SEVERITY: Record<string, string> = {
  baixo: "low",
  medio: "medium",
  alto: "high",
  critico: "critical",
};

export function slaSeverityOf(ticket: { impact?: string | null; priority?: string | null }): string | null {
  return (ticket.impact && IMPACT_TO_SEVERITY[ticket.impact]) || ticket.priority || null;
}

function isWeekend(wall: Date): boolean {
  const day = wall.getUTCDay();
  return day === 0 || day === 6;
}

function atHour(wall: Date, hour: number): Date {
  const d = new Date(wall);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function nextBusinessMorning(wall: Date): Date {
  const d = new Date(wall);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
  return d;
}

/** Soma horas úteis a partir de `start` e devolve o instante do prazo. */
export function addBusinessHours(start: Date, hours: number): Date {
  let wall = new Date(start.getTime() + BRASILIA_OFFSET_MS);
  let remaining = Math.round(hours * 60);

  for (;;) {
    if (isWeekend(wall)) {
      wall = nextBusinessMorning(wall);
      continue;
    }
    const open = atHour(wall, BUSINESS_START_HOUR);
    const close = atHour(wall, BUSINESS_END_HOUR);
    if (wall < open) wall = open;
    if (wall >= close) {
      wall = nextBusinessMorning(wall);
      continue;
    }
    const available = (close.getTime() - wall.getTime()) / MINUTE_MS;
    if (remaining <= available) {
      return new Date(wall.getTime() + remaining * MINUTE_MS - BRASILIA_OFFSET_MS);
    }
    remaining -= available;
    wall = nextBusinessMorning(wall);
  }
}

/** Minutos úteis (seg–sex, 9h–18h de Brasília) entre dois instantes; 0 se `end` <= `start`. */
export function businessMinutesBetween(start: Date, end: Date): number {
  let wall = new Date(start.getTime() + BRASILIA_OFFSET_MS);
  const endWall = new Date(end.getTime() + BRASILIA_OFFSET_MS);
  let total = 0;

  while (wall < endWall) {
    if (isWeekend(wall)) {
      wall = nextBusinessMorning(wall);
      continue;
    }
    const open = atHour(wall, BUSINESS_START_HOUR);
    const close = atHour(wall, BUSINESS_END_HOUR);
    if (wall < open) wall = open;
    if (wall >= close) {
      wall = nextBusinessMorning(wall);
      continue;
    }
    const until = endWall < close ? endWall : close;
    if (until > wall) total += (until.getTime() - wall.getTime()) / MINUTE_MS;
    wall = nextBusinessMorning(wall);
  }
  return Math.round(total);
}

export interface SlaRuleLike {
  tipo: string;
  prioridade: string;
  slaHoras: string | number | null;
  primeiraRespostaHoras?: string | number | null;
  ativo: boolean | null;
}

export interface SlaTicketLike {
  type?: string | null;
  impact?: string | null;
  priority?: string | null;
  status?: string | null;
  dataAbertura?: Date | string | null;
  createdAt?: Date | string | null;
  dataPrimeiraResposta?: Date | string | null;
  dataResolucao?: Date | string | null;
  slaPausadoEm?: Date | string | null;
  slaPausaMinutos?: number | null;
}

export type SlaStatus = "dentro_prazo" | "em_atraso" | null;

export interface SlaResult {
  slaHoras: number | null;
  status: SlaStatus;
  prazo: Date | null;
  /** O relógio de resolução está parado (chamado aguardando o solicitante). */
  pausado: boolean;
  primeiraResposta: { horas: number | null; status: SlaStatus; prazo: Date | null };
}

/** Status em que o relógio de resolução fica parado. */
export const SLA_PAUSED_STATUSES: readonly string[] = ["waiting_requester"];

const CLOSED_STATUSES = ["closed", "resolved"];

function toHours(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(value.toString());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Minutos úteis pausados até `now`: pausas encerradas + a pausa em andamento. */
export function slaPausedMinutes(ticket: SlaTicketLike, now: Date = new Date()): number {
  const closed = ticket.slaPausaMinutos ?? 0;
  if (!ticket.slaPausadoEm) return closed;
  return closed + businessMinutesBetween(new Date(ticket.slaPausadoEm), now);
}

/**
 * Campos a gravar quando o status muda: entrar em "Aguardando solicitante" inicia a pausa;
 * sair dele soma o tempo útil parado e encerra a pausa. Sem mudança relevante devolve {}.
 */
export function slaPauseUpdate(
  ticket: Pick<SlaTicketLike, "slaPausadoEm" | "slaPausaMinutos">,
  newStatus: string,
  now: Date = new Date(),
): { slaPausadoEm?: Date | null; slaPausaMinutos?: number } {
  const pausing = SLA_PAUSED_STATUSES.includes(newStatus);
  if (pausing && !ticket.slaPausadoEm) return { slaPausadoEm: now };
  if (!pausing && ticket.slaPausadoEm) {
    return { slaPausadoEm: null, slaPausaMinutos: slaPausedMinutes(ticket, now) };
  }
  return {};
}

function compare(done: Date | string | null | undefined, prazo: Date, now: Date): SlaStatus {
  const at = done ? new Date(done) : now;
  return at > prazo ? "em_atraso" : "dentro_prazo";
}

export function getSlaForTicket(
  ticket: SlaTicketLike,
  rules: readonly SlaRuleLike[],
  now: Date = new Date(),
): SlaResult {
  const tipo = ticket.type?.toLowerCase();
  const severity = slaSeverityOf(ticket);
  const rule = rules.find((r) => r.ativo && r.tipo.toLowerCase() === tipo && r.prioridade === severity);
  const pausado = !!ticket.slaPausadoEm && !CLOSED_STATUSES.includes(ticket.status ?? "");
  const none = { horas: null, status: null, prazo: null };
  if (!rule) return { slaHoras: null, status: null, prazo: null, pausado, primeiraResposta: none };

  const slaHoras = toHours(rule.slaHoras);
  const respostaHoras = toHours(rule.primeiraRespostaHoras);
  const openedAt = ticket.dataAbertura ?? ticket.createdAt;
  if (!openedAt) {
    return { slaHoras, status: null, prazo: null, pausado, primeiraResposta: { ...none, horas: respostaHoras } };
  }
  const opened = new Date(openedAt);
  const isClosed = CLOSED_STATUSES.includes(ticket.status ?? "");

  // Primeira resposta: não pausa (a pausa só existe depois de a equipe falar com o solicitante).
  let primeiraResposta: SlaResult["primeiraResposta"] = { ...none, horas: respostaHoras };
  if (respostaHoras) {
    const prazo = addBusinessHours(opened, respostaHoras);
    // Fechado sem resposta registrada: a resolução conta como resposta.
    const respondedAt = ticket.dataPrimeiraResposta ?? (isClosed ? ticket.dataResolucao : null);
    const status = isClosed && !respondedAt ? "dentro_prazo" : compare(respondedAt, prazo, now);
    primeiraResposta = { horas: respostaHoras, status, prazo };
  }

  if (!slaHoras) return { slaHoras: null, status: null, prazo: null, pausado, primeiraResposta };

  // Resolução: o tempo útil pausado empurra o prazo. Com a pausa em andamento o prazo
  // anda junto com o relógio, então o chamado não entra em atraso enquanto aguarda.
  const pausa = slaPausedMinutes(ticket, isClosed && ticket.dataResolucao ? new Date(ticket.dataResolucao) : now);
  const prazo = addBusinessHours(opened, slaHoras + pausa / 60);
  if (isClosed) {
    if (!ticket.dataResolucao) return { slaHoras, status: "dentro_prazo", prazo, pausado, primeiraResposta };
    return { slaHoras, status: compare(ticket.dataResolucao, prazo, now), prazo, pausado, primeiraResposta };
  }
  return { slaHoras, status: compare(null, prazo, now), prazo, pausado, primeiraResposta };
}
