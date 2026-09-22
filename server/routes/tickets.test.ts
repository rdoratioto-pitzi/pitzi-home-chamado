import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerTicketRoutes } from "./tickets";
import { storage } from "../storage";

// Usuário da requisição vem dos headers de teste.
vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  getSessionUser: (req: any) => ({
    userId: req.headers["x-test-user"],
    isAdmin: req.headers["x-test-admin"] === "true",
  }),
}));

vi.mock("../email-service", () => ({
  sendTicketCreatedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketAssignedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketStatusChangedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketCommentEmail: vi.fn().mockResolvedValue(undefined),
  sendMentionNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCSATReceivedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../storage", () => ({
  storage: {
    getTicket: vi.fn(),
    getTicketComments: vi.fn(),
    createTicketComment: vi.fn(),
    updateTicket: vi.fn(),
    getUser: vi.fn(),
    getUsers: vi.fn(),
    createNotification: vi.fn(),
  },
}));

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

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerTicketRoutes(router);
  app.use(router);
  return app;
}

const mocked = storage as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getTicket.mockResolvedValue(TICKET);
  mocked.getTicketComments.mockResolvedValue(COMMENTS);
  mocked.createTicketComment.mockImplementation(async (data: any) => ({ id: "new", ...data }));
  mocked.getUser.mockImplementation(async (id: string) => ({ id, name: id, isAdmin: false }));
  mocked.getUsers.mockResolvedValue([]);
  mocked.createNotification.mockResolvedValue(undefined);
  mocked.updateTicket.mockResolvedValue(TICKET);
});

describe("GET /api/tickets/:id/comments", () => {
  it("solicitante não recebe notas internas", async () => {
    const res = await request(buildApp()).get("/api/tickets/t1/comments").set("x-test-user", "req-1");
    expect(res.status).toBe(200);
    expect(res.body.map((c: any) => c.id)).toEqual(["c1"]);
  });

  it("responsável recebe notas internas", async () => {
    const res = await request(buildApp()).get("/api/tickets/t1/comments").set("x-test-user", "tech-1");
    expect(res.body.map((c: any) => c.id)).toEqual(["c1", "c2"]);
  });

  it("admin recebe notas internas", async () => {
    const res = await request(buildApp())
      .get("/api/tickets/t1/comments")
      .set("x-test-user", "admin-1")
      .set("x-test-admin", "true");
    expect(res.body.map((c: any) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("POST /api/tickets/:id/comments", () => {
  it("solicitante não consegue marcar comentário como interno", async () => {
    const res = await request(buildApp())
      .post("/api/tickets/t1/comments")
      .set("x-test-user", "req-1")
      .send({ content: "oi", isInternal: true });
    expect(res.status).toBe(201);
    expect(mocked.createTicketComment.mock.calls[0][0].isInternal).toBe(false);
  });

  it("nota interna do responsável não notifica o solicitante nem conta como primeira resposta", async () => {
    const res = await request(buildApp())
      .post("/api/tickets/t1/comments")
      .set("x-test-user", "tech-1")
      .send({ content: "investigando", isInternal: true });
    expect(res.status).toBe(201);
    expect(mocked.createTicketComment.mock.calls[0][0].isInternal).toBe(true);
    expect(mocked.updateTicket).not.toHaveBeenCalled();
    const notified = mocked.createNotification.mock.calls.map((call) => call[0].userId);
    expect(notified).not.toContain("req-1");
  });

  it("comentário público do responsável registra primeira resposta e notifica o solicitante", async () => {
    await request(buildApp())
      .post("/api/tickets/t1/comments")
      .set("x-test-user", "tech-1")
      .send({ content: "já estou vendo" });
    expect(mocked.updateTicket).toHaveBeenCalledWith("t1", expect.objectContaining({ dataPrimeiraResposta: expect.any(Date) }));
    const notified = mocked.createNotification.mock.calls.map((call) => call[0].userId);
    expect(notified).toContain("req-1");
  });
});
