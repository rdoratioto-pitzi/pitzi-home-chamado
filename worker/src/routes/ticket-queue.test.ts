// Integração: fila do grupo — listagem, assumir e transferir chamados.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com o schema e as migrations aplicados).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
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
const { workspace } = await import("./workspace");
const { ticketQueue } = await import("./ticket-queue");

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("fila do grupo", () => {
  let pool: pg.Pool;
  let db: any;
  const ids: Record<string, string> = {};
  const groupIds: Record<string, string> = {};

  const app = (userId: string, role: "admin" | "user" = "user", tenantId: string | null = "tenant-q") => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => {
      c.set("db", db);
      c.set("user", { userId, tenantId, role });
      await next();
    });
    a.route("/", tickets);
    a.route("/", workspace);
    a.route("/", ticketQueue);
    return a;
  };
  const json = async (res: Response) => (await res.json()) as any;
  const env = { APP_URL: "http://localhost", API_URL: "http://localhost" };
  const ctx = { waitUntil: (p: Promise<unknown>) => { p.catch(() => {}); }, passThroughOnException: () => {}, props: {} } as any;
  const send = (a: Hono<any>, method: string, route: string, body?: unknown) =>
    a.request(route, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env, ctx);

  async function cleanup() {
    await pool.query("DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'queue-test%')");
    await pool.query("DELETE FROM workspace_comentarios WHERE chamado_id IN (SELECT id FROM tickets WHERE title LIKE 'queue-test%')");
    await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@queue-test.local')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'queue-test%'");
    await pool.query("DELETE FROM support_group_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@queue-test.local')");
    await pool.query("DELETE FROM users WHERE email LIKE '%@queue-test.local'");
  }

  async function ticket(category: string, opts: { assignee?: string; status?: string; tenant?: string } = {}) {
    const { rows } = await pool.query(
      `INSERT INTO tickets (code, title, description, category, type, status, requester_id, assignee_id, tenant_id)
       VALUES ('queue-test-' || gen_random_uuid(), 'queue-test ' || $1, 'd', $1, 'bug', $2, $3, $4, $5) RETURNING id`,
      [category, opts.status ?? "open", ids.requester, opts.assignee ?? null, opts.tenant ?? "tenant-q"],
    );
    return rows[0].id as string;
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    const { rows } = await pool.query("SELECT id, key FROM support_groups WHERE key IN ('sap', 'dados', 'dev')");
    for (const r of rows) groupIds[r.key] = r.id;
  });
  beforeEach(async () => {
    await cleanup();
    for (const key of ["requester", "sapA", "sapB", "dadosA", "admin", "outsider"]) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, tenant_id) VALUES ($1, $2, 'active', $3, 'tenant-q') RETURNING id",
        [key, `${key}@queue-test.local`, key === "admin"],
      );
      ids[key] = rows[0].id;
    }
    const members: [string, string][] = [["sap", "sapA"], ["sap", "sapB"], ["dados", "dadosA"], ["dev", "dadosA"]];
    for (const [group, user] of members) {
      await pool.query(
        "INSERT INTO support_group_members (group_id, user_id, tenant_id) VALUES ($1, $2, 'tenant-q')",
        [groupIds[group], ids[user]],
      );
    }
  });
  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  it("fila lista só os chamados em aberto dos grupos do usuário", async () => {
    const sapOpen = await ticket("sap");
    const sapMine = await ticket("sap", { assignee: ids.sapA });
    await ticket("sap", { status: "resolved", assignee: ids.sapB });
    await ticket("dados");
    await ticket("sap", { tenant: "tenant-outro" });

    const res = await send(app(ids.sapA), "GET", "/api/workspace/chamados?periodo=em-tratativa&escopo=fila");
    expect(res.status).toBe(200);
    const { items } = await json(res);
    expect(items.map((i: any) => i.id).sort()).toEqual([sapOpen, sapMine].sort());
    expect(items.find((i: any) => i.id === sapOpen).responsavelId).toBeNull();

    // Quem não é de grupo nenhum tem fila vazia; o escopo padrão continua igual.
    const outsider = await json(await send(app(ids.outsider), "GET", "/api/workspace/chamados?periodo=em-tratativa&escopo=fila"));
    expect(outsider.items).toEqual([]);
  });

  it("membro do grupo consulta o chamado; quem é de fora não", async () => {
    const id = await ticket("sap");
    expect((await send(app(ids.sapB), "GET", `/api/tickets/${id}`)).status).toBe(200);
    expect((await send(app(ids.sapB), "GET", `/api/tickets/${id}/comments`)).status).toBe(200);
    expect((await send(app(ids.dadosA), "GET", `/api/tickets/${id}`)).status).toBe(404);
    expect((await send(app(ids.outsider), "GET", `/api/tickets/${id}/comments`)).status).toBe(403);
  });

  it("assumir: membro pega chamado sem responsável e fica registrado no histórico", async () => {
    const id = await ticket("sap");
    expect((await send(app(ids.outsider), "POST", `/api/tickets/${id}/assumir`)).status).toBe(403);
    expect((await send(app(ids.dadosA), "POST", `/api/tickets/${id}/assumir`)).status).toBe(403);

    const res = await send(app(ids.sapA), "POST", `/api/tickets/${id}/assumir`);
    expect(res.status).toBe(200);
    expect((await json(res)).assigneeId).toBe(ids.sapA);

    const notes = (await pool.query("SELECT content, is_internal, user_id FROM ticket_comments WHERE ticket_id = $1", [id])).rows;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ is_internal: true, user_id: ids.sapA });
    expect(notes[0].content).toContain("assumido por sapA");

    // Já tem responsável: outro membro não toma o chamado; admin pode.
    expect((await send(app(ids.sapB), "POST", `/api/tickets/${id}/assumir`)).status).toBe(403);
    expect((await send(app(ids.sapA), "POST", `/api/tickets/${id}/assumir`)).status).toBe(403);
    const byAdmin = await send(app(ids.admin, "admin"), "POST", `/api/tickets/${id}/assumir`);
    expect(byAdmin.status).toBe(200);
    expect((await json(byAdmin)).assigneeId).toBe(ids.admin);
  });

  it("assumir: chamado encerrado ou de outro tenant é recusado", async () => {
    const closed = await ticket("sap", { status: "closed" });
    expect((await send(app(ids.sapA), "POST", `/api/tickets/${closed}/assumir`)).status).toBe(403);
    const other = await ticket("sap", { tenant: "tenant-outro" });
    expect((await send(app(ids.sapA), "POST", `/api/tickets/${other}/assumir`)).status).toBe(404);
  });

  it("transferir: membro move para outro grupo e o responsável de fora sai", async () => {
    const id = await ticket("sap", { assignee: ids.sapA });
    expect((await send(app(ids.outsider), "POST", `/api/tickets/${id}/transferir`, { category: "dados" })).status).toBe(403);

    const res = await send(app(ids.sapB), "POST", `/api/tickets/${id}/transferir`, { category: "dados" });
    expect(res.status).toBe(200);
    const moved = await json(res);
    expect(moved.category).toBe("dados");
    expect(moved.assigneeId).toBeNull();

    const note = (await pool.query("SELECT content FROM ticket_comments WHERE ticket_id = $1", [id])).rows[0].content;
    expect(note).toContain("transferido de SAP para Dados por sapB");

    // sapB não é mais do grupo do chamado nem responsável.
    expect((await send(app(ids.sapB), "POST", `/api/tickets/${id}/transferir`, { category: "sap" })).status).toBe(403);
  });

  it("transferir: responsável indicado precisa ser do grupo de destino e é notificado", async () => {
    const id = await ticket("sap", { assignee: ids.sapA });
    expect((await send(app(ids.sapA), "POST", `/api/tickets/${id}/transferir`, { category: "dados", assigneeId: ids.sapB })).status).toBe(400);

    const res = await send(app(ids.sapA), "POST", `/api/tickets/${id}/transferir`, { category: "dados", assigneeId: ids.dadosA });
    expect(res.status).toBe(200);
    expect((await json(res)).assigneeId).toBe(ids.dadosA);
    const notif = await pool.query("SELECT title FROM notifications WHERE user_id = $1 AND entity_id = $2", [ids.dadosA, id]);
    expect(notif.rows.map((r) => r.title)).toContain("Chamado atribuído a você");
  });

  it("transferir: dentro do grupo troca o responsável; grupo inativo ou igual sem mudança é recusado", async () => {
    const id = await ticket("sap", { assignee: ids.sapA });
    const within = await send(app(ids.sapA), "POST", `/api/tickets/${id}/transferir`, { category: "sap", assigneeId: ids.sapB });
    expect(within.status).toBe(200);
    expect((await json(within)).assigneeId).toBe(ids.sapB);

    expect((await send(app(ids.sapB), "POST", `/api/tickets/${id}/transferir`, { category: "sap" })).status).toBe(400);
    // "dev" está desativado (0023): não recebe chamados.
    expect((await send(app(ids.admin, "admin"), "POST", `/api/tickets/${id}/transferir`, { category: "dev" })).status).toBe(400);
    expect((await send(app(ids.sapB), "POST", `/api/tickets/${id}/transferir`, {})).status).toBe(400);
  });

  it("comentários do workspace seguem a regra de acesso do chamado", async () => {
    const id = await ticket("sap");
    const route = `/api/workspace/chamados/${id}/comentarios`;

    // Quem não é solicitante, responsável, membro do grupo nem admin não lê nem comenta.
    expect((await send(app(ids.outsider), "GET", route)).status).toBe(404);
    expect((await send(app(ids.dadosA), "POST", route, { texto: "invasor" })).status).toBe(404);
    // Outro tenant também não, mesmo sendo admin.
    expect((await send(app(ids.admin, "admin", "tenant-outro"), "GET", route)).status).toBe(404);

    expect((await send(app(ids.sapA), "POST", route, { texto: "olhando" })).status).toBe(201);
    expect((await send(app(ids.requester), "POST", route, { texto: "obrigado" })).status).toBe(201);
    const lista = await json(await send(app(ids.admin, "admin"), "GET", route));
    expect(lista.comentarios.map((c: any) => c.texto)).toEqual(["olhando", "obrigado"]);

    // Chamado inexistente responde 404 em vez de gravar comentário solto.
    const inexistente = "/api/workspace/chamados/00000000-0000-0000-0000-000000000000/comentarios";
    expect((await send(app(ids.admin, "admin"), "POST", inexistente, { texto: "x" })).status).toBe(404);
  });

  it("membro do grupo comenta e escreve nota interna; o solicitante não vê a nota", async () => {
    const id = await ticket("sap");
    const route = `/api/tickets/${id}/comments`;
    expect((await send(app(ids.outsider), "POST", route, { content: "x" })).status).toBe(403);

    const nota = await send(app(ids.sapA), "POST", route, { content: "nota da equipe", isInternal: true });
    expect(nota.status).toBe(201);
    expect((await json(nota)).isInternal).toBe(true);
    expect((await send(app(ids.sapB), "POST", route, { content: "resposta pública" })).status).toBe(201);
    // Solicitante tenta marcar como interno: vira público.
    await send(app(ids.requester), "POST", route, { content: "do solicitante", isInternal: true });

    const doSolicitante = (await json(await send(app(ids.requester), "GET", route))).map((c: any) => c.content).sort();
    expect(doSolicitante).toEqual(["do solicitante", "resposta pública"]);
    const doMembro = (await json(await send(app(ids.sapB), "GET", route))).map((c: any) => c.content).sort();
    expect(doMembro).toEqual(["do solicitante", "nota da equipe", "resposta pública"]);
  });
});
