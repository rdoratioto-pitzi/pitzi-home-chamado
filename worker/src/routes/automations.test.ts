import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const storage = {
  getCannedResponses: vi.fn(),
  getCannedResponse: vi.fn(),
  createCannedResponse: vi.fn(),
  updateCannedResponse: vi.fn(),
  deleteCannedResponse: vi.fn(),
  getAutomationRules: vi.fn(),
  getAutomationRule: vi.fn(),
  createAutomationRule: vi.fn(),
  updateAutomationRule: vi.fn(),
  deleteAutomationRule: vi.fn(),
  getActiveSupportGroupByKey: vi.fn(),
  getUser: vi.fn(),
  getSupportGroups: vi.fn(),
  getTicketsWaitingRequesterSince: vi.fn(),
  updateTicket: vi.fn(),
  createTicketComment: vi.fn(),
  createNotification: vi.fn(),
};

vi.mock("../lib/storage", () => ({ getStorage: () => storage }));

const { automations } = await import("./automations");
const { runWaitingRequesterTimeouts, runTicketAutomations } = await import("../../../server/services/automations.service");

function buildApp(user: { userId: string; role?: string; modulePermissions?: unknown }) {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", { tenantId: null, role: "user", ...user });
    c.set("db", {});
    await next();
  });
  app.route("/", automations);
  return app;
}

const send = (app: Hono<any>, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const plain = { userId: "u1" };
const manager = { userId: "u2", modulePermissions: JSON.stringify({ campos_chamado: true }) };
const admin = { userId: "a1", role: "admin" };

const RESPONSES = [
  { id: "r1", title: "Geral", body: "Oi", groupKey: null, active: true },
  { id: "r2", title: "Financeiro", body: "Fin", groupKey: "financeiro", active: true },
  { id: "r3", title: "Antiga", body: "x", groupKey: null, active: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  storage.getCannedResponses.mockResolvedValue(RESPONSES);
  storage.getActiveSupportGroupByKey.mockResolvedValue({ key: "financeiro" });
  storage.createCannedResponse.mockImplementation(async (d: any) => ({ id: "new", ...d }));
  storage.createAutomationRule.mockImplementation(async (d: any) => ({ id: "rule", ...d }));
  storage.getUser.mockImplementation(async (id: string) => ({ id }));
  storage.createTicketComment.mockResolvedValue({});
  storage.createNotification.mockResolvedValue({});
});

describe("respostas prontas", () => {
  it("qualquer usuário lista só as ativas do grupo e as gerais", async () => {
    const res = await send(buildApp(plain), "GET", "/api/canned-responses?group=suporte&all=1");
    expect((await res.json() as any[]).map((r) => r.id)).toEqual(["r1"]);
    const fin = await send(buildApp(plain), "GET", "/api/canned-responses?group=financeiro");
    expect((await fin.json() as any[]).map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("admin pode ver também as desativadas", async () => {
    const res = await send(buildApp(admin), "GET", "/api/canned-responses?all=1");
    expect((await res.json() as any[]).map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("criar exige admin (a permissão avulsa antiga não vale)", async () => {
    const body = { title: "Recebido", body: "Olá {{solicitante}}" };
    expect((await send(buildApp(plain), "POST", "/api/canned-responses", body)).status).toBe(403);
    expect((await send(buildApp(manager), "POST", "/api/canned-responses", body)).status).toBe(403);
    expect(storage.createCannedResponse).not.toHaveBeenCalled();
    expect((await send(buildApp(admin), "POST", "/api/canned-responses", body)).status).toBe(201);
    expect(storage.createCannedResponse.mock.calls[0][0]).toMatchObject({ title: "Recebido", groupKey: null, createdBy: "a1" });
  });

  it("valida título e grupo", async () => {
    expect((await send(buildApp(admin), "POST", "/api/canned-responses", { title: "", body: "x" })).status).toBe(400);
    storage.getActiveSupportGroupByKey.mockResolvedValue(undefined);
    expect((await send(buildApp(admin), "POST", "/api/canned-responses", { title: "a", body: "x", groupKey: "nada" })).status).toBe(400);
  });
});

describe("automações — cadastro", () => {
  const rule = { name: "Bug crítico", trigger: "ticket_created", conditions: { types: ["bug"] }, actions: [{ type: "set_impact", value: "critico" }] };

  it("listar e criar exigem admin", async () => {
    storage.getAutomationRules.mockResolvedValue([]);
    expect((await send(buildApp(plain), "GET", "/api/automations")).status).toBe(403);
    expect((await send(buildApp(plain), "POST", "/api/automations", rule)).status).toBe(403);
    expect((await send(buildApp(manager), "GET", "/api/automations")).status).toBe(403);
    expect((await send(buildApp(admin), "GET", "/api/automations")).status).toBe(200);
    expect((await send(buildApp(admin), "POST", "/api/automations", rule)).status).toBe(201);
  });

  it("rejeita regra inválida e usuário inexistente na ação", async () => {
    expect((await send(buildApp(admin), "POST", "/api/automations", { ...rule, actions: [] })).status).toBe(400);
    storage.getUser.mockResolvedValue(undefined);
    const res = await send(buildApp(admin), "POST", "/api/automations", { ...rule, actions: [{ type: "set_assignee", value: "fantasma" }] });
    expect(res.status).toBe(400);
  });

  it("ligar/desligar mescla com a regra gravada", async () => {
    storage.getAutomationRule.mockResolvedValue({ id: "r", ...rule, active: true, timeoutDays: null, sortOrder: 0 });
    storage.updateAutomationRule.mockImplementation(async (_id: string, d: any) => ({ id: "r", ...d }));
    const res = await send(buildApp(admin), "PUT", "/api/automations/r", { active: false });
    expect(res.status).toBe(200);
    expect(storage.updateAutomationRule.mock.calls[0][1]).toMatchObject({ active: false, name: "Bug crítico" });
  });
});

describe("automações — execução", () => {
  const groups = [{ key: "suporte", memberIds: ["ana"] }];
  const ticket = {
    id: "t1", code: "CHA-1", title: "Erro", tenantId: null, type: "bug", category: "suporte", impact: "medio",
    status: "open", assigneeId: null, requesterId: "req",
  } as any;

  it("aplica o patch, grava a nota interna e notifica o novo responsável", async () => {
    storage.getAutomationRules.mockResolvedValue([
      { name: "Atribuir", active: true, trigger: "ticket_created", conditions: {}, actions: [{ type: "set_assignee", value: "ana" }], sortOrder: 0 },
    ]);
    storage.getSupportGroups.mockResolvedValue(groups);
    storage.updateTicket.mockImplementation(async (_id: string, d: any) => ({ ...ticket, ...d }));
    const out = await runTicketAutomations(storage as any, "ticket_created", ticket, { actorId: "req" });
    expect(out.assigneeId).toBe("ana");
    expect(storage.createTicketComment.mock.calls[0][0]).toMatchObject({ isInternal: true, userId: "req" });
    expect(storage.createNotification.mock.calls[0][0]).toMatchObject({ userId: "ana" });
  });

  it("sem regras não mexe no chamado", async () => {
    storage.getAutomationRules.mockResolvedValue([]);
    const out = await runTicketAutomations(storage as any, "ticket_created", ticket);
    expect(out).toBe(ticket);
    expect(storage.updateTicket).not.toHaveBeenCalled();
  });

  it("cron: só a regra cujo prazo venceu roda para os chamados devolvidos", async () => {
    const curta = { name: "3 dias", active: true, trigger: "waiting_requester_timeout", timeoutDays: 3, conditions: {},
      actions: [{ type: "set_status", value: "resolved" }], sortOrder: 0 };
    const longa = { ...curta, name: "10 dias", timeoutDays: 10, actions: [{ type: "set_status", value: "closed" }] };
    storage.getAutomationRules.mockResolvedValue([curta, longa]);
    storage.getSupportGroups.mockResolvedValue(groups);
    const waiting = { ...ticket, status: "waiting_requester", assigneeId: "ana", slaPausadoEm: new Date(), slaPausaMinutos: 0 };
    storage.getTicketsWaitingRequesterSince.mockImplementation(async (days: number) => (days === 3 ? [waiting] : []));
    storage.updateTicket.mockImplementation(async (_id: string, d: any) => ({ ...waiting, ...d }));

    const touched = await runWaitingRequesterTimeouts(storage as any);
    expect(touched).toBe(1);
    expect(storage.getTicketsWaitingRequesterSince).toHaveBeenCalledWith(3);
    expect(storage.getTicketsWaitingRequesterSince).toHaveBeenCalledWith(10);
    expect(storage.updateTicket).toHaveBeenCalledTimes(1);
    expect(storage.updateTicket.mock.calls[0][1]).toMatchObject({ status: "resolved", slaPausadoEm: null });
    // Sem pessoa por trás: a nota fica em nome do responsável.
    expect(storage.createTicketComment.mock.calls[0][0].userId).toBe("ana");
  });
});
