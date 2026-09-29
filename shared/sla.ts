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

export interface SlaRuleLike {
  tipo: string;
  prioridade: string;
  slaHoras: string | number | null;
  ativo: boolean | null;
}

export interface SlaTicketLike {
  type?: string | null;
  impact?: string | null;
  priority?: string | null;
  status?: string | null;
  dataAbertura?: Date | string | null;
  createdAt?: Date | string | null;
  dataResolucao?: Date | string | null;
}

export type SlaStatus = "dentro_prazo" | "em_atraso" | null;

export function getSlaForTicket(
  ticket: SlaTicketLike,
  rules: readonly SlaRuleLike[],
  now: Date = new Date(),
): { slaHoras: number | null; status: SlaStatus; prazo: Date | null } {
  const tipo = ticket.type?.toLowerCase();
  const severity = slaSeverityOf(ticket);
  const rule = rules.find((r) => r.ativo && r.tipo.toLowerCase() === tipo && r.prioridade === severity);
  if (!rule || !rule.slaHoras) return { slaHoras: null, status: null, prazo: null };

  const slaHoras = parseFloat(rule.slaHoras.toString());
  const openedAt = ticket.dataAbertura ?? ticket.createdAt;
  if (!openedAt) return { slaHoras, status: null, prazo: null };

  const prazo = addBusinessHours(new Date(openedAt), slaHoras);
  if (ticket.status === "closed" || ticket.status === "resolved") {
    if (!ticket.dataResolucao) return { slaHoras, status: "dentro_prazo", prazo };
    return { slaHoras, status: new Date(ticket.dataResolucao) > prazo ? "em_atraso" : "dentro_prazo", prazo };
  }
  return { slaHoras, status: now > prazo ? "em_atraso" : "dentro_prazo", prazo };
}
