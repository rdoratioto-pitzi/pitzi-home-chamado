// Integração: relatório de chamados por técnico (Configurações → Relatórios).
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com o schema e as migrations aplicados).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

const { reports } = await import("./reports");
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("relatório por técnico", () => {
  let pool: pg.Pool;
  let db: any;
  const ids: Record<string, string> = {};
  const app = (userId: string, role: "admin" | "user") => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => { c.set("db", db); c.set("user", { userId, tenantId: null, role }); await next(); });
    a.route("/", reports);
    return a;
  };
  const get = (a: Hono<any>, path: string) => a.request(path, {}, { APP_URL: "http://x", API_URL: "http://x" });

  async function cleanup() {
    await pool.query("DELETE FROM tickets WHERE title LIKE 'report-test%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@report-test.local'");
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    await cleanup();
    for (const [key, admin, tech] of [["admin", true, true], ["tec", false, true], ["user", false, false]] as const) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, is_technician) VALUES ($1, $2, 'active', $3, $4) RETURNING id",
        [`report ${key}`, `${key}@report-test.local`, admin, tech],
      );
      ids[key] = rows[0].id;
    }
    const insert = (code: string, assignee: string | null, status: string, opened: string, resolved: string | null) => pool.query(
      `INSERT INTO tickets (code, title, description, category, type, status, requester_id, assignee_id, data_abertura, created_at, data_resolucao)
       VALUES ($1, $2, 'd', 'sap', 'bug', $3, $4, $5, $6, $6, $7)`,
      [code, `report-test ${code}`, status, ids.user, assignee, opened, resolved],
    );
    await insert("RPT-1", ids.tec, "resolved", "2026-10-12 12:00:00", "2026-10-12 15:00:00");
    await insert("RPT-2", ids.tec, "in_progress", "2026-10-13 12:00:00", null);
  });
  afterAll(async () => { await cleanup(); await pool?.end(); });

  it("só admin consulta e o período precisa ser válido", async () => {
    expect((await get(app(ids.user, "user"), "/api/v1/reports/technicians?from=2026-10-01&to=2026-10-31")).status).toBe(403);
    expect((await get(app(ids.admin, "admin"), "/api/v1/reports/technicians?from=2026-10-31&to=2026-10-01")).status).toBe(400);
    expect((await get(app(ids.admin, "admin"), "/api/v1/reports/technicians?from=2026-02-30&to=2026-03-05")).status).toBe(400);
    expect((await get(app(ids.admin, "admin"), "/api/v1/reports/technicians?from=2026-13-01&to=2026-13-05")).status).toBe(400);
  });

  it("traz o técnico com recebidos, resolvidos e em aberto", async () => {
    const res = await get(app(ids.admin, "admin"), "/api/v1/reports/technicians?from=2026-10-01&to=2026-10-31&group=sap");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const tec = body.rows.find((r: any) => r.assigneeId === ids.tec);
    expect([tec.received, tec.resolved, tec.openNow]).toEqual([2, 1, 1]);
    expect(body.tickets.filter((t: any) => t.code.startsWith("RPT-")).length).toBe(2);
    expect(body.rows.some((r: any) => r.assigneeId === ids.user)).toBe(false); // Usuário não é técnico
  });
});
