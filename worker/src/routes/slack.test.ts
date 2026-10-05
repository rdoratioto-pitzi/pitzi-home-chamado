// Integração: Slack → chamado (/chamado e atalho "Transformar em chamado").
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com as migrations aplicadas).
// A Slack Web API é simulada (fetch para slack.com).
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { Hono } from "hono";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

vi.mock("../lib/email", () => {
  const ok = () => vi.fn().mockResolvedValue(undefined);
  return { sendTicketCreatedEmail: ok(), sendTicketAssignedEmail: ok() };
});

const { slack } = await import("./slack");

const url = process.env.TEST_DATABASE_URL;
const SECRET = "slack-segredo-teste";
const DOMAIN = "slack-test.local";

async function sign(timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${body}`));
  return `v0=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// Perfis do Slack simulados: id → e-mail.
const SLACK_PROFILES: Record<string, string> = {
  UTEC: `tecnico@${DOMAIN}`,
  UUSR: `usuario@${DOMAIN}`,
  UNOVO: `novo@${DOMAIN}`,
  UFORA: "alguem@outra-empresa.com",
};

describe.skipIf(!url)("Slack → chamado", () => {
  let pool: pg.Pool;
  let db: any;
  let calls: { method: string; params: Record<string, string> }[] = [];
  let postMessageOk = true;
  const realFetch = globalThis.fetch;

  const env = {
    SLACK_BOT_TOKEN: "xoxb-teste", SLACK_SIGNING_SECRET: SECRET,
    ALLOWED_GOOGLE_DOMAINS: DOMAIN, APP_URL: "https://app.test",
  };
  const app = () => {
    const a = new Hono<any>();
    a.use("*", async (c, next) => { c.set("db", db); await next(); });
    a.route("/", slack);
    return a;
  };
  const post = async (path: string, body: string, opts: { badSignature?: boolean } = {}) => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = opts.badSignature ? "v0=errada" : await sign(ts, body);
    return app().request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "X-Slack-Request-Timestamp": ts, "X-Slack-Signature": signature },
      body,
    }, env);
  };
  const command = (userId: string, text: string) =>
    post("/api/slack/commands", new URLSearchParams({ command: "/chamado", text, user_id: userId, trigger_id: "TRIG", channel_id: "C1" }).toString());
  const interaction = (payload: unknown) =>
    post("/api/slack/interactions", new URLSearchParams({ payload: JSON.stringify(payload) }).toString());
  const viewOf = (method: string) => JSON.parse(calls.find((c) => c.method === method)!.params.view);
  const submit = (privateMetadata: string, values: { title: string; category: string; impact?: string }) =>
    interaction({
      type: "view_submission",
      view: {
        callback_id: "chamado_slack_modal",
        private_metadata: privateMetadata,
        state: {
          values: {
            titulo: { valor: { value: values.title } },
            descricao: { valor: { value: "descrição vinda do Slack" } },
            grupo: { valor: { selected_option: { value: values.category } } },
            tipo: { valor: { selected_option: { value: "bug" } } },
            ...(values.impact ? { gravidade: { valor: { selected_option: { value: values.impact } } } } : {}),
          },
        },
      },
    });

  async function cleanup() {
    await pool.query("DELETE FROM ticket_custom_fields WHERE label LIKE 'slack-test%'");
    await pool.query("DELETE FROM email_outbox WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'slack-test%')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'slack-test%'");
    await pool.query(`DELETE FROM users WHERE email LIKE '%@${DOMAIN}'`);
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    await cleanup();
    await pool.query(
      `INSERT INTO users (name, email, status, is_admin, is_technician, module_permissions) VALUES
        ('Técnico Slack', 'tecnico@${DOMAIN}', 'active', false, true, '{"chamados":true}'),
        ('Usuário Slack', 'usuario@${DOMAIN}', 'active', false, false, '{"chamados":true}')`,
    );
    calls = [];
    postMessageOk = true;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const href = String(input);
      if (!href.startsWith("https://slack.com/api/")) return realFetch(input, init);
      const method = href.replace("https://slack.com/api/", "");
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      if (method === "users.info") {
        const email = SLACK_PROFILES[params.user];
        return json(email ? { ok: true, user: { id: params.user, profile: { email, real_name: `Pessoa ${params.user}` } } } : { ok: false, error: "user_not_found" });
      }
      if (method === "chat.getPermalink") return json({ ok: true, permalink: "https://pitzi.slack.com/archives/C1/p123" });
      if (method === "chat.postMessage" && params.thread_ts) return json(postMessageOk ? { ok: true } : { ok: false, error: "not_in_channel" });
      return json({ ok: true });
    }) as any;
  });
  afterEach(() => { globalThis.fetch = realFetch; });
  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  it("recusa requisição sem assinatura válida", async () => {
    const res = await post("/api/slack/commands", "command=%2Fchamado&user_id=UTEC", { badSignature: true });
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("/chamado abre a janela; Usuário não vê Gravidade e o envio cria o chamado em nome dele", async () => {
    const res = await command("UUSR", "slack-test impressora parada\ndetalhes");
    expect(res.status).toBe(200);
    const view = viewOf("views.open");
    expect(calls.find((c) => c.method === "views.open")!.params.trigger_id).toBe("TRIG");
    expect(view.blocks.map((b: any) => b.block_id).filter(Boolean)).toEqual(["titulo", "descricao", "grupo", "tipo"]);
    expect(view.blocks.find((b: any) => b.block_id === "titulo").element.initial_value).toBe("slack-test impressora parada");

    const sub = await submit(view.private_metadata, { title: "slack-test impressora", category: "sap", impact: "critico" });
    expect(sub.status).toBe(200);
    const { rows } = await pool.query(
      "SELECT t.code, t.impact, t.description, u.email FROM tickets t JOIN users u ON u.id = t.requester_id WHERE t.title = 'slack-test impressora'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: `usuario@${DOMAIN}`, impact: "medio" });
    expect(rows[0].description).toBe("<p>descrição vinda do Slack</p>");
    const aviso = calls.find((c) => c.method === "chat.postEphemeral");
    expect(aviso!.params.text).toContain(rows[0].code);
    expect(aviso!.params.user).toBe("UUSR");
  });

  it("primeiro uso cria a pessoa como Usuário; domínio de fora é recusado", async () => {
    await command("UNOVO", "slack-test oi");
    const { rows } = await pool.query("SELECT is_technician, is_admin, slack_user_id FROM users WHERE email = $1", [`novo@${DOMAIN}`]);
    expect(rows[0]).toMatchObject({ is_technician: false, is_admin: false, slack_user_id: "UNOVO" });

    const fora = await command("UFORA", "slack-test oi");
    expect((await fora.json() as any).text).toContain("não é de um domínio liberado");
    expect(calls.filter((c) => c.method === "views.open")).toHaveLength(1);
  });

  const shortcut = (clicker: string, author: string) => interaction({
    type: "message_action", callback_id: "transformar_em_chamado", trigger_id: "TRIG2",
    user: { id: clicker }, channel: { id: "C1" },
    message: { user: author, ts: "1700000000.000100", text: "slack-test VPN caiu\nde novo hoje" },
  });

  it("atalho: Usuário não transforma mensagem de outra pessoa", async () => {
    await shortcut("UUSR", "UTEC");
    expect(calls.some((c) => c.method === "views.open")).toBe(false);
    expect(calls.find((c) => c.method === "chat.postEphemeral")!.params.text).toContain("Só técnicos");
  });

  it("atalho do técnico: solicitante é o autor, guarda a thread e responde nela", async () => {
    await shortcut("UTEC", "UUSR");
    const view = viewOf("views.open");
    const descricao = view.blocks.find((b: any) => b.block_id === "descricao");
    expect(descricao.element.initial_value).toContain("Mensagem original no Slack: https://pitzi.slack.com/archives/C1/p123");
    expect(view.blocks[0].elements[0].text).toContain("Solicitante: *Usuário Slack*");
    expect(view.blocks.some((b: any) => b.block_id === "gravidade")).toBe(true);

    await submit(view.private_metadata, { title: "slack-test VPN caiu", category: "sap", impact: "alto" });
    const { rows } = await pool.query(
      "SELECT t.code, t.impact, t.slack_channel_id, t.slack_thread_ts, u.email FROM tickets t JOIN users u ON u.id = t.requester_id WHERE t.title = 'slack-test VPN caiu'",
    );
    expect(rows[0]).toMatchObject({ email: `usuario@${DOMAIN}`, impact: "alto", slack_channel_id: "C1", slack_thread_ts: "1700000000.000100" });
    const reply = calls.find((c) => c.method === "chat.postMessage" && c.params.thread_ts)!;
    expect(reply.params.text).toContain(`Virou o chamado *${rows[0].code}*`);
  });

  it("sem acesso à conversa: avisa só quem clicou", async () => {
    postMessageOk = false;
    await shortcut("UTEC", "UTEC");
    await submit(viewOf("views.open").private_metadata, { title: "slack-test canal privado", category: "sap" });
    expect(calls.find((c) => c.method === "chat.postEphemeral")!.params.text).toContain("convide o app");
  });

  it("grupo com campo obrigatório volta erro na janela e não cria o chamado", async () => {
    await pool.query("INSERT INTO ticket_custom_fields (group_key, label, field_type, required, active) VALUES ('sap', 'slack-test Loja', 'text', true, true)");
    await command("UTEC", "slack-test x");
    const res = await submit(viewOf("views.open").private_metadata, { title: "slack-test obrigatorio", category: "sap" });
    const body = await res.json() as any;
    expect(body.response_action).toBe("errors");
    expect(body.errors.grupo).toContain("slack-test Loja");
    expect((await pool.query("SELECT 1 FROM tickets WHERE title = 'slack-test obrigatorio'")).rowCount).toBe(0);
  });
});
