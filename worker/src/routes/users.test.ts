import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const storage = {
  createUser: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
};
vi.mock("../lib/storage", () => ({ getStorage: () => storage }));
vi.mock("../lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const { users } = await import("./users");

function buildApp() {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", { userId: "admin-1", role: "admin" });
    c.set("db", {});
    await next();
  });
  app.route("/", users);
  return app;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  storage.createUser.mockImplementation(async (data: any) => ({ id: "u1", ...data, password: "pbkdf2:..." }));
  storage.updateUser.mockImplementation(async (id: string, data: any) => ({ id, name: "U", ...data, password: "pbkdf2:..." }));
  storage.getUser.mockResolvedValue({ id: "u1", name: "U", email: "u@x.com" });
});

describe("Worker /api/users", () => {
  it("POST não devolve a senha", async () => {
    const res = await buildApp().request("/api/users", json("POST", { name: "U", email: "u@x.com", password: "segredo" }));
    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("password");
  });

  it("PATCH não devolve a senha", async () => {
    const res = await buildApp().request("/api/users/u1", json("PATCH", { password: "nova" }));
    expect(await res.json()).not.toHaveProperty("password");
  });

  it("reset gera senha temporária de 12 caracteres", async () => {
    const res = await buildApp().request("/api/users/u1/reset-password", { method: "POST" });
    const body = (await res.json()) as any;
    expect(body.temporaryPassword).toHaveLength(12);
    expect(storage.updateUser).toHaveBeenCalledWith("u1", { password: body.temporaryPassword });
  });
});
