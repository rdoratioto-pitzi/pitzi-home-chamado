// Integração: login com Google (cadastro no primeiro acesso) e a política de login por senha.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL); cria e apaga usuários @pitzi.com.br de teste
// com o prefixo "gtest.".
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";
import { hashPassword } from "../../../shared/password";
import { resetGoogleJwksCache } from "../../../shared/google-id-token";

vi.mock("../lib/email", () => ({ sendPasswordResetLinkEmail: vi.fn().mockResolvedValue(undefined) }));

const { auth } = await import("./auth");
const url = process.env.TEST_DATABASE_URL;
const CLIENT_ID = "123-test.apps.googleusercontent.com";
const baseEnv = { APP_URL: "https://app.test", JWT_SECRET: "s", JWT_REFRESH_SECRET: "r", ALLOWED_GOOGLE_DOMAINS: "pitzi.com.br" };
const googleEnv = { ...baseEnv, GOOGLE_LOGIN_CLIENT_ID: CLIENT_ID, PASSWORD_LOGIN_ENABLED: "false" };

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

describe.skipIf(!url)("login com Google", () => {
  let pool: pg.Pool;
  let db: any;
  let keys: CryptoKeyPair;
  let jwk: JsonWebKey & { kid: string };

  const token = async (claims: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const header = enc({ alg: "RS256", kid: "k1" });
    const payload = enc({
      iss: "accounts.google.com", aud: CLIENT_ID, sub: "9", email_verified: true, hd: "pitzi.com.br",
      email: "gtest.nova@pitzi.com.br", name: "Nova Pessoa", iat: now, exp: now + 600, ...claims,
    });
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${header}.${payload}`));
    return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
  };
  const app = () => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    a.route("/", auth);
    return a;
  };
  const post = (path: string, body: unknown, env: Record<string, string> = googleEnv) =>
    app().request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env);
  const userRow = async (email: string) =>
    (await pool.query("SELECT * FROM users WHERE email = $1", [email])).rows[0];
  const addUser = async (email: string, extra: { admin?: boolean; tech?: boolean; status?: string } = {}) => {
    await pool.query(
      "INSERT INTO users (name, email, status, password, is_admin, is_technician, auth_method) VALUES ($1, $2, $3, $4, $5, $6, 'email')",
      ["Existente", email, extra.status ?? "active", await hashPassword("senha-123"), extra.admin ?? false, extra.tech ?? false],
    );
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    keys = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    jwk = { ...((await crypto.subtle.exportKey("jwk", keys.publicKey)) as JsonWebKey), kid: "k1" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }))));
  });
  beforeEach(async () => {
    resetGoogleJwksCache();
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'gtest.%')");
    await pool.query("DELETE FROM users WHERE email LIKE 'gtest.%'");
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'gtest.%')");
    await pool.query("DELETE FROM users WHERE email LIKE 'gtest.%'");
    await pool?.end();
  });

  it("config pública diz se o login é só Google", async () => {
    const off = await app().request("/api/auth/config", {}, baseEnv);
    expect(await off.json()).toEqual({ googleClientId: null, allowedDomains: ["pitzi.com.br"], passwordLogin: "all" });
    const on = await app().request("/api/auth/config", {}, googleEnv);
    expect(await on.json()).toEqual({ googleClientId: CLIENT_ID, allowedDomains: ["pitzi.com.br"], passwordLogin: "off" });
  });

  it("primeiro acesso cria a pessoa como Usuário e abre a sessão", async () => {
    const res = await post("/api/auth/google", { credential: await token() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.accessToken).toBeTruthy();
    expect(body.user).toMatchObject({ email: "gtest.nova@pitzi.com.br", isAdmin: false, isTechnician: false });
    const row = await userRow("gtest.nova@pitzi.com.br");
    expect(row).toMatchObject({ name: "Nova Pessoa", status: "active", auth_method: "google", is_admin: false, is_technician: false });
    // Lista completa de módulos, só "chamados" ligado (o formulário de edição exige todas).
    const perms = JSON.parse(row.module_permissions);
    expect(perms.chamados).toBe(true);
    expect(Object.entries(perms).filter(([, v]) => v).map(([k]) => k)).toEqual(["chamados"]);
    expect(Object.keys(perms)).toHaveLength(20);
    // Segundo acesso reaproveita o mesmo cadastro.
    await post("/api/auth/google", { credential: await token() });
    expect((await pool.query("SELECT count(*)::int n FROM users WHERE email = 'gtest.nova@pitzi.com.br'")).rows[0].n).toBe(1);
  });

  it("quem já existe mantém admin e técnico (e-mail sem diferenciar maiúsculas)", async () => {
    await addUser("gtest.admin@pitzi.com.br", { admin: true, tech: true });
    const res = await post("/api/auth/google", { credential: await token({ email: "GTest.Admin@pitzi.com.br" }) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).user).toMatchObject({ isAdmin: true, isTechnician: true });
  });

  it("conta desativada e domínio de fora são recusados", async () => {
    await addUser("gtest.inativo@pitzi.com.br", { status: "inactive" });
    const inativo = await post("/api/auth/google", { credential: await token({ email: "gtest.inativo@pitzi.com.br" }) });
    expect(inativo.status).toBe(403);
    expect(((await inativo.json()) as any).message).toMatch(/desativada/);
    const fora = await post("/api/auth/google", { credential: await token({ email: "gtest.x@outra.com", hd: "outra.com" }) });
    expect(fora.status).toBe(401);
    expect(await userRow("gtest.x@outra.com")).toBeUndefined();
  });

  it("sem client id configurado, o Google responde 503 e a senha vale para todos", async () => {
    expect((await post("/api/auth/google", { credential: await token() }, baseEnv)).status).toBe(503);
    await addUser("gtest.comum@pitzi.com.br");
    const res = await post("/api/auth/login", { email: "gtest.comum@pitzi.com.br", password: "senha-123" }, baseEnv);
    expect(res.status).toBe(200);
  });

  it("com Google configurado, senha é recusada para todos, inclusive admin", async () => {
    await addUser("gtest.comum@pitzi.com.br");
    await addUser("gtest.admin@pitzi.com.br", { admin: true });
    for (const email of ["gtest.comum@pitzi.com.br", "gtest.admin@pitzi.com.br"]) {
      const res = await post("/api/auth/login", { email, password: "senha-123" });
      expect(res.status).toBe(403);
      expect(((await res.json()) as any).code).toBe("use_google");
    }
  });

  it("chave de emergência religa a senha só para admin", async () => {
    const env = { ...googleEnv, PASSWORD_LOGIN_ENABLED: "true" };
    await addUser("gtest.comum@pitzi.com.br");
    await addUser("gtest.admin@pitzi.com.br", { admin: true });
    expect((await post("/api/auth/login", { email: "gtest.admin@pitzi.com.br", password: "senha-123" }, env)).status).toBe(200);
    expect((await post("/api/auth/login", { email: "gtest.comum@pitzi.com.br", password: "senha-123" }, env)).status).toBe(403);
    // Senha errada continua 401 (não revela a política antes de conferir a senha).
    expect((await post("/api/auth/login", { email: "gtest.comum@pitzi.com.br", password: "x" }, env)).status).toBe(401);
  });
});
