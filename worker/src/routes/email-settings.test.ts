// Configurações → E-mail: permissão e validação das rotas.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { DEFAULT_EMAIL_SETTINGS } from "../../../shared/email-settings";

const storage = {
  getSetting: vi.fn(async () => undefined),
  setSetting: vi.fn(async (key: string, value: string) => ({ key, value })),
  getUser: vi.fn(),
};
vi.mock("../lib/storage", () => ({ getStorage: () => storage }));

const { emailSettings } = await import("./email-settings");

function app(role: "admin" | "user", modulePermissions?: unknown) {
  const a = new Hono<any>();
  a.use("*", async (c, next) => {
    c.set("user", { userId: "u1", tenantId: null, role, modulePermissions });
    c.set("db", {});
    await next();
  });
  a.route("/", emailSettings);
  return a;
}
const env = { APP_URL: "https://app.test", GMAIL_SENDER: "chamados@pitzi.com.br" };
const put = (a: Hono<any>, body: unknown) =>
  a.request("/api/email/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env);

beforeEach(() => vi.clearAllMocks());

describe("rotas de e-mail", () => {
  it("usuário comum não vê nem altera", async () => {
    const a = app("user");
    expect((await a.request("/api/email/settings", {}, env)).status).toBe(403);
    expect((await a.request("/api/email/status", {}, env)).status).toBe(403);
    expect((await put(a, DEFAULT_EMAIL_SETTINGS)).status).toBe(403);
    expect((await a.request("/api/email/outbox", {}, env)).status).toBe(403);
    expect((await a.request("/api/email/test", { method: "POST" }, env)).status).toBe(403);
    expect(storage.setSetting).not.toHaveBeenCalled();
  });

  it("quem tem a permissão de campos dos chamados lê os padrões e salva", async () => {
    const a = app("user", JSON.stringify({ campos_chamado: true }));
    const res = await a.request("/api/email/settings", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.settings).toEqual(DEFAULT_EMAIL_SETTINGS);

    const changed = structuredClone(DEFAULT_EMAIL_SETTINGS);
    changed.events.status_changed.enabled = false;
    expect((await put(a, changed)).status).toBe(200);
    expect(storage.setSetting).toHaveBeenCalledWith("email_settings", expect.stringContaining('"status_changed":{"enabled":false'));
  });

  it("admin: configuração inválida é recusada; situação mostra o transporte sem segredos", async () => {
    const a = app("admin");
    const bad = structuredClone(DEFAULT_EMAIL_SETTINGS);
    bad.events.ticket_created.body = "";
    const res = await put(a, bad);
    expect(res.status).toBe(400);
    expect(storage.setSetting).not.toHaveBeenCalled();

    const status = (await (await a.request("/api/email/status", {}, env)).json()) as any;
    expect(status).toMatchObject({ provider: null, configured: false, sender: "chamados@pitzi.com.br" });
    expect(JSON.stringify(status)).not.toMatch(/PRIVATE KEY/);
  });
});
