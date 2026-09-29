import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const storage = {
  getTicket: vi.fn(),
  getTicketComments: vi.fn(),
  createTicketComment: vi.fn(),
  updateTicket: vi.fn(),
  getUser: vi.fn(),
  getUsers: vi.fn(),
  createNotification: vi.fn(),
};

vi.mock("../lib/storage", () => ({ getStorage: () => storage }));
vi.mock("../lib/email", () => ({
  sendTicketCreatedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketAssignedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketStatusChangedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketCommentEmail: vi.fn().mockResolvedValue(undefined),
  sendMentionNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCSATReceivedEmail: vi.fn().mockResolvedValue(undefined),
}));

const { tickets } = await import("./tickets");

const TICKET = {
  id: "t1",
  title: "Notebook não liga",
  requesterId: "req-1",
  assigneeId: "tech-1",
  dataPrimeiraResposta: null,
};

const COMMENTS = [
  { id: "c1", content: "pública", isInternal: false },
  { id: "c2", content: "nota interna", isInternal: true },
];

function buildApp(userId: string, role = "user") {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", { userId, role });
    c.set("db", {});
    await next();
  });
  app.route("/", tickets);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.getTicket.mockResolvedValue(TICKET);
  storage.getTicketComments.mockResolvedValue(COMMENTS);
  storage.createTicketComment.mockImplementation(async (data: any) => ({ id: "new", ...data }));
  storage.getUser.mockImplementation(async (id: string) => ({ id, name: id }));
  storage.getUsers.mockResolvedValue([]);
  storage.createNotification.mockResolvedValue(undefined);
  storage.updateTicket.mockResolvedValue(TICKET);
});

describe("Worker GET /api/tickets/:id/comments", () => {
  it("solicitante não recebe notas internas", async () => {
    const res = await buildApp("req-1").request("/api/tickets/t1/comments");
    expect(res.status).toBe(200);
    expect(((await res.json()) as any[]).map((c: any) => c.id)).toEqual(["c1"]);
  });

  it("responsável e admin recebem notas internas", async () => {
    const tech = await buildApp("tech-1").request("/api/tickets/t1/comments");
    expect(((await tech.json()) as any[]).map((c: any) => c.id)).toEqual(["c1", "c2"]);
    const admin = await buildApp("admin-1", "admin").request("/api/tickets/t1/comments");
    expect(((await admin.json()) as any[]).map((c: any) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("Worker POST /api/tickets/:id/comments", () => {
  const post = (userId: string, body: unknown) =>
    buildApp(userId).request("/api/tickets/t1/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("solicitante não consegue marcar comentário como interno", async () => {
    const res = await post("req-1", { content: "oi", isInternal: true });
    expect(res.status).toBe(201);
    expect(storage.createTicketComment.mock.calls[0][0].isInternal).toBe(false);
  });

  it("nota interna do responsável não notifica o solicitante nem conta como primeira resposta", async () => {
    await post("tech-1", { content: "investigando", isInternal: true });
    expect(storage.createTicketComment.mock.calls[0][0].isInternal).toBe(true);
    expect(storage.updateTicket).not.toHaveBeenCalled();
    expect(storage.createNotification.mock.calls.map((call) => call[0].userId)).not.toContain("req-1");
  });
});
