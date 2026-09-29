import { describe, it, expect } from "vitest";
import { addBusinessHours, getSlaForTicket, slaSeverityOf } from "./sla";

// Horários em Brasília (UTC-3) escritos como ISO com offset, para o teste não depender do fuso da máquina.
const br = (iso: string) => new Date(`${iso}-03:00`);

describe("addBusinessHours (seg–sex, 9h–18h de Brasília)", () => {
  it("soma dentro do mesmo dia", () => {
    expect(addBusinessHours(br("2026-09-29T10:00:00"), 2)).toEqual(br("2026-09-29T12:00:00"));
  });

  it("passa para o dia seguinte ao fechar às 18h", () => {
    // 17h + 2h úteis: 1h hoje, 1h amanhã a partir das 9h
    expect(addBusinessHours(br("2026-09-29T17:00:00"), 2)).toEqual(br("2026-09-30T10:00:00"));
  });

  it("antes das 9h começa a contar às 9h", () => {
    expect(addBusinessHours(br("2026-09-29T06:30:00"), 1)).toEqual(br("2026-09-29T10:00:00"));
  });

  it("pula o fim de semana", () => {
    // sexta 16h + 4h: 2h na sexta, 2h na segunda
    expect(addBusinessHours(br("2026-10-02T16:00:00"), 4)).toEqual(br("2026-10-05T11:00:00"));
    // aberto no sábado conta a partir de segunda 9h
    expect(addBusinessHours(br("2026-10-03T11:00:00"), 1)).toEqual(br("2026-10-05T10:00:00"));
  });

  it("um dia útil tem 9 horas", () => {
    expect(addBusinessHours(br("2026-09-29T09:00:00"), 9)).toEqual(br("2026-09-29T18:00:00"));
    expect(addBusinessHours(br("2026-09-29T09:00:00"), 18)).toEqual(br("2026-09-30T18:00:00"));
  });

  it("respeita minutos", () => {
    expect(addBusinessHours(br("2026-09-29T17:30:00"), 1)).toEqual(br("2026-09-30T09:30:00"));
  });
});

describe("getSlaForTicket", () => {
  const rules = [
    { tipo: "bug", prioridade: "critical", slaHoras: "2", ativo: true },
    { tipo: "bug", prioridade: "low", slaHoras: "64", ativo: true },
    { tipo: "melhoria", prioridade: "critical", slaHoras: "54", ativo: false },
  ];

  it("escolhe a regra pela gravidade (impact), não pela prioridade", () => {
    const ticket = { type: "bug", impact: "critico", priority: "low", status: "open", dataAbertura: br("2026-09-29T10:00:00") };
    const sla = getSlaForTicket(ticket, rules, br("2026-09-29T11:00:00"));
    expect(sla.slaHoras).toBe(2);
    expect(sla.prazo).toEqual(br("2026-09-29T12:00:00"));
    expect(sla.status).toBe("dentro_prazo");
    expect(getSlaForTicket(ticket, rules, br("2026-09-29T12:01:00")).status).toBe("em_atraso");
  });

  it("resolvido compara a data de resolução com o prazo", () => {
    const base = { type: "bug", impact: "critico", status: "resolved", dataAbertura: br("2026-09-29T10:00:00") };
    expect(getSlaForTicket({ ...base, dataResolucao: br("2026-09-29T11:59:00") }, rules).status).toBe("dentro_prazo");
    expect(getSlaForTicket({ ...base, dataResolucao: br("2026-09-29T12:30:00") }, rules).status).toBe("em_atraso");
  });

  it("sem regra ativa não tem SLA", () => {
    const sla = getSlaForTicket({ type: "melhoria", impact: "critico", status: "open", dataAbertura: new Date() }, rules);
    expect(sla).toEqual({ slaHoras: null, status: null, prazo: null });
  });

  it("gravidade cai para a prioridade quando não há impact", () => {
    expect(slaSeverityOf({ impact: "alto" })).toBe("high");
    expect(slaSeverityOf({ impact: null, priority: "medium" })).toBe("medium");
  });
});
