// Relatório de chamados por técnico (Configurações → Relatórios): volume, tempos e SLA no período.
// Regra única para Worker e telas; os tempos são em minutos úteis (shared/sla.ts), descontando pausas.
import { businessMinutesBetween, getSlaForTicket, slaPausedMinutes, type SlaRuleLike, type SlaTicketLike } from "./sla";

export interface ReportTicket extends SlaTicketLike {
  id: string;
  code: string;
  title: string;
  category: string;
  assigneeId: string | null;
  requesterId: string;
  satisfactionRating?: number | null;
  dataFechamento?: Date | string | null;
}

export interface ReportPerson {
  id: string;
  name: string;
  email?: string | null;
}

export interface TechnicianRow {
  assigneeId: string | null;
  name: string;
  received: number;
  resolved: number;
  openNow: number;
  overdueNow: number;
  avgFirstResponseMin: number | null;
  avgResolutionMin: number | null;
  firstResponseSla: { met: number; total: number };
  resolutionSla: { met: number; total: number };
  csat: { average: number | null; count: number };
}

export interface ReportTicketLine {
  id: string;
  code: string;
  title: string;
  category: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string;
  requesterName: string;
  openedAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  firstResponseMin: number | null;
  resolutionMin: number | null;
  slaStatus: "dentro_prazo" | "em_atraso" | null;
  csat: number | null;
}

export interface TechnicianReport {
  from: string;
  to: string;
  rows: TechnicianRow[];
  totals: TechnicianRow;
  tickets: ReportTicketLine[];
}

const CLOSED = ["resolved", "closed"];

const toDate = (value: Date | string | null | undefined) => (value ? new Date(value) : null);
const iso = (value: Date | null) => (value ? value.toISOString() : null);
const inRange = (date: Date | null, from: Date, to: Date) => !!date && date >= from && date < to;
const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

function emptyRow(assigneeId: string | null, name: string): TechnicianRow {
  return {
    assigneeId, name, received: 0, resolved: 0, openNow: 0, overdueNow: 0,
    avgFirstResponseMin: null, avgResolutionMin: null,
    firstResponseSla: { met: 0, total: 0 }, resolutionSla: { met: 0, total: 0 },
    csat: { average: null, count: 0 },
  };
}

/**
 * Monta o relatório. `from`/`to` delimitam o período (to exclusivo). Chamados entram por:
 *  - recebidos / 1ª resposta: abertos no período;
 *  - resolvidos / tempo de resolução / SLA de resolução / CSAT: resolvidos no período;
 *  - em aberto e atrasados: situação atual, independente do período.
 */
export function buildTechnicianReport(input: {
  tickets: ReportTicket[];
  people: ReportPerson[];
  technicianIds: string[];
  slaRules: readonly SlaRuleLike[];
  from: Date;
  to: Date;
  now?: Date;
}): TechnicianReport {
  const { tickets, people, technicianIds, slaRules, from, to } = input;
  const now = input.now ?? new Date();
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const rows = new Map<string, TechnicianRow>();
  for (const id of technicianIds) rows.set(id, emptyRow(id, nameOf.get(id) ?? "Técnico"));
  const unassigned = emptyRow(null, "Sem responsável");
  const rowFor = (id: string | null) => {
    if (!id) return unassigned;
    if (!rows.has(id)) rows.set(id, emptyRow(id, nameOf.get(id) ?? "Ex-técnico"));
    return rows.get(id)!;
  };

  const firstResponseTimes = new Map<TechnicianRow, number[]>();
  const resolutionTimes = new Map<TechnicianRow, number[]>();
  const csatValues = new Map<TechnicianRow, number[]>();
  const push = (map: Map<TechnicianRow, number[]>, row: TechnicianRow, value: number) => map.set(row, [...(map.get(row) || []), value]);
  const lines: ReportTicketLine[] = [];

  for (const ticket of tickets) {
    const row = rowFor(ticket.assigneeId);
    const opened = toDate(ticket.dataAbertura ?? ticket.createdAt);
    const firstResponse = toDate(ticket.dataPrimeiraResposta);
    const isClosed = CLOSED.includes(ticket.status ?? "");
    // Conclusão efetiva: resolução ou, para chamado fechado direto, a data de fechamento.
    const resolvedAt = toDate(ticket.dataResolucao) ?? (isClosed ? toDate(ticket.dataFechamento) : null);
    const sla = getSlaForTicket({ ...ticket, dataResolucao: resolvedAt }, slaRules, now);

    const openedInPeriod = inRange(opened, from, to);
    const resolvedInPeriod = isClosed && inRange(resolvedAt, from, to);
    // Tempos de cada chamado sempre que houver as datas; o período só decide o que entra nas médias.
    const firstResponseMin = opened && firstResponse ? businessMinutesBetween(opened, firstResponse) : null;
    const resolutionMin = opened && resolvedAt
      ? Math.max(0, businessMinutesBetween(opened, resolvedAt) - slaPausedMinutes(ticket, resolvedAt))
      : null;

    if (openedInPeriod) {
      row.received += 1;
      if (firstResponseMin != null) push(firstResponseTimes, row, firstResponseMin);
      if (sla.primeiraResposta.status) {
        row.firstResponseSla.total += 1;
        if (sla.primeiraResposta.status === "dentro_prazo") row.firstResponseSla.met += 1;
      }
    }
    if (resolvedInPeriod) {
      row.resolved += 1;
      if (resolutionMin != null) push(resolutionTimes, row, resolutionMin);
      if (sla.status) {
        row.resolutionSla.total += 1;
        if (sla.status === "dentro_prazo") row.resolutionSla.met += 1;
      }
      if (ticket.satisfactionRating) push(csatValues, row, ticket.satisfactionRating);
    }
    if (!isClosed) {
      row.openNow += 1;
      if (sla.status === "em_atraso") row.overdueNow += 1;
    }

    if (openedInPeriod || resolvedInPeriod || !isClosed) {
      lines.push({
        id: ticket.id,
        code: ticket.code,
        title: ticket.title,
        category: ticket.category,
        status: ticket.status ?? "",
        assigneeId: ticket.assigneeId,
        assigneeName: row.name,
        requesterName: nameOf.get(ticket.requesterId) ?? "",
        openedAt: iso(opened),
        firstResponseAt: iso(firstResponse),
        resolvedAt: iso(resolvedAt),
        firstResponseMin,
        resolutionMin,
        slaStatus: sla.status,
        csat: ticket.satisfactionRating ?? null,
      });
    }
  }

  const finish = (row: TechnicianRow) => {
    row.avgFirstResponseMin = avg(firstResponseTimes.get(row) || []);
    row.avgResolutionMin = avg(resolutionTimes.get(row) || []);
    const scores = csatValues.get(row) || [];
    row.csat = { average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null, count: scores.length };
    return row;
  };

  const technicianRows = [...rows.values()].map(finish).sort((a, b) => b.resolved - a.resolved || b.received - a.received || a.name.localeCompare(b.name));
  const all = [...technicianRows, finish(unassigned)];
  const totals = emptyRow(null, "Total");
  for (const row of all) {
    totals.received += row.received;
    totals.resolved += row.resolved;
    totals.openNow += row.openNow;
    totals.overdueNow += row.overdueNow;
    totals.firstResponseSla.met += row.firstResponseSla.met;
    totals.firstResponseSla.total += row.firstResponseSla.total;
    totals.resolutionSla.met += row.resolutionSla.met;
    totals.resolutionSla.total += row.resolutionSla.total;
  }
  totals.avgFirstResponseMin = avg(all.flatMap((r) => firstResponseTimes.get(r) || []));
  totals.avgResolutionMin = avg(all.flatMap((r) => resolutionTimes.get(r) || []));
  const allScores = all.flatMap((r) => csatValues.get(r) || []);
  totals.csat = { average: allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null, count: allScores.length };

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows: unassigned.received || unassigned.openNow ? [...technicianRows, unassigned] : technicianRows,
    totals,
    tickets: lines.sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt))),
  };
}

/** Minutos úteis em texto: 95 → "1h35". */
export function formatBusinessMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function slaPercent(sla: { met: number; total: number }): number | null {
  return sla.total ? Math.round((sla.met / sla.total) * 100) : null;
}

/**
 * Célula de CSV para Excel (separador ";"): neutraliza fórmulas (=, +, -, @ no início, mesmo após
 * espaços ou caracteres de controle) com um apóstrofo e põe entre aspas quando há ; " \r ou \n.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  let text = String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** "AAAA-MM-DD" válido de verdade (rejeita 2026-02-30 e 2026-13-01). */
export function isValidDay(day: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
