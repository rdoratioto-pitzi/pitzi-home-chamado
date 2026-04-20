import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { Router } from "express";

vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  getSessionUser: (req: any) => ({
    userId: req.headers["x-test-user"] as string,
    isAdmin: req.headers["x-test-admin"] === "true",
  }),
}));

const getUserMock = vi.fn();

vi.mock("../storage", () => ({
  storage: {
    getUser: (id: string) => getUserMock(id),
    getObjectives: vi.fn().mockResolvedValue([
      { id: "o1", title: "Obj 1", ownerId: "user-owner", cycle: "2026 Q2", level: "company", closedAt: null, parentOkrId: null },
      { id: "o2", title: "Obj 2", ownerId: "user-owner", cycle: "2026 Q2", level: "company", closedAt: null, parentOkrId: null },
    ]),
    getKeyResults: vi.fn().mockResolvedValue([]),
    getKRsWithCheckins: vi.fn().mockResolvedValue(new Set()),
    getInitiatives: vi.fn().mockResolvedValue([]),
  },
}));

import { registerOkrRoutes } from "./okrs";

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = Router();
  registerOkrRoutes(router);
  app.use(router);
  return app;
}

beforeEach(() => {
  getUserMock.mockReset();
});

describe("GET /api/objectives — visibility by module permission", () => {
  it("returns 403 when non-admin user has okrs=false", async () => {
    getUserMock.mockResolvedValue({
      id: "kyzzi",
      isAdmin: false,
      modulePermissions: JSON.stringify({ okrs: false }),
    });
    const res = await request(buildApp())
      .get("/api/objectives")
      .set("x-test-user", "kyzzi")
      .set("x-test-admin", "false");
    expect(res.status).toBe(403);
  });

  it("returns all objectives for non-admin with okrs=true (no owner filter)", async () => {
    getUserMock.mockResolvedValue({
      id: "kyzzi",
      isAdmin: false,
      modulePermissions: JSON.stringify({ okrs: true }),
    });
    const res = await request(buildApp())
      .get("/api/objectives")
      .set("x-test-user", "kyzzi")
      .set("x-test-admin", "false");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((o: any) => o.id)).toEqual(["o1", "o2"]);
  });

  it("returns all objectives for admin regardless of modulePermissions", async () => {
    getUserMock.mockResolvedValue({
      id: "admin",
      isAdmin: true,
      modulePermissions: JSON.stringify({ okrs: false }),
    });
    const res = await request(buildApp())
      .get("/api/objectives")
      .set("x-test-user", "admin")
      .set("x-test-admin", "true");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns 403 when user record is missing", async () => {
    getUserMock.mockResolvedValue(undefined);
    const res = await request(buildApp())
      .get("/api/objectives")
      .set("x-test-user", "ghost")
      .set("x-test-admin", "false");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/key-results — permission gate", () => {
  it("403 without permission", async () => {
    getUserMock.mockResolvedValue({
      id: "kyzzi",
      isAdmin: false,
      modulePermissions: JSON.stringify({ okrs: false }),
    });
    const res = await request(buildApp())
      .get("/api/key-results")
      .set("x-test-user", "kyzzi")
      .set("x-test-admin", "false");
    expect(res.status).toBe(403);
  });

  it("200 with permission", async () => {
    getUserMock.mockResolvedValue({
      id: "kyzzi",
      isAdmin: false,
      modulePermissions: JSON.stringify({ okrs: true }),
    });
    const res = await request(buildApp())
      .get("/api/key-results")
      .set("x-test-user", "kyzzi")
      .set("x-test-admin", "false");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/initiatives — permission gate", () => {
  it("403 without permission", async () => {
    getUserMock.mockResolvedValue({
      id: "kyzzi",
      isAdmin: false,
      modulePermissions: JSON.stringify({ okrs: false }),
    });
    const res = await request(buildApp())
      .get("/api/initiatives")
      .set("x-test-user", "kyzzi")
      .set("x-test-admin", "false");
    expect(res.status).toBe(403);
  });
});
