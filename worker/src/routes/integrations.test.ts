import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const storage = { createLogisticaReversaEvento: vi.fn() };
vi.mock("../lib/storage", () => ({ getStorage: () => storage }));

const { integrations } = await import("./integrations");

function buildApp() {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("db", {});
    await next();
  });
  app.route("/", integrations);
  return app;
}

const post = (headers: Record<string, string>, env: Record<string, unknown>) =>
  buildApp().request(
    "/api/logistica-reversa/eventos",
    { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" },
    env,
  );

beforeEach(() => vi.clearAllMocks());

describe("POST /api/logistica-reversa/eventos", () => {
  it("recusa quando LOGISTICA_WEBHOOK_SECRET não está configurado", async () => {
    const res = await post({}, {});
    expect(res.status).toBe(401);
    expect(storage.createLogisticaReversaEvento).not.toHaveBeenCalled();
  });

  it("recusa segredo errado", async () => {
    const res = await post({ "X-Webhook-Secret": "errado" }, { LOGISTICA_WEBHOOK_SECRET: "certo" });
    expect(res.status).toBe(401);
    expect(storage.createLogisticaReversaEvento).not.toHaveBeenCalled();
  });

  it("com segredo correto segue para a validação do payload", async () => {
    const res = await post({ "X-Webhook-Secret": "certo" }, { LOGISTICA_WEBHOOK_SECRET: "certo" });
    expect(res.status).not.toBe(401);
  });
});
