import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerWorkspaceRoutes } from "./workspace";

// ─── Mock auth middleware ──────────────────────────────────────────────────────
// requireAuth is bypassed; getSessionUser returns a fake admin user.
vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  getSessionUser: () => ({ userId: "test-user-1", isAdmin: true }),
}));

// ─── Mock storage ──────────────────────────────────────────────────────────────
// All values are inlined — vi.mock factories are hoisted to the top of the file.
vi.mock("../storage", () => ({
  storage: {
    getTickets: vi.fn().mockResolvedValue([]),
    getTicketsForWorkspace: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
    getSlaRules: vi.fn().mockResolvedValue([]),
    createTicket: vi.fn().mockResolvedValue({
      id: 1,
      code: "CHA-0001",
      title: "Test ticket",
      category: "geral",
      type: "bug",
      priority: "medium",
      status: "open",
      assigneeId: null,
      dataAbertura: new Date().toISOString(),
      dataResolucao: null,
      createdAt: new Date().toISOString(),
    }),
  },
}));

// ─── Mock db ───────────────────────────────────────────────────────────────────
// Routes use both:
//   await db.select().from(table)              (simple await)
//   await db.select().from(table).where().limit(1)  (chained)
// We make the .from() return value thenable AND support .where().limit().
vi.mock("../db", () => {
  const buildSelectMock = () => {
    const fromResult: any = {
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockResolvedValue([]),
      })),
    };
    // Make fromResult itself awaitable (PromiseLike) resolving to []
    fromResult.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve([]).then(onFulfilled, onRejected);

    return { from: vi.fn().mockReturnValue(fromResult) };
  };

  return {
    db: {
      select: vi.fn().mockImplementation(buildSelectMock),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "tarefa-1",
              codigo: "TAR-0001",
              titulo: "Test tarefa",
              status: "a-fazer",
              prioridade: "media",
              responsavelId: null,
              projetoId: null,
              criadoEm: new Date().toISOString(),
            },
          ]),
        }),
      }),
    },
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeMockTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: "CHA-0001",
    title: "Test ticket",
    category: "geral",
    type: "bug",
    priority: "medium",
    status: "open",
    assigneeId: null,
    dataAbertura: new Date().toISOString(),
    dataResolucao: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildSelectMock(rows: unknown[] = []) {
  const fromResult: any = {
    where: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockResolvedValue(rows),
    })),
  };
  fromResult.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(rows).then(onFulfilled, onRejected);
  return { from: vi.fn().mockReturnValue(fromResult) };
}

function createApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerWorkspaceRoutes(router);
  app.use(router);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Workspace Routes", () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-apply default mock implementations after clearAllMocks
    const storageMod = await import("../storage");
    const { storage } = storageMod as any;
    storage.getTickets.mockResolvedValue([]);
    storage.getUsers.mockResolvedValue([]);
    storage.getSlaRules.mockResolvedValue([]);
    storage.createTicket.mockResolvedValue(makeMockTicket());

    const dbMod = await import("../db");
    const { db } = dbMod as any;
    db.select.mockImplementation(() => buildSelectMock([]));
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "tarefa-1",
            codigo: "TAR-0001",
            titulo: "Test tarefa",
            status: "a-fazer",
            prioridade: "media",
            responsavelId: null,
            projetoId: null,
            criadoEm: new Date().toISOString(),
          },
        ]),
      }),
    });

    app = createApp();
  });

  // ── 1. GET /api/workspace/chamados → 200 with kpis and items ─────────────────
  it("GET /api/workspace/chamados returns 200 with kpis and items", async () => {
    const res = await request(app).get("/api/workspace/chamados");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("kpis");
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  // ── 2. GET /api/workspace/chamados?periodo=mes-vigente → 200, filtered ────────
  it("GET /api/workspace/chamados?periodo=mes-vigente returns 200 with filtered data", async () => {
    const res = await request(app).get(
      "/api/workspace/chamados?periodo=mes-vigente"
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("kpis");
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  // ── 3. GET /api/workspace/projetos → 200 with kpis and projetos array ─────────
  it("GET /api/workspace/projetos returns 200 with kpis and projetos", async () => {
    const res = await request(app).get("/api/workspace/projetos");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("kpis");
    expect(res.body).toHaveProperty("projetos");
    expect(Array.isArray(res.body.projetos)).toBe(true);
  });

  // ── 4. GET /api/workspace/todos → 200, each item has tipo field ───────────────
  it("GET /api/workspace/todos returns 200 and each item has a tipo field", async () => {
    const storageMod = await import("../storage");
    const { storage } = storageMod as any;
    // Return one ticket so the items array is non-empty
    storage.getTickets.mockResolvedValue([makeMockTicket()]);

    const res = await request(app).get("/api/workspace/todos");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const item of res.body.items) {
      expect(item).toHaveProperty("tipo");
    }
  });

  // ── 5. POST /api/workspace/chamados with empty titulo → 400 ───────────────────
  it("POST /api/workspace/chamados with empty titulo returns 400", async () => {
    const res = await request(app)
      .post("/api/workspace/chamados")
      .send({ titulo: "" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  // ── 6. POST /api/workspace/chamados with valid titulo → 201 with codigo ────────
  it("POST /api/workspace/chamados with valid titulo returns 201 with codigo", async () => {
    const res = await request(app)
      .post("/api/workspace/chamados")
      .send({ titulo: "Test ticket" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("codigo");
    expect(typeof res.body.codigo).toBe("string");
  });
});
