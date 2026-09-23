// Integração: revogação imediata de sessões. Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL
// com o schema aplicado); cria e apaga usuários @sessions-test.local.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";
import { authMiddleware } from "../middleware/auth";
import { auth } from "../routes/auth";
import { signAccessToken } from "./jwt";
import { DatabaseStorage } from "../../../server/storage";

const url = process.env.TEST_DATABASE_URL;
const env = { JWT_SECRET: "test-secret", JWT_REFRESH_SECRET: "test-refresh", APP_URL: "http://localhost" };

describe.skipIf(!url)("sessões", () => {
  let pool: pg.Pool;
  let db: any;
  let userId: string;

  const app = () => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    a.use("/api/*", authMiddleware);
    a.route("/", auth);
    a.get("/api/whoami", (c) => c.json(c.get("user")));
    a.get("/api/estoques/resumo", (c) => c.json({ ok: true }));
    return a;
  };
  const call = (path: string, token: string, method = "GET") =>
    app().request(path, { method, headers: { Authorization: `Bearer ${token}` } }, env);

  async function newSession(): Promise<string> {
    const { rows } = await pool.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h', now() + interval '1 day') RETURNING id",
      [userId],
    );
    return signAccessToken({ userId, tenantId: null, role: "user", sessionId: rows[0].id }, env.JWT_SECRET);
  }

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@sessions-test.local'");
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, status, is_admin) VALUES ('S', 's@sessions-test.local', 'active', false) RETURNING id",
    );
    userId = rows[0].id;
  });
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@sessions-test.local'");
    await pool?.end();
  });

  it("sessão válida passa", async () => {
    const res = await call("/api/whoami", await newSession());
    expect(res.status).toBe(200);
  });

  it("token sem sessão (formato antigo) é recusado", async () => {
    const legacy = await signAccessToken({ userId, tenantId: null, role: "admin" }, env.JWT_SECRET);
    expect((await call("/api/whoami", legacy)).status).toBe(401);
  });

  it("logout encerra a sessão na hora, mesmo sem cookie", async () => {
    const token = await newSession();
    await call("/api/auth/logout", token, "POST");
    expect((await call("/api/whoami", token)).status).toBe(401);
  });

  it("desativar o usuário derruba todas as sessões", async () => {
    const a = await newSession();
    const b = await newSession();
    await new DatabaseStorage(db).updateUser(userId, { status: "inactive" });
    expect((await call("/api/whoami", a)).status).toBe(401);
    expect((await call("/api/whoami", b)).status).toBe(401);
  });

  it("troca de senha derruba as sessões; migração de hash no login não", async () => {
    const token = await newSession();
    const storage = new DatabaseStorage(db);
    await storage.updateUser(userId, { password: "pbkdf2:1:00:00" });
    expect((await call("/api/whoami", token)).status).toBe(200);
    await storage.updateUser(userId, { password: "nova-senha" });
    expect((await call("/api/whoami", token)).status).toBe(401);
  });

  it("papel vem do banco: promover a admin vale na próxima requisição", async () => {
    const token = await newSession();
    await pool.query("UPDATE users SET is_admin = true WHERE id = $1", [userId]);
    const res = await call("/api/whoami", token);
    expect(((await res.json()) as any).role).toBe("admin");
  });

  it("rota de módulo exige a permissão do módulo; admin passa sempre", async () => {
    const token = await newSession();
    expect((await call("/api/estoques/resumo", token)).status).toBe(403);
    await pool.query(`UPDATE users SET module_permissions = '{"estoques": true}' WHERE id = $1`, [userId]);
    expect((await call("/api/estoques/resumo", token)).status).toBe(200);
    await pool.query(`UPDATE users SET module_permissions = '{}', is_admin = true WHERE id = $1`, [userId]);
    expect((await call("/api/estoques/resumo", token)).status).toBe(200);
  });

  it("rota fora de módulo não exige permissão de módulo", async () => {
    const token = await newSession();
    expect((await call("/api/whoami", token)).status).toBe(200);
  });
});
