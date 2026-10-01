import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const storage = {
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getTicketCustomFields: vi.fn(),
  getTicketCustomField: vi.fn(),
  createTicketCustomField: vi.fn(),
  updateTicketCustomField: vi.fn(),
  deleteTicketCustomField: vi.fn(),
  getActiveSupportGroupByKey: vi.fn(),
  findResponsavelForTicket: vi.fn(),
  createTicket: vi.fn(),
  getTicket: vi.fn(),
  updateTicket: vi.fn(),
  getUser: vi.fn(),
  createNotification: vi.fn(),
};

vi.mock("../lib/storage", () => ({ getStorage: () => storage }));
vi.mock("../lib/email", () => {
  const ok = () => vi.fn().mockResolvedValue(undefined);
  return {
    sendTicketCreatedEmail: ok(), sendTicketAssignedEmail: ok(), sendTicketStatusChangedEmail: ok(),
    sendTicketCommentEmail: ok(), sendMentionNotificationEmail: ok(), sendCSATReceivedEmail: ok(),
  };
});

const { ticketFields } = await import("./ticket-fields");
const { tickets } = await import("./tickets");

const TREE = [{ label: "Pedidos", actions: [{ label: "Cancelar", details: [] }] }];
const FIELD = { id: "f1", groupKey: "financeiro", label: "Pedido", fieldType: "text", options: [], required: true, active: true, sortOrder: 0 };

function buildApp(user: { userId: string; role?: string; modulePermissions?: unknown }) {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", { tenantId: null, role: "user", ...user });
    c.set("db", {});
    await next();
  });
  app.route("/", ticketFields);
  app.route("/", tickets);
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

beforeEach(() => {
  vi.clearAllMocks();
  storage.getSetting.mockResolvedValue({ key: "request_objects", value: JSON.stringify(TREE) });
  storage.setSetting.mockResolvedValue({});
  storage.getTicketCustomFields.mockResolvedValue([FIELD]);
  storage.getActiveSupportGroupByKey.mockResolvedValue({ key: "financeiro", active: true });
  storage.findResponsavelForTicket.mockResolvedValue(null);
  storage.createTicket.mockImplementation(async (data: any) => ({ id: "t1", code: "CHA-1", ...data }));
  storage.createTicketCustomField.mockImplementation(async (data: any) => ({ id: "new", ...data }));
  storage.getUser.mockImplementation(async (id: string) => ({ id, name: id }));
  storage.createNotification.mockResolvedValue(undefined);
});

describe("permissão para gerenciar os campos", () => {
  it("qualquer usuário logado lê a árvore e os campos", async () => {
    const res = await send(buildApp(plain), "GET", "/api/ticket-fields/request-objects");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TREE);
    expect((await send(buildApp(plain), "GET", "/api/ticket-fields/custom")).status).toBe(200);
  });

  it("sem a permissão não altera nada", async () => {
    const app = buildApp(plain);
    expect((await send(app, "PUT", "/api/ticket-fields/request-objects", TREE)).status).toBe(403);
    expect((await send(app, "POST", "/api/ticket-fields/custom", { groupKey: "financeiro", label: "X", fieldType: "text" })).status).toBe(403);
    expect((await send(app, "DELETE", "/api/ticket-fields/custom/f1")).status).toBe(403);
    expect(storage.setSetting).not.toHaveBeenCalled();
    expect(storage.createTicketCustomField).not.toHaveBeenCalled();
  });

  it("só admin altera (a permissão avulsa antiga não vale)", async () => {
    expect((await send(buildApp(manager), "PUT", "/api/ticket-fields/request-objects", TREE)).status).toBe(403);
    const res = await send(buildApp(admin), "PUT", "/api/ticket-fields/request-objects", [{ label: " Users ", actions: [] }]);
    expect(res.status).toBe(200);
    expect(storage.setSetting).toHaveBeenCalledWith("request_objects", JSON.stringify([{ label: "Users", actions: [] }]));

    const created = await send(buildApp(admin), "POST", "/api/ticket-fields/custom", { groupKey: "financeiro", label: "Loja", fieldType: "text" });
    expect(created.status).toBe(201);
  });

  it("árvore inválida volta 400 com a mensagem", async () => {
    const res = await send(buildApp(admin), "PUT", "/api/ticket-fields/request-objects", [{ label: "A" }, { label: "A" }]);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toContain("repetido");
  });

  it("não cria campo em grupo inexistente nem muda o tipo de um campo", async () => {
    storage.getActiveSupportGroupByKey.mockResolvedValue(undefined);
    expect((await send(buildApp(admin), "POST", "/api/ticket-fields/custom", { groupKey: "x", label: "A", fieldType: "text" })).status).toBe(400);
    storage.getTicketCustomField.mockResolvedValue(FIELD);
    const res = await send(buildApp(admin), "PUT", "/api/ticket-fields/custom/f1", { fieldType: "number" });
    expect(res.status).toBe(400);
    expect(storage.updateTicketCustomField).not.toHaveBeenCalled();
  });
});

describe("abertura e edição de chamados com os campos editáveis", () => {
  // Igual ao que /chamados/novo envia (code vazio: o storage gera o CHA-xxxx).
  const base = { title: "Teste", description: "d", category: "financeiro", type: "requisicao", code: "", status: "open" };

  it("valida o Objeto da Requisição contra a árvore gravada", async () => {
    const bad = await send(buildApp(plain), "POST", "/api/tickets", { ...base, requestObject: "Service Requests", customFields: { f1: "1" } });
    expect(bad.status).toBe(400);
    const ok = await send(buildApp(plain), "POST", "/api/tickets", { ...base, requestObject: "Pedidos", requestAction: "Cancelar", customFields: { f1: "1" } });
    expect(ok.status).toBe(201);
  });

  it("exige os campos obrigatórios do grupo na abertura e grava os valores", async () => {
    const res = await send(buildApp(plain), "POST", "/api/tickets", base);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('Preencha o campo "Pedido"');

    const ok = await send(buildApp(plain), "POST", "/api/tickets", { ...base, customFields: { f1: " 42 ", intruso: "x" } });
    expect(ok.status).toBe(201);
    expect(storage.createTicket.mock.calls[0][0].customFields).toEqual({ f1: "42" });
  });

  it("chamado antigo com valor que saiu da árvore continua editável", async () => {
    storage.getTicket.mockResolvedValue({
      id: "t1", tenantId: null, requesterId: "u1", assigneeId: null, category: "financeiro",
      requestObject: "Service Requests", requestAction: "Cancelar", requestDetail: null, customFields: { f1: "1" },
    });
    storage.updateTicket.mockImplementation(async (_id: string, data: any) => ({ id: "t1", tenantId: null, ...data }));
    const res = await send(buildApp(plain), "PATCH", "/api/tickets/t1", {
      title: "novo", requestObject: "Service Requests", requestAction: "Cancelar", requestDetail: null,
    });
    expect(res.status).toBe(200);

    const changed = await send(buildApp(plain), "PATCH", "/api/tickets/t1", { requestAction: "Outra" });
    expect(changed.status).toBe(400);
  });

  it("na edição mescla os valores e não exige obrigatório se o grupo não muda", async () => {
    // Quem edita campos do atendimento é técnico (Usuário só edita título, descrição e anexos).
    storage.getUser.mockImplementation(async (id: string) => ({ id, name: id, status: "active", isTechnician: true }));
    storage.getTicket.mockResolvedValue({
      id: "t1", tenantId: null, requesterId: "u1", assigneeId: null, category: "financeiro", customFields: { f1: "1", velho: "x" },
    });
    storage.updateTicket.mockImplementation(async (_id: string, data: any) => ({ id: "t1", tenantId: null, ...data }));
    const res = await send(buildApp(plain), "PATCH", "/api/tickets/t1", { customFields: { f1: "" } });
    expect(res.status).toBe(200);
    expect(storage.updateTicket.mock.calls[0][1].customFields).toEqual({ velho: "x" });
  });
});
