import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "./auth";

function buildApp() {
  const app = new Hono<any>();
  app.use("*", authMiddleware);
  app.all("*", (c) => c.body(null, 204));
  return app;
}

const env = (overrides: Record<string, unknown> = {}) => ({ JWT_SECRET: "test-secret", ...overrides });

describe("authMiddleware", () => {
  it.each([
    ["POST", "/api/integrations/relatorio-pedidos/test-connection"],
    ["GET", "/api/integrations/relatorio-pedidos/orders/advanced?customer_cpf=1"],
    ["GET", "/api/avaliacoes-ia/resumo"],
    ["GET", "/api/avaliacoes-ia/imei"],
    ["GET", "/api/estoques"],
  ])("%s %s exige login", async (method, path) => {
    const res = await buildApp().request(path, { method }, env());
    expect(res.status).toBe(401);
  });

  it("claude-code-usage recusa quando o segredo não está configurado", async () => {
    const res = await buildApp().request("/api/git-analytics/claude-code-usage", { method: "POST" }, env());
    expect(res.status).toBe(401);
  });

  it("claude-code-usage aceita o segredo correto e recusa o errado", async () => {
    const ok = await buildApp().request(
      "/api/git-analytics/claude-code-usage",
      { method: "POST", headers: { "X-Claude-Usage-Secret": "s3cret" } },
      env({ CLAUDE_USAGE_SECRET: "s3cret" }),
    );
    expect(ok.status).toBe(204);
    const bad = await buildApp().request(
      "/api/git-analytics/claude-code-usage",
      { method: "POST", headers: { "X-Claude-Usage-Secret": "outro" } },
      env({ CLAUDE_USAGE_SECRET: "s3cret" }),
    );
    expect(bad.status).toBe(401);
  });

  it("login continua público", async () => {
    const res = await buildApp().request("/api/auth/login", { method: "POST" }, env());
    expect(res.status).toBe(204);
  });
});
