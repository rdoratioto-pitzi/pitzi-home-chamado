import { describe, it, expect } from "vitest";
import { addBusinessHours, businessMinutesBetween, getSlaForTicket, slaPauseUpdate, slaSeverityOf } from "./sla";

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
    expect(sla).toMatchObject({ slaHoras: null, status: null, prazo: null });
    expect(sla.primeiraResposta).toEqual({ horas: null, status: null, prazo: null });
  });

  it("gravidade cai para a prioridade quando não há impact", () => {
    expect(slaSeverityOf({ impact: "alto" })).toBe("high");
    expect(slaSeverityOf({ impact: null, priority: "medium" })).toBe("medium");
  });
});

describe("businessMinutesBetween", () => {
  it("conta só o horário comercial", () => {
    expect(businessMinutesBetween(br("2026-09-29T10:00:00"), br("2026-09-29T11:30:00"))).toBe(90);
    // 17h de terça até 10h de quarta: 1h + 1h
    expect(businessMinutesBetween(br("2026-09-29T17:00:00"), br("2026-09-30T10:00:00"))).toBe(120);
    // sexta 17h até segunda 9h30: 1h + 30min
    expect(businessMinutesBetween(br("2026-10-02T17:00:00"), br("2026-10-05T09:30:00"))).toBe(90);
    expect(businessMinutesBetween(br("2026-09-29T20:00:00"), br("2026-09-29T19:00:00"))).toBe(0);
  });

  it("é o inverso de addBusinessHours", () => {
    const start = br("2026-09-29T15:20:00");
    expect(businessMinutesBetween(start, addBusinessHours(start, 13.5))).toBe(13.5 * 60);
  });
});

describe("SLA de primeira resposta", () => {
  const rules = [{ tipo: "bug", prioridade: "critical", slaHoras: "2", primeiraRespostaHoras: "0.5", ativo: true }];
  const base = { type: "bug", impact: "critico", dataAbertura: br("2026-09-29T10:00:00") };

  it("sem resposta, atrasa depois do prazo", () => {
    const open = { ...base, status: "open" };
    const sla = getSlaForTicket(open, rules, br("2026-09-29T10:20:00"));
    expect(sla.primeiraResposta).toEqual({ horas: 0.5, status: "dentro_prazo", prazo: br("2026-09-29T10:30:00") });
    expect(getSlaForTicket(open, rules, br("2026-09-29T10:31:00")).primeiraResposta.status).toBe("em_atraso");
  });

  it("compara a data da primeira resposta com o prazo", () => {
    const t = (at: string) => ({ ...base, status: "in_progress", dataPrimeiraResposta: br(at) });
    expect(getSlaForTicket(t("2026-09-29T10:29:00"), rules, br("2026-09-30T10:00:00")).primeiraResposta.status).toBe("dentro_prazo");
    expect(getSlaForTicket(t("2026-09-29T10:45:00"), rules).primeiraResposta.status).toBe("em_atraso");
  });

  it("regra sem meta de resposta não tem SLA de resposta", () => {
    const sla = getSlaForTicket({ ...base, status: "open" }, [{ ...rules[0], primeiraRespostaHoras: null }]);
    expect(sla.primeiraResposta.horas).toBeNull();
    expect(sla.slaHoras).toBe(2);
  });
});

describe("pausa em Aguardando solicitante", () => {
  const rules = [{ tipo: "bug", prioridade: "critical", slaHoras: "2", ativo: true }];
  const base = { type: "bug", impact: "critico", dataAbertura: br("2026-09-29T10:00:00") };

  it("com a pausa em andamento o chamado não atrasa", () => {
    const t = { ...base, status: "waiting_requester", slaPausadoEm: br("2026-09-29T11:00:00"), slaPausaMinutos: 0 };
    const sla = getSlaForTicket(t, rules, br("2026-09-30T15:00:00"));
    expect(sla.pausado).toBe(true);
    expect(sla.status).toBe("dentro_prazo");
  });

  it("pausas encerradas empurram o prazo", () => {
    const t = { ...base, status: "in_progress", slaPausadoEm: null, slaPausaMinutos: 90 };
    const sla = getSlaForTicket(t, rules, br("2026-09-29T13:00:00"));
    expect(sla.prazo).toEqual(br("2026-09-29T13:30:00"));
    expect(sla.status).toBe("dentro_prazo");
    expect(sla.pausado).toBe(false);
  });

  it("pausa que começa depois do prazo não tira do atraso", () => {
    const t = { ...base, status: "waiting_requester", slaPausadoEm: br("2026-09-29T13:00:00"), slaPausaMinutos: 0 };
    expect(getSlaForTicket(t, rules, br("2026-09-29T15:00:00")).status).toBe("em_atraso");
  });

  it("slaPauseUpdate inicia e encerra a pausa", () => {
    expect(slaPauseUpdate({ slaPausadoEm: null, slaPausaMinutos: 0 }, "waiting_requester", br("2026-09-29T11:00:00")))
      .toEqual({ slaPausadoEm: br("2026-09-29T11:00:00") });
    expect(slaPauseUpdate({ slaPausadoEm: br("2026-09-29T11:00:00"), slaPausaMinutos: 30 }, "in_progress", br("2026-09-29T12:15:00")))
      .toEqual({ slaPausadoEm: null, slaPausaMinutos: 105 });
    expect(slaPauseUpdate({ slaPausadoEm: null, slaPausaMinutos: 30 }, "in_progress")).toEqual({});
    expect(slaPauseUpdate({ slaPausadoEm: br("2026-09-29T11:00:00") }, "waiting_requester")).toEqual({});
  });
});
