// Integração: redefinição de senha por link. Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL
// com as migrations aplicadas); cria e apaga usuários @reset-test.local.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";
import { hashPassword, verifyPassword } from "../../../shared/password";

const sendLink = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/email", () => ({ sendPasswordResetLinkEmail: sendLink }));

const { auth } = await import("./auth");
const url = process.env.TEST_DATABASE_URL;
const env = { APP_URL: "https://app.test", JWT_SECRET: "s", JWT_REFRESH_SECRET: "r" };

describe.skipIf(!url)("redefinição de senha", () => {
  let pool: pg.Pool;
  let db: any;
  let userId: string;

  const app = () => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    a.route("/", auth);
    return a;
  };
  const post = (path: string, body: unknown) =>
    app().request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env);
  const storedPassword = async () => (await pool.query("SELECT password FROM users WHERE id = $1", [userId])).rows[0].password;
  const tokenFromEmail = () => new URL(sendLink.mock.calls.at(-1)![2]).searchParams.get("token")!;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    sendLink.mockClear();
    await pool.query("DELETE FROM users WHERE email LIKE '%@reset-test.local'");
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, status, password) VALUES ('R', 'r@reset-test.local', 'active', $1) RETURNING id",
      [await hashPassword("senha-antiga")],
    );
    userId = rows[0].id;
  });
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@reset-test.local'");
    await pool?.end();
  });

  it("pedido não altera a senha e envia link", async () => {
    const before = await storedPassword();
    const res = await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    expect(res.status).toBe(200);
    expect(await storedPassword()).toBe(before);
    expect(sendLink).toHaveBeenCalledTimes(1);
    expect(sendLink.mock.calls[0][2]).toMatch(/^https:\/\/app\.test\/redefinir-senha\?token=/);
  });

  it("e-mail inexistente recebe a mesma resposta e nenhum envio", async () => {
    const res = await post("/api/auth/forgot-password", { email: "ninguem@reset-test.local" });
    expect(((await res.json()) as any).success).toBe(true);
    expect(sendLink).not.toHaveBeenCalled();
  });

  it("link troca a senha, encerra sessões e só funciona uma vez", async () => {
    await pool.query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h', now() + interval '1 day')", [userId]);
    await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    const token = tokenFromEmail();

    const ok = await post("/api/auth/reset-password", { token, password: "senha-nova-123" });
    expect(ok.status).toBe(200);
    expect((await verifyPassword("senha-nova-123", await storedPassword())).valid).toBe(true);
    const sessions = await pool.query("SELECT 1 FROM refresh_tokens WHERE user_id = $1", [userId]);
    expect(sessions.rowCount).toBe(0);

    const again = await post("/api/auth/reset-password", { token, password: "outra-senha-123" });
    expect(again.status).toBe(400);
  });

  it("link expirado é recusado", async () => {
    await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    const token = tokenFromEmail();
    await pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [userId]);
    const res = await post("/api/auth/reset-password", { token, password: "senha-nova-123" });
    expect(res.status).toBe(400);
  });

  it("novo pedido invalida o link anterior e há limite por hora", async () => {
    await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    const first = tokenFromEmail();
    await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    expect((await post("/api/auth/reset-password", { token: first, password: "senha-nova-123" })).status).toBe(400);

    await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    await post("/api/auth/forgot-password", { email: "r@reset-test.local" });
    expect(sendLink).toHaveBeenCalledTimes(3);
  });

  it("senha curta é recusada", async () => {
    const res = await post("/api/auth/reset-password", { token: "x".repeat(40), password: "curta" });
    expect(res.status).toBe(400);
  });
});
