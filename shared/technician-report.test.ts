import { describe, expect, it } from "vitest";
import { buildTechnicianReport, csvCell, formatBusinessMinutes, isValidDay, slaPercent, type ReportTicket } from "./technician-report";

// Horário útil: seg–sex 9h–18h de Brasília (UTC-3). 12/10/2026 é segunda-feira.
const at = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 9, day, hour + 3, minute));
const rules = [{ tipo: "bug", prioridade: "medium", slaHoras: 8, primeiraRespostaHoras: 2, ativo: true }];
const people = [
  { id: "ana", name: "Ana" },
  { id: "bia", name: "Bia" },
  { id: "req", name: "Solicitante" },
];

function ticket(id: string, extra: Partial<ReportTicket>): ReportTicket {
  return {
    id, code: `CHA-${id}`, title: `Chamado ${id}`, category: "sap", type: "bug", impact: "medio",
    requesterId: "req", assigneeId: "ana", status: "open", dataAbertura: at(12, 9), ...extra,
  };
}

describe("buildTechnicianReport", () => {
  const tickets = [
    // Ana: resolveu em 3h úteis, respondeu em 30 min, nota 5
    ticket("1", { status: "resolved", dataPrimeiraResposta: at(12, 9, 30), dataResolucao: at(12, 12), satisfactionRating: 5 }),
    // Ana: resolveu fora do SLA (8h úteis estoura na terça 9h), respondeu em 3h (fora do SLA de 2h), nota 3
    ticket("2", { status: "closed", dataPrimeiraResposta: at(12, 12), dataResolucao: at(13, 15), satisfactionRating: 3 }),
    // Bia: em aberto e atrasado (aberto segunda 9h, agora quarta 10h)
    ticket("3", { assigneeId: "bia", status: "in_progress", dataPrimeiraResposta: at(12, 10) }),
    // Sem responsável, aberto antes do período: conta só como em aberto agora
    ticket("4", { assigneeId: null, dataAbertura: at(5, 10) }),
    // Ana: resolvido antes do período: fora de tudo
    ticket("5", { status: "resolved", dataAbertura: at(1, 9), dataResolucao: at(2, 9) }),
  ];
  const report = buildTechnicianReport({
    tickets, people, technicianIds: ["ana", "bia"], slaRules: rules,
    from: at(12, 0), to: at(19, 0), now: at(14, 10),
  });
  const ana = report.rows.find((r) => r.assigneeId === "ana")!;
  const bia = report.rows.find((r) => r.assigneeId === "bia")!;

  it("conta recebidos, resolvidos, em aberto e atrasados por técnico", () => {
    expect([ana.received, ana.resolved, ana.openNow]).toEqual([2, 2, 0]);
    expect([bia.received, bia.resolved, bia.openNow, bia.overdueNow]).toEqual([1, 0, 1, 1]);
    expect(report.rows.find((r) => r.assigneeId === null)?.openNow).toBe(1);
  });

  it("calcula tempos médios em minutos úteis e o SLA cumprido", () => {
    expect(ana.avgFirstResponseMin).toBe(105); // (30 + 180) / 2
    expect(ana.avgResolutionMin).toBe(540); // (180 + 900) / 2 — 900 = 9h na segunda + 6h na terça
    expect(ana.firstResponseSla).toEqual({ met: 1, total: 2 });
    expect(ana.resolutionSla).toEqual({ met: 1, total: 2 });
    expect(slaPercent(ana.resolutionSla)).toBe(50);
  });

  it("CSAT médio e totais", () => {
    expect(ana.csat).toEqual({ average: 4, count: 2 });
    expect(report.totals.received).toBe(3);
    expect(report.totals.openNow).toBe(2);
    expect(report.tickets.map((t) => t.code)).not.toContain("CHA-5");
  });

  it("ordena pelo número de resolvidos", () => {
    expect(report.rows[0].assigneeId).toBe("ana");
  });
});

describe("formatBusinessMinutes", () => {
  it("mostra minutos e horas", () => {
    expect(formatBusinessMinutes(45)).toBe("45 min");
    expect(formatBusinessMinutes(95)).toBe("1h35");
    expect(formatBusinessMinutes(120)).toBe("2h");
    expect(formatBusinessMinutes(null)).toBe("—");
  });
});

describe("correções da revisão", () => {
  it("chamado fechado direto (só dataFechamento) conta como resolvido, com CSAT e tempo", () => {
    const report = buildTechnicianReport({
      tickets: [ticket("9", { status: "closed", dataAbertura: at(1, 9), dataFechamento: at(13, 10), satisfactionRating: 5 })],
      people, technicianIds: ["ana"], slaRules: rules, from: at(12, 0), to: at(19, 0), now: at(14, 10),
    });
    const ana = report.rows.find((r) => r.assigneeId === "ana")!;
    expect(ana.resolved).toBe(1);
    expect(ana.csat).toEqual({ average: 5, count: 1 });
    expect(report.tickets[0].resolvedAt).not.toBeNull();
    expect(report.tickets[0].resolutionMin).toBeGreaterThan(0);
  });

  it("tempos de cada chamado aparecem mesmo fora do período da média", () => {
    const report = buildTechnicianReport({
      tickets: [ticket("8", { status: "resolved", dataAbertura: at(1, 9), dataPrimeiraResposta: at(1, 10), dataResolucao: at(13, 10) })],
      people, technicianIds: ["ana"], slaRules: rules, from: at(12, 0), to: at(19, 0), now: at(14, 10),
    });
    expect(report.tickets[0].firstResponseMin).toBe(60);
    expect(report.rows[0].avgFirstResponseMin).toBeNull(); // aberto antes do período: fora da média
  });
});

describe("csvCell e isValidDay", () => {
  it("neutraliza fórmulas e protege separadores e quebras de linha", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell(" @SOMA(A1)")).toBe("' @SOMA(A1)");
    expect(csvCell("\t-2")).toBe("'\t-2");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("linha\rquebrada")).toBe('"linha\rquebrada"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
  });

  it("rejeita datas que não existem", () => {
    expect(isValidDay("2026-10-13")).toBe(true);
    expect(isValidDay("2024-02-29")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("13/10/2026")).toBe(false);
  });
});
