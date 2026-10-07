// Integração: equipamentos do OCS (migration 0038) — sincronização, consulta pelos técnicos e
// equipamento sugerido/trocado no chamado.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com o schema e as migrations aplicados).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

vi.mock("../lib/email", () => {
  const ok = () => vi.fn().mockResolvedValue({ success: true });
  return {
    sendCSATReceivedEmail: ok(), sendMentionNotificationEmail: ok(), sendTicketAssignedEmail: ok(),
    sendTicketCommentEmail: ok(), sendTicketCreatedEmail: ok(), sendTicketStatusChangedEmail: ok(),
  };
});

const { tickets } = await import("./tickets");
const { assetsRoutes } = await import("./assets");

const url = process.env.TEST_DATABASE_URL;
const SECRET = "segredo-de-teste";

describe.skipIf(!url)("equipamentos (OCS)", () => {
  let pool: pg.Pool;
  let db: any;
  const ids: Record<string, string> = {};

  const app = (userId: string | null, role: "admin" | "user" = "user") => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      if (userId) c.set("user", { userId, tenantId: null, role });
      await next();
    });
    a.route("/", tickets);
    a.route("/", assetsRoutes);
    return a;
  };
  const json = async (res: Response) => (await res.json()) as any;
  const env = { APP_URL: "http://localhost", API_URL: "http://localhost", ASSET_SYNC_SECRET: SECRET };
  const ctx = { waitUntil: (p: Promise<unknown>) => { p.catch(() => {}); }, passThroughOnException: () => {}, props: {} } as any;
  const send = (a: Hono<any>, method: string, route: string, body?: unknown, headers: Record<string, string> = {}) =>
    a.request(route, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx);
  const sync = (assets: unknown[], secret = SECRET) =>
    send(app(null), "POST", "/api/v1/assets/sync", { source: "ocs", assets }, { "X-Asset-Sync-Secret": secret });

  const machine = (externalId: string, name: string, userLabel: string | null, lastInventoryAt = "2026-06-01T10:00:00Z") =>
    ({ externalId, name, userLabel, serial: `SN-${externalId}`, memoryMb: 16384, lastInventoryAt });

  async function cleanup() {
    await pool.query("DELETE FROM tickets WHERE title LIKE 'asset-test%'");
    await pool.query("DELETE FROM assets WHERE external_id LIKE 'asset-test-%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@asset-test.local'");
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../migrations/0038_assets.sql"), "utf8");
    await pool.query(sql);
    await pool.query(sql); // idempotente
  });
  beforeEach(async () => {
    await cleanup();
    for (const [key, name, tech] of [
      ["tech", "Técnico Teste", true],
      ["julia", "Júlia Souza Granato", false],
      ["bruno", "Bruno Sem Máquina", false],
    ] as const) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, is_technician) VALUES ($1, $2, 'active', false, $3) RETURNING id",
        [name, `${key}@asset-test.local`, tech],
      );
      ids[key] = rows[0].id;
    }
  });
  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  it("sincronização exige o segredo e recusa lista vazia", async () => {
    expect((await sync([machine("asset-test-1", "PC-1", null)], "errado")).status).toBe(401);
    expect((await sync([])).status).toBe(400);
  });

  it("cria, atualiza e inativa o que saiu do inventário", async () => {
    const first = await json(await sync([machine("asset-test-1", "PC-1", null), machine("asset-test-2", "PC-2", null)]));
    expect(first).toMatchObject({ ok: true, created: 2, updated: 0, deactivated: 0 });

    const second = await json(await sync([machine("asset-test-1", "PC-1-novo", "Julia Granato")]));
    expect(second).toMatchObject({ created: 0, updated: 1, deactivated: 1 });

    const { rows } = await pool.query(
      "SELECT external_id, name, active FROM assets WHERE external_id LIKE 'asset-test-%' ORDER BY external_id",
    );
    expect(rows).toEqual([
      { external_id: "asset-test-1", name: "PC-1-novo", active: true },
      { external_id: "asset-test-2", name: "PC-2", active: false },
    ]);
  });

  it("só técnicos consultam; a lista mostra a pessoa ligada pelo nome", async () => {
    await sync([machine("asset-test-1", "Pitzi-Leap1010", "Julia Granato")]);

    expect((await send(app(ids.julia), "GET", "/api/v1/assets")).status).toBe(403);

    const list = await json(await send(app(ids.tech), "GET", "/api/v1/assets"));
    const pc = list.find((a: any) => a.externalId === "asset-test-1");
    expect(pc.person).toMatchObject({ id: ids.julia });
  });

  it("chamado novo recebe a máquina do solicitante e aparece na ficha", async () => {
    await sync([machine("asset-test-1", "Pitzi-Leap1010", "julia.granato")]);
    const asset = (await pool.query("SELECT id FROM assets WHERE external_id = 'asset-test-1'")).rows[0];

    const res = await send(app(ids.julia), "POST", "/api/tickets", {
      code: "", title: "asset-test chamado", description: "teste", category: "helpdesk", type: "bug", assetId: "outro",
    });
    expect(res.status).toBe(201);
    const ticket = await json(res);
    expect(ticket.assetId).toBe(asset.id); // assetId do Usuário é ignorado; vale a sugestão

    const noMachine = await json(await send(app(ids.bruno), "POST", "/api/tickets", {
      code: "", title: "asset-test sem máquina", description: "teste", category: "helpdesk", type: "bug",
    }));
    expect(noMachine.assetId).toBeNull();

    const sheet = await json(await send(app(ids.tech), "GET", `/api/v1/assets/${asset.id}`));
    expect(sheet.tickets.map((t: any) => t.id)).toEqual([ticket.id]);
  });

  it("técnico troca ou tira o equipamento; Usuário não", async () => {
    await sync([machine("asset-test-1", "PC-1", "Julia Granato"), machine("asset-test-2", "PC-2", null)]);
    const other = (await pool.query("SELECT id FROM assets WHERE external_id = 'asset-test-2'")).rows[0].id;
    const ticket = await json(await send(app(ids.julia), "POST", "/api/tickets", {
      code: "", title: "asset-test troca", description: "teste", category: "helpdesk", type: "bug",
    }));

    await send(app(ids.julia), "PATCH", `/api/tickets/${ticket.id}`, { assetId: other });
    expect((await pool.query("SELECT asset_id FROM tickets WHERE id = $1", [ticket.id])).rows[0].asset_id).not.toBe(other);

    expect((await send(app(ids.tech), "PATCH", `/api/tickets/${ticket.id}`, { assetId: "nao-existe" })).status).toBe(400);
    expect((await send(app(ids.tech), "PATCH", `/api/tickets/${ticket.id}`, { assetId: other })).status).toBe(200);
    expect((await pool.query("SELECT asset_id FROM tickets WHERE id = $1", [ticket.id])).rows[0].asset_id).toBe(other);

    expect((await send(app(ids.tech), "PATCH", `/api/tickets/${ticket.id}`, { assetId: null })).status).toBe(200);
    expect((await pool.query("SELECT asset_id FROM tickets WHERE id = $1", [ticket.id])).rows[0].asset_id).toBeNull();
  });
});
