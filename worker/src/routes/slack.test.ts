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
  // conversations.replies simulado: mensagens da thread ou erro (ex.: missing_scope).
  let thread: any[] = [];
  let repliesError: string | null = null;
  // Download de anexos: false simula app sem files:read (Slack devolve a página de login).
  let filesReadOk = true;
  const saved: string[] = [];
  const realFetch = globalThis.fetch;

  const env = {
    SLACK_BOT_TOKEN: "xoxb-teste", SLACK_SIGNING_SECRET: SECRET,
    ALLOWED_GOOGLE_DOMAINS: DOMAIN, APP_URL: "https://app.test",
    ATTACHMENTS: { put: vi.fn(async (key: string) => { saved.push(key); }) },
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
    thread = [];
    repliesError = null;
    filesReadOk = true;
    saved.length = 0;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const href = String(input);
      if (href.startsWith("https://files.slack.com/")) {
        expect(init?.headers?.Authorization).toBe("Bearer xoxb-teste");
        return filesReadOk
          ? new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })
          : new Response("<html>login</html>", { headers: { "content-type": "text/html" } });
      }
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
      if (method === "conversations.replies") {
        if (repliesError) return json({ ok: false, error: repliesError });
        const limit = Number(params.limit || 200);
        return json({ ok: true, messages: thread.slice(0, limit), response_metadata: { next_cursor: "" } });
      }
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
    thread = [{ ts: "1700000000.000100", user: "UUSR", text: "slack-test VPN caiu\nde novo hoje" }];
    await shortcut("UTEC", "UUSR");
    const view = viewOf("views.open");
    const descricao = view.blocks.find((b: any) => b.block_id === "descricao");
    expect(descricao.element.initial_value).toBe("slack-test VPN caiu\nde novo hoje");
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

  // Conversa: raiz de UUSR, resposta de UTEC com menção e link, resposta de bot; anexos na raiz.
  const ROOT_TS = "1759680000.000100";
  const conversa = () => [
    {
      ts: ROOT_TS, user: "UUSR", text: "slack-test impressora do 3º andar parou", reply_count: 2,
      files: [
        { name: "erro.png", mimetype: "image/png", size: 3, url_private_download: "https://files.slack.com/erro.png" },
        { name: "setup.exe", mimetype: "application/x-msdownload", size: 3, url_private_download: "https://files.slack.com/setup.exe" },
      ],
    },
    { ts: "1759680060.000200", thread_ts: ROOT_TS, user: "UTEC", text: "<@UUSR> reiniciou? veja <https://wiki.test/impressora|o guia>" },
    { ts: "1759680120.000300", thread_ts: ROOT_TS, bot_id: "B1", bot_profile: { name: "Monitor" }, text: "fila de impressão travada" },
  ];
  const shortcutReply = (clicker: string, author: string) => interaction({
    type: "message_action", callback_id: "transformar_em_chamado", trigger_id: "TRIG3",
    user: { id: clicker }, channel: { id: "C1", name: "suporte" },
    message: { user: author, ts: "1759680060.000200", thread_ts: ROOT_TS, text: "reiniciou?" },
  });

  it("atalho em resposta: leva a conversa inteira; solicitante é quem começou; anexos importados", async () => {
    thread = conversa();
    await shortcutReply("UTEC", "UTEC");
    const view = viewOf("views.open");
    // A raiz foi lida para achar quem começou (limit 1) — e o título vem dela.
    expect(calls.find((c) => c.method === "conversations.replies")!.params).toMatchObject({ ts: ROOT_TS, limit: "1" });
    expect(view.blocks.find((b: any) => b.block_id === "titulo").element.initial_value).toBe("slack-test impressora do 3º andar parou");
    expect(view.blocks[0].elements[0].text).toContain("Solicitante: *Usuário Slack* (quem começou a conversa)");
    expect(view.blocks[0].elements[0].text).toContain("3 mensagens");

    await submit(view.private_metadata, { title: "slack-test impressora", category: "sap" });
    const { rows } = await pool.query(
      `SELECT t.description, t.attachments, t.slack_thread_ts, t.slack_message_ts, u.email
         FROM tickets t JOIN users u ON u.id = t.requester_id WHERE t.title = 'slack-test impressora'`,
    );
    expect(rows[0]).toMatchObject({ email: `usuario@${DOMAIN}`, slack_thread_ts: ROOT_TS, slack_message_ts: "1759680060.000200" });
    const d: string = rows[0].description;
    expect(d).toContain("<strong>Conversa no Slack</strong> (#suporte, 3 mensagens)");
    const ordem = [
      "<strong>Pessoa UUSR</strong>",
      "<strong>Pessoa UTEC</strong> (05/10 13:01): @Pessoa UUSR reiniciou? veja o guia (https://wiki.test/impressora)",
      "<strong>Monitor</strong>",
    ].map((p) => d.indexOf(p));
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(d).toContain("Anexos da conversa que não foram importados: setup.exe");
    const anexos = JSON.parse(rows[0].attachments);
    expect(anexos).toHaveLength(1);
    expect(anexos[0]).toMatchObject({ name: "erro.png", type: "image/png", size: 3 });
    expect(saved).toHaveLength(1);
  });

  it("atalho em resposta: Usuário não transforma conversa começada por outra pessoa", async () => {
    thread = conversa().map((m, i) => (i === 0 ? { ...m, user: "UTEC" } : m));
    await shortcutReply("UUSR", "UUSR");
    expect(calls.some((c) => c.method === "views.open")).toBe(false);
    expect(calls.find((c) => c.method === "chat.postEphemeral")!.params.text).toContain("Só técnicos");
  });

  it("sem permissão para ler a conversa: avisa e segue só com a mensagem escolhida", async () => {
    repliesError = "missing_scope";
    await shortcutReply("UTEC", "UTEC");
    const aviso = calls.find((c) => c.method === "chat.postEphemeral")!;
    expect(aviso.params.text).toContain("channels:history");
    const view = viewOf("views.open");
    expect(view.blocks[0].elements[0].text).toContain("Só a mensagem escolhida");
    await submit(view.private_metadata, { title: "slack-test sem escopo", category: "sap" });
    const { rows } = await pool.query("SELECT description, slack_thread_ts FROM tickets WHERE title = 'slack-test sem escopo'");
    expect(rows[0].description).toContain("Mensagem original no Slack: https://pitzi.slack.com/archives/C1/p123");
    expect(rows[0].slack_thread_ts).toBe("1759680060.000200");
  });

  it("sem files:read: chamado criado, anexos não vêm e quem clicou é avisado", async () => {
    thread = conversa();
    filesReadOk = false;
    await shortcutReply("UTEC", "UTEC");
    await submit(viewOf("views.open").private_metadata, { title: "slack-test sem files", category: "sap" });
    const { rows } = await pool.query("SELECT description, attachments FROM tickets WHERE title = 'slack-test sem files'");
    expect(rows[0].attachments).toBeNull();
    expect(rows[0].description).toContain("não foram importados: setup.exe, erro.png");
    expect(calls.some((c) => c.method === "chat.postEphemeral" && c.params.text.includes("files:read"))).toBe(true);
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
