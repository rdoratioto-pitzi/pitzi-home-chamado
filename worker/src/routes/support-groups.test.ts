// Integração: grupos de atendimento (migration 0022), abertura de chamado por grupo,
// responsável automático e isolamento de tenant nas regras de responsáveis.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com o schema e as migrations aplicados).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

vi.mock("../lib/email", () => new Proxy({}, { get: () => vi.fn().mockResolvedValue({ success: true }) }));

const { tickets } = await import("./tickets");
const { workspace } = await import("./workspace");
const { supportGroups } = await import("./support-groups");

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("grupos de atendimento", () => {
  let pool: pg.Pool;
  let db: any;
  const ids: Record<string, string> = {};

  const app = (userId: string, tenantId: string | null, role: "admin" | "user" = "user") => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      c.set("user", { userId, tenantId, role });
      await next();
    });
    a.route("/", tickets);
    a.route("/", workspace);
    a.route("/", supportGroups);
    return a;
  };
  const json = async (res: Response) => (await res.json()) as any;
  const env = { APP_URL: "http://localhost", API_URL: "http://localhost" };
  // Criação de chamado agenda notificações com waitUntil; aqui elas só são descartadas.
  const ctx = { waitUntil: (p: Promise<unknown>) => { p.catch(() => {}); }, passThroughOnException: () => {}, props: {} } as any;
  const send = (a: Hono<any>, method: string, route: string, body: unknown) =>
    a.request(route, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env, ctx);
  const groupId = async (key: string) =>
    (await pool.query("SELECT id FROM support_groups WHERE key = $1", [key])).rows[0].id as string;

  async function cleanup() {
    await pool.query("DELETE FROM ticket_responsaveis WHERE usuario_responsavel_id IN (SELECT id FROM users WHERE email LIKE '%@group-test.local')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'group-test%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@group-test.local'");
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../migrations/0022_support_groups.sql"), "utf8");
    await pool.query(sql);
  });
  beforeEach(async () => {
    await cleanup();
    for (const [key, tenant] of [["adminA", "tenant-a"], ["userA", "tenant-a"], ["agentA", "tenant-a"], ["adminB", "tenant-b"]] as const) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, tenant_id) VALUES ($1, $2, 'active', $3, $4) RETURNING id",
        [key, `${key}@group-test.local`, key.startsWith("admin"), tenant],
      );
      ids[key] = rows[0].id;
    }
  });
  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  it("migration 0022 cria os quatro grupos e é idempotente", async () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../migrations/0022_support_groups.sql"), "utf8");
    await pool.query(sql);
    const list = await json(await app(ids.userA, "tenant-a").request("/api/v1/support-groups", {}, env));
    expect(list.map((g: any) => g.key)).toEqual(["suporte-ti", "sap", "dados", "dev"]);
    expect(list.map((g: any) => g.name)).toEqual(["Suporte TI", "SAP", "Dados", "Dev"]);
  });

  it("abertura exige grupo válido nas duas rotas", async () => {
    const a = app(ids.userA, "tenant-a");
    const base = { applicationKey: "pitzi-home" };
    expect((await send(a, "POST", "/api/workspace/chamados", { ...base, titulo: "group-test sem grupo" })).status).toBe(400);
    expect((await send(a, "POST", "/api/workspace/chamados", { ...base, titulo: "group-test x", categoria: "rh" })).status).toBe(400);
    expect((await send(a, "POST", "/api/tickets", { ...base, code: "", title: "group-test x", description: "d", category: "geral" })).status).toBe(400);
    const ok = await send(a, "POST", "/api/workspace/chamados", { ...base, titulo: "group-test ok", categoria: "sap" });
    expect(ok.status).toBe(201);
  });

  it("chamado rápido recebe o responsável padrão do grupo, só do mesmo tenant", async () => {
    await pool.query(
      "INSERT INTO ticket_responsaveis (categoria, tipo, usuario_responsavel_id, tenant_id) VALUES ('dados', 'bug', $1, 'tenant-b')",
      [ids.adminB],
    );
    const a = app(ids.userA, "tenant-a");
    const first = await json(await send(a, "POST", "/api/workspace/chamados", { applicationKey: "pitzi-home", titulo: "group-test 1", categoria: "dados", tipo: "bug" }));
    expect((await pool.query("SELECT assignee_id FROM tickets WHERE id = $1", [first.id])).rows[0].assignee_id).toBeNull();

    await pool.query(
      "INSERT INTO ticket_responsaveis (categoria, tipo, usuario_responsavel_id, tenant_id) VALUES ('dados', 'bug', $1, 'tenant-a')",
      [ids.agentA],
    );
    const second = await json(await send(a, "POST", "/api/workspace/chamados", { applicationKey: "pitzi-home", titulo: "group-test 2", categoria: "dados", tipo: "bug" }));
    expect((await pool.query("SELECT assignee_id FROM tickets WHERE id = $1", [second.id])).rows[0].assignee_id).toBe(ids.agentA);
  });

  it("regras de responsáveis ficam no tenant de quem cria", async () => {
    const created = await send(app(ids.adminA, "tenant-a", "admin"), "POST", "/api/ticket-responsaveis",
      { categoria: "dev", tipo: "bug", usuarioResponsavelId: ids.agentA, tenantId: "tenant-b" });
    expect(created.status).toBe(201);
    const rule = await json(created);
    expect(rule.tenantId).toBe("tenant-a");

    const listB = await json(await app(ids.adminB, "tenant-b", "admin").request("/api/ticket-responsaveis", {}, env));
    expect(listB.find((r: any) => r.id === rule.id)).toBeUndefined();
    expect((await app(ids.adminB, "tenant-b", "admin").request(`/api/ticket-responsaveis/${rule.id}`, { method: "DELETE" }, env)).status).toBe(404);

    const otherTenantUser = await send(app(ids.adminA, "tenant-a", "admin"), "POST", "/api/ticket-responsaveis",
      { categoria: "dev", tipo: "bug", usuarioResponsavelId: ids.adminB });
    expect(otherTenantUser.status).toBe(400);
    const badGroup = await send(app(ids.adminA, "tenant-a", "admin"), "POST", "/api/ticket-responsaveis",
      { categoria: "rh", tipo: "bug", usuarioResponsavelId: ids.agentA });
    expect(badGroup.status).toBe(400);
  });

  it("membros: só admin define, só usuários do tenant, e cada tenant vê os seus", async () => {
    const sap = await groupId("sap");
    expect((await send(app(ids.userA, "tenant-a"), "PUT", `/api/v1/support-groups/${sap}/members`, { userIds: [ids.agentA] })).status).toBe(403);
    expect((await send(app(ids.adminA, "tenant-a", "admin"), "PUT", `/api/v1/support-groups/${sap}/members`, { userIds: [ids.adminB] })).status).toBe(400);

    const ok = await send(app(ids.adminA, "tenant-a", "admin"), "PUT", `/api/v1/support-groups/${sap}/members`, { userIds: [ids.agentA, ids.userA, ids.agentA] });
    expect(ok.status).toBe(200);
    await send(app(ids.adminB, "tenant-b", "admin"), "PUT", `/api/v1/support-groups/${sap}/members`, { userIds: [ids.adminB] });

    const listA = await json(await app(ids.userA, "tenant-a").request("/api/v1/support-groups", {}, env));
    expect(listA.find((g: any) => g.key === "sap").memberIds.sort()).toEqual([ids.agentA, ids.userA].sort());
    const listB = await json(await app(ids.adminB, "tenant-b").request("/api/v1/support-groups", {}, env));
    expect(listB.find((g: any) => g.key === "sap").memberIds).toEqual([ids.adminB]);

    await send(app(ids.adminA, "tenant-a", "admin"), "PUT", `/api/v1/support-groups/${sap}/members`, { userIds: [] });
    const cleared = await json(await app(ids.userA, "tenant-a").request("/api/v1/support-groups", {}, env));
    expect(cleared.find((g: any) => g.key === "sap").memberIds).toEqual([]);
  });
});
