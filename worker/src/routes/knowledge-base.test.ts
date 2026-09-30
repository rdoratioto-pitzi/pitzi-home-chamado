// Integração: Base de Conhecimento — visibilidade, permissões, busca e criação a partir de chamado.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com o schema e as migrations aplicados).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

const { knowledgeBase } = await import("./knowledge-base");

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("base de conhecimento", () => {
  let pool: pg.Pool;
  let db: any;
  const ids: Record<string, string> = {};
  let sapGroupId = "";

  const app = (userId: string, role: "admin" | "user" = "user", tenantId: string | null = "tenant-kb") => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      c.set("user", { userId, tenantId, role });
      await next();
    });
    a.route("/", knowledgeBase);
    return a;
  };
  const json = async (res: Response) => (await res.json()) as any;
  const send = (a: Hono<any>, method: string, route: string, body?: unknown) =>
    a.request(route, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function cleanup() {
    await pool.query("DELETE FROM knowledge_articles WHERE title LIKE 'kb-test%'");
    await pool.query("DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'kb-test%')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'kb-test%'");
    await pool.query("DELETE FROM support_group_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@kb-test.local')");
    await pool.query("DELETE FROM users WHERE email LIKE '%@kb-test.local'");
  }

  async function article(title: string, opts: { author: string; status?: string; group?: string | null; content?: string; tenant?: string }) {
    const { rows } = await pool.query(
      `INSERT INTO knowledge_articles (title, content, status, group_key, author_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, opts.content ?? "<p>conteúdo</p>", opts.status ?? "publicado", opts.group ?? null, opts.author, opts.tenant ?? "tenant-kb"],
    );
    return rows[0].id as string;
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    const { rows } = await pool.query("SELECT id FROM support_groups WHERE key = 'sap'");
    sapGroupId = rows[0].id;
  });
  beforeEach(async () => {
    await cleanup();
    for (const key of ["requester", "tech", "tech2", "admin", "outsider"]) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, tenant_id) VALUES ($1, $2, 'active', $3, 'tenant-kb') RETURNING id",
        [key, `${key}@kb-test.local`, key === "admin"],
      );
      ids[key] = rows[0].id;
    }
    for (const user of ["tech", "tech2"]) {
      await pool.query(
        "INSERT INTO support_group_members (group_id, user_id, tenant_id) VALUES ($1, $2, 'tenant-kb')",
        [sapGroupId, ids[user]],
      );
    }
  });
  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  it("lista publicados para todos; rascunho só para o autor e admin; busca por título e conteúdo", async () => {
    await article("kb-test VPN", { author: ids.tech, content: "<p>reinstalar cliente</p>" });
    await article("kb-test Impressora", { author: ids.tech, status: "rascunho" });
    await article("kb-test outro tenant", { author: ids.tech, tenant: "tenant-outro" });

    const titles = async (userId: string, role: "admin" | "user" = "user", q = "kb-test") =>
      (await json(await send(app(userId, role), "GET", `/api/conhecimento/artigos?q=${encodeURIComponent(q)}`)))
        .items.map((a: any) => a.title).sort();

    expect(await titles(ids.outsider)).toEqual(["kb-test VPN"]);
    expect(await titles(ids.tech)).toEqual(["kb-test Impressora", "kb-test VPN"]);
    expect(await titles(ids.admin, "admin")).toEqual(["kb-test Impressora", "kb-test VPN"]);
    // Busca no conteúdo, sem diferenciar maiúsculas.
    expect(await titles(ids.outsider, "user", "REINSTALAR")).toEqual(["kb-test VPN"]);

    const list = await json(await send(app(ids.outsider), "GET", "/api/conhecimento/artigos?q=kb-test"));
    expect(list.canCreate).toBe(false);
    expect((await json(await send(app(ids.tech), "GET", "/api/conhecimento/artigos?q=kb-test"))).canCreate).toBe(true);
  });

  it("rascunho de outro autor responde 404; editar e excluir só autor ou admin", async () => {
    const draft = await article("kb-test rascunho", { author: ids.tech, status: "rascunho" });
    expect((await send(app(ids.outsider), "GET", `/api/conhecimento/artigos/${draft}`)).status).toBe(404);

    const pub = await article("kb-test publicado", { author: ids.tech });
    const view = await json(await send(app(ids.outsider), "GET", `/api/conhecimento/artigos/${pub}`));
    expect(view.canEdit).toBe(false);
    expect((await send(app(ids.tech2), "PUT", `/api/conhecimento/artigos/${pub}`, { title: "kb-test x" })).status).toBe(403);
    expect((await send(app(ids.outsider), "DELETE", `/api/conhecimento/artigos/${pub}`)).status).toBe(403);

    const edited = await send(app(ids.tech), "PUT", `/api/conhecimento/artigos/${pub}`, { title: "kb-test editado" });
    expect(edited.status).toBe(200);
    expect((await json(edited)).status).toBe("publicado");
    expect((await send(app(ids.admin, "admin"), "DELETE", `/api/conhecimento/artigos/${pub}`)).status).toBe(204);
  });

  it("criar do zero: só equipe (membro de grupo) ou admin", async () => {
    const body = { title: "kb-test novo", content: "<p>passo a passo</p>", groupKey: "sap" };
    expect((await send(app(ids.outsider), "POST", "/api/conhecimento/artigos", body)).status).toBe(403);
    const created = await send(app(ids.tech), "POST", "/api/conhecimento/artigos", body);
    expect(created.status).toBe(201);
    expect(await json(created)).toMatchObject({ status: "publicado", authorId: ids.tech, groupKey: "sap" });
    expect((await send(app(ids.tech), "POST", "/api/conhecimento/artigos", { ...body, groupKey: "nao-existe" })).status).toBe(400);
  });

  it("a partir do chamado: rascunho sem notas internas; solicitante não cria; um artigo por chamado", async () => {
    const { rows } = await pool.query(
      `INSERT INTO tickets (code, title, description, category, type, status, requester_id, assignee_id, tenant_id)
       VALUES ('kb-test-' || gen_random_uuid(), 'kb-test Notebook', '<p>não liga</p>', 'sap', 'bug', 'resolved', $1, $2, 'tenant-kb')
       RETURNING id`,
      [ids.requester, ids.tech],
    );
    const ticketId = rows[0].id as string;
    await pool.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, tenant_id) VALUES
       ($1, $2, '<p>nota interna secreta</p>', true, 'tenant-kb'),
       ($1, $2, '<p>troquei a bateria</p>', false, 'tenant-kb')`,
      [ticketId, ids.tech],
    );
    const route = `/api/conhecimento/chamados/${ticketId}/rascunho`;

    expect((await send(app(ids.requester), "GET", route)).status).toBe(403);
    expect((await send(app(ids.outsider), "GET", route)).status).toBe(404);

    const draft = await json(await send(app(ids.tech2), "GET", route));
    expect(draft.existingArticleId).toBeNull();
    expect(draft.draft.content).toContain("troquei a bateria");
    expect(draft.draft.content).not.toContain("secreta");

    const body = { title: "kb-test Notebook", content: draft.draft.content, groupKey: "sap", sourceTicketId: ticketId };
    expect((await send(app(ids.requester), "POST", "/api/conhecimento/artigos", body)).status).toBe(403);
    const created = await send(app(ids.tech2), "POST", "/api/conhecimento/artigos", { ...body, status: "rascunho" });
    expect(created.status).toBe(201);
    const articleId = (await json(created)).id;

    const again = await send(app(ids.tech), "POST", "/api/conhecimento/artigos", body);
    expect(again.status).toBe(409);
    expect((await json(again)).articleId).toBe(articleId);
    expect((await json(await send(app(ids.tech), "GET", route))).existingArticleId).toBe(articleId);

    // O chamado de origem aparece para a equipe; não para quem não enxerga o chamado.
    await send(app(ids.tech2), "PUT", `/api/conhecimento/artigos/${articleId}`, { status: "publicado" });
    expect((await json(await send(app(ids.tech), "GET", `/api/conhecimento/artigos/${articleId}`))).sourceTicket?.id).toBe(ticketId);
    expect((await json(await send(app(ids.outsider), "GET", `/api/conhecimento/artigos/${articleId}`))).sourceTicket).toBeNull();
  });
});
