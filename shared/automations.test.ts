import { describe, it, expect } from "vitest";
import { matchesAutomation, parseAutomationRule, planAutomations, type AutomationRuleLike } from "./automations";

const groups = [
  { key: "suporte", memberIds: ["ana", "bia"] },
  { key: "financeiro", memberIds: ["caio"] },
];
const now = new Date("2026-09-30T15:00:00Z");

const ticket = {
  type: "bug", category: "suporte", impact: "medio", requestObject: "Pedidos",
  status: "open", assigneeId: null as string | null, requesterId: "req",
};

const rule = (over: Partial<AutomationRuleLike>): AutomationRuleLike => ({
  name: "Regra", active: true, trigger: "ticket_created", conditions: {}, actions: [], sortOrder: 0, ...over,
});

describe("matchesAutomation", () => {
  it("condições vazias casam com qualquer chamado", () => {
    expect(matchesAutomation(rule({}), ticket)).toBe(true);
  });

  it("todas as condições precisam casar", () => {
    const r = rule({ conditions: { types: ["bug"], impacts: ["alto"] } });
    expect(matchesAutomation(r, ticket)).toBe(false);
    expect(matchesAutomation(r, { ...ticket, impact: "alto" })).toBe(true);
  });

  it("status_changed compara o novo status", () => {
    const r = rule({ trigger: "status_changed", conditions: { statuses: ["resolved"] } });
    expect(matchesAutomation(r, ticket, { newStatus: "resolved" })).toBe(true);
    expect(matchesAutomation(r, ticket, { newStatus: "in_progress" })).toBe(false);
  });
});

describe("planAutomations", () => {
  it("aplica as ações em ordem e registra uma nota por regra", () => {
    const rules = [
      rule({ name: "Crítico vai pro financeiro", sortOrder: 1, conditions: { impacts: ["critico"] },
        actions: [{ type: "set_group", value: "financeiro" }] }),
      rule({ name: "Bug vira crítico", sortOrder: 0, conditions: { types: ["bug"] },
        actions: [{ type: "set_impact", value: "critico" }, { type: "add_internal_note", value: "Verificar logs" }] }),
    ];
    const plan = planAutomations(rules, "ticket_created", ticket, { groups, now });
    // A segunda regra (sortOrder 1) enxerga a gravidade já alterada pela primeira.
    expect(plan.patch).toEqual({ impact: "critico", category: "financeiro" });
    expect(plan.applied).toEqual(["Bug vira crítico", "Crítico vai pro financeiro"]);
    expect(plan.notes[0]).toContain('Automação "Bug vira crítico" — aplicou: gravidade → Crítico');
    expect(plan.notes[0]).toContain("Verificar logs");
  });

  it("ignora regras inativas e de outro gatilho", () => {
    const rules = [
      rule({ active: false, actions: [{ type: "set_impact", value: "alto" }] }),
      rule({ trigger: "status_changed", actions: [{ type: "set_impact", value: "alto" }] }),
    ];
    const plan = planAutomations(rules, "ticket_created", ticket, { groups, now });
    expect(plan.applied).toEqual([]);
    expect(plan.patch).toEqual({});
  });

  it("não atribui a quem não é membro do grupo", () => {
    const plan = planAutomations([rule({ actions: [{ type: "set_assignee", value: "caio" }] })], "ticket_created", ticket, { groups, now });
    expect(plan.patch).toEqual({});
    expect(plan.notes[0]).toContain("não aplicou: responsável não é membro do grupo do chamado");
  });

  it("mudar de grupo tira o responsável que não é membro do novo grupo", () => {
    const plan = planAutomations([rule({ actions: [{ type: "set_group", value: "financeiro" }] })], "ticket_created",
      { ...ticket, assigneeId: "ana" }, { groups, now });
    expect(plan.patch).toEqual({ category: "financeiro", assigneeId: null });
  });

  it("não move para grupo inativo", () => {
    const plan = planAutomations([rule({ actions: [{ type: "set_group", value: "extinto" }] })], "ticket_created", ticket, { groups, now });
    expect(plan.patch).toEqual({});
    expect(plan.notes[0]).toContain("inativo ou inexistente");
  });

  it("resolver grava a data, encerra a pausa do SLA e exige responsável", () => {
    const waiting = { ...ticket, status: "waiting_requester", slaPausadoEm: new Date("2026-09-30T13:00:00Z"), slaPausaMinutos: 10 };
    const r = rule({ trigger: "waiting_requester_timeout", actions: [{ type: "set_status", value: "resolved" }] });
    const semResponsavel = planAutomations([r], "waiting_requester_timeout", waiting, { groups, now });
    expect(semResponsavel.patch).toEqual({});
    const comResponsavel = planAutomations([r], "waiting_requester_timeout", { ...waiting, assigneeId: "ana" }, { groups, now });
    expect(comResponsavel.patch).toMatchObject({ status: "resolved", dataResolucao: now, slaPausadoEm: null });
    expect(comResponsavel.patch.slaPausaMinutos).toBeGreaterThan(10);
  });

  it("status mudado por automação não dispara as regras daquele status (sem laço)", () => {
    const rules = [
      rule({ name: "Resolvido vira fechado", trigger: "status_changed", sortOrder: 0, conditions: { statuses: ["resolved"] },
        actions: [{ type: "set_status", value: "closed" }] }),
      rule({ name: "Fechado volta", trigger: "status_changed", sortOrder: 1, conditions: { statuses: ["closed"] },
        actions: [{ type: "set_status", value: "open" }] }),
    ];
    const plan = planAutomations(rules, "status_changed", { ...ticket, status: "resolved", assigneeId: "ana" },
      { groups, now, newStatus: "resolved" });
    expect(plan.applied).toEqual(["Resolvido vira fechado"]);
    expect(plan.patch.status).toBe("closed");
  });

  it("notificar resolve responsável e solicitante", () => {
    const plan = planAutomations([rule({ name: "Avisar", actions: [
      { type: "notify_user", value: "requester" },
      { type: "notify_user", value: "assignee" },
    ] })], "ticket_created", { ...ticket, assigneeId: "bia" }, { groups, now });
    expect(plan.notify).toEqual([{ userId: "req", ruleName: "Avisar" }, { userId: "bia", ruleName: "Avisar" }]);
  });
});

describe("parseAutomationRule", () => {
  const base = { name: "X", trigger: "ticket_created", actions: [{ type: "set_impact", value: "alto" }] };

  it("normaliza uma regra válida", () => {
    expect(parseAutomationRule({ ...base, conditions: { types: ["bug", "bug"], statuses: ["open"] } })).toMatchObject({
      name: "X", active: true, conditions: { types: ["bug"] }, timeoutDays: null,
    });
  });

  it("rejeita gatilho, ação ou valor inválidos", () => {
    expect(() => parseAutomationRule({ ...base, trigger: "x" })).toThrow("Gatilho inválido");
    expect(() => parseAutomationRule({ ...base, actions: [] })).toThrow("pelo menos uma ação");
    expect(() => parseAutomationRule({ ...base, actions: [{ type: "set_status", value: "voando" }] })).toThrow("Status inválido");
    expect(() => parseAutomationRule({ ...base, name: " " })).toThrow("nome");
  });

  it("automação por tempo exige dias e mudança de status", () => {
    const timeout = { name: "Fechar", trigger: "waiting_requester_timeout", actions: [{ type: "add_internal_note", value: "oi" }] };
    expect(() => parseAutomationRule({ ...timeout, timeoutDays: 3 })).toThrow("mudar o status");
    expect(() => parseAutomationRule({ ...timeout, actions: [{ type: "set_status", value: "resolved" }] })).toThrow("dias");
    expect(parseAutomationRule({ ...timeout, timeoutDays: 3, actions: [{ type: "set_status", value: "resolved" }] }).timeoutDays).toBe(3);
  });
});
