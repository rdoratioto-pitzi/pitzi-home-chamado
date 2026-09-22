import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { registerAuthRoutes } from "./auth";
import { storage } from "../storage";
import { hashPassword } from "@shared/password";

vi.mock("../email-service", () => ({ sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../storage", () => ({
  storage: {
    getUsers: vi.fn(),
    getUserByEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}));

const mocked = storage as unknown as Record<string, ReturnType<typeof vi.fn>>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test", resave: false, saveUninitialized: false }));
  const router = express.Router();
  registerAuthRoutes(router);
  app.use(router);
  return app;
}

const baseUser = { id: "u1", name: "U", email: "u@x.com", status: "active", isAdmin: false, modulePermissions: "{}" };
let ip = 0;
// O limitador de login é por IP: cada teste usa um IP diferente.
const login = (body: object) =>
  request(buildApp()).post("/api/auth/login").set("X-Forwarded-For", `10.0.0.${++ip}`).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.updateUser.mockResolvedValue(undefined);
});

describe("POST /api/auth/login (Express)", () => {
  it("aceita senha com hash PBKDF2", async () => {
    mocked.getUsers.mockResolvedValue([{ ...baseUser, password: await hashPassword("certa") }]);
    const res = await login({ email: "u@x.com", password: "certa" });
    expect(res.status).toBe(200);
    expect(mocked.updateUser).not.toHaveBeenCalled();
  });

  it("recusa senha errada", async () => {
    mocked.getUsers.mockResolvedValue([{ ...baseUser, password: await hashPassword("certa") }]);
    const res = await login({ email: "u@x.com", password: "errada" });
    expect(res.status).toBe(401);
  });

  it("migra senha legada em texto puro para hash", async () => {
    mocked.getUsers.mockResolvedValue([{ ...baseUser, password: "antiga" }]);
    const res = await login({ email: "u@x.com", password: "antiga" });
    expect(res.status).toBe(200);
    const saved = mocked.updateUser.mock.calls[0][1].password as string;
    expect(saved.startsWith("pbkdf2:")).toBe(true);
  });

  it("recusa usuário sem senha (ex.: usuários fictícios de fallback)", async () => {
    mocked.getUsers.mockResolvedValue([{ ...baseUser, password: "" }]);
    const res = await login({ email: "u@x.com", password: "qualquer" });
    expect(res.status).toBe(401);
  });
});
