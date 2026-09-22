// Integração: isolamento entre tenants nas rotas de chamados e usuários do Worker.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com o schema aplicado); cria e apaga
// dados de teste marcados com @tenant-test.local e tenants tenant-a / tenant-b.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

vi.mock("../lib/email", () => new Proxy({}, { get: () => vi.fn().mockResolvedValue({ success: true }) }));

const { tickets } = await import("./tickets");
const { users } = await import("./users");
const { workspace } = await import("./workspace");

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("isolamento entre tenants", () => {
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
    a.route("/", users);
    a.route("/", workspace);
    return a;
  };
  const json = async (res: Response) => (await res.json()) as any;
  const env = { APP_URL: "http://localhost", API_URL: "http://localhost" };

  async function cleanup() {
    await pool.query("DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'tenant-test%')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'tenant-test%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@tenant-test.local'");
  }

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    await cleanup();
    for (const [key, tenant] of [["adminA", "tenant-a"], ["userA", "tenant-a"], ["userA2", "tenant-a"], ["adminB", "tenant-b"]] as const) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, tenant_id) VALUES ($1, $2, 'active', $3, $4) RETURNING id",
        [key, `${key}@tenant-test.local`, key.startsWith("admin"), tenant],
      );
      ids[key] = rows[0].id;
    }
    for (const [key, requester, tenant] of [["ticketA", "userA", "tenant-a"], ["ticketB", "adminB", "tenant-b"]] as const) {
      const { rows } = await pool.query(
        "INSERT INTO tickets (code, title, description, category, requester_id, tenant_id) VALUES ($1, $2, 'd', 'geral', $3, $4) RETURNING id",
        [`TT-${key}`, `tenant-test ${key}`, ids[requester], tenant],
      );
      ids[key] = rows[0].id;
    }
  });
  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  it("admin lista só os chamados do próprio tenant", async () => {
    const list = await json(await app(ids.adminA, "tenant-a", "admin").request("/api/tickets", {}, env));
    const titles = list.map((t: any) => t.title).filter((t: string) => t.startsWith("tenant-test"));
    expect(titles).toEqual(["tenant-test ticketA"]);
  });

  it("admin não acessa chamado de outro tenant (404)", async () => {
    const res = await app(ids.adminA, "tenant-a", "admin").request(`/api/tickets/${ids.ticketB}`, {}, env);
    expect(res.status).toBe(404);
    const comments = await app(ids.adminA, "tenant-a", "admin").request(`/api/tickets/${ids.ticketB}/comments`, {}, env);
    expect(comments.status).toBe(404);
  });

  it("PATCH do workspace exige participação e mesmo tenant", async () => {
    const patch = (userId: string, tenant: string, ticket: string, role: "admin" | "user" = "user") =>
      app(userId, tenant, role).request(
        `/api/workspace/chamados/${ticket}`,
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ titulo: "tenant-test alterado" }) },
        env,
      );
    expect((await patch(ids.userA2, "tenant-a", ids.ticketA)).status).toBe(403);
    expect((await patch(ids.adminA, "tenant-a", ids.ticketB, "admin")).status).toBe(404);
    expect((await patch(ids.userA, "tenant-a", ids.ticketA)).status).toBe(200);
  });

  it("PATCH /api/tickets/:id não troca tenant nem código", async () => {
    await app(ids.userA, "tenant-a").request(
      `/api/tickets/${ids.ticketA}`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: "tenant-b", code: "X" }) },
      env,
    );
    const { rows } = await pool.query("SELECT tenant_id, code FROM tickets WHERE id = $1", [ids.ticketA]);
    expect(rows[0]).toEqual({ tenant_id: "tenant-a", code: "TT-ticketA" });
  });

  it("lista de usuários e detalhe respeitam o tenant", async () => {
    const list = await json(await app(ids.adminA, "tenant-a", "admin").request("/api/users", {}, env));
    const emails = list.map((u: any) => u.email).filter((e: string) => e.endsWith("@tenant-test.local")).sort();
    expect(emails).toEqual(["adminA@tenant-test.local", "userA2@tenant-test.local", "userA@tenant-test.local"].sort());
    const other = await app(ids.adminA, "tenant-a", "admin").request(`/api/users/${ids.adminB}`, {}, env);
    expect(other.status).toBe(404);
  });

  it("migration 0020 herda o tenant do solicitante sem sobrescrever", async () => {
    await pool.query("UPDATE tickets SET tenant_id = NULL WHERE id = $1", [ids.ticketA]);
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../migrations/0020_tickets_tenant_backfill.sql"), "utf8");
    await pool.query(sql);
    const { rows } = await pool.query("SELECT id, tenant_id FROM tickets WHERE id = ANY($1)", [[ids.ticketA, ids.ticketB]]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.tenant_id]));
    expect(byId[ids.ticketA]).toBe("tenant-a");
    expect(byId[ids.ticketB]).toBe("tenant-b");
  });
});
