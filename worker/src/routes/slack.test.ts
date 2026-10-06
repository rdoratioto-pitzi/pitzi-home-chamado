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
const SLACK_PROFILES: Record<string, string | null> = {
  UTEC: `tecnico@${DOMAIN}`,
  UUSR: `usuario@${DOMAIN}`,
  UNOEMAIL: null,
  UNOVO: `novo@${DOMAIN}`,
  UFORA: "alguem@outra-empresa.com",
};

describe.skipIf(!url)("Slack → chamado", () => {
  let pool: pg.Pool;
  let db: any;
  let calls: { method: string; params: Record<string, string> }[] = [];
  let postMessageOk = true;
  let ephemeralOk = true;
  // Thread simulada para conversations.replies (null = sem thread configurada → lista vazia).
  let threadMessages: any[] | null = null;
  let repliesError: string | null = null;
  const stored: { key: string; type?: string }[] = [];
  const realFetch = globalThis.fetch;

  const env = {
    SLACK_BOT_TOKEN: "xoxb-teste", SLACK_SIGNING_SECRET: SECRET, SLACK_ALLOWED_TEAM_ID: "T1",
    ALLOWED_GOOGLE_DOMAINS: DOMAIN, APP_URL: "https://app.test",
    ATTACHMENTS: { put: async (key: string, _v: unknown, o?: any) => { stored.push({ key, type: o?.httpMetadata?.contentType }); } },
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
    post("/api/slack/commands", new URLSearchParams({ team_id: "T1", command: "/chamado", text, user_id: userId, trigger_id: "TRIG", channel_id: "C1" }).toString());
  const interaction = (payload: unknown) =>
    post("/api/slack/interactions", new URLSearchParams({ payload: JSON.stringify(payload) }).toString());
  const viewOf = (method: string) => JSON.parse(calls.find((c) => c.method === method)!.params.view);
  const submit = (privateMetadata: string, values: { title: string; category: string; impact?: string }) =>
    interaction({
      type: "view_submission", team: { id: "T1" }, user: { id: JSON.parse(privateMetadata).clickerSlackId },
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
    await pool.query("DELETE FROM email_outbox WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'slack-test%' OR slack_channel_id = 'C1' OR description LIKE '%slack-test%')");
    await pool.query("DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE slack_channel_id = 'C1')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'slack-test%' OR slack_channel_id = 'C1' OR description LIKE '%slack-test%'");
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
        ('Usuário Slack', 'usuario@${DOMAIN}', 'active', false, false, '{"chamados":true}'),
        ('Usuário Sem Email Slack', 'sem-email@${DOMAIN}', 'active', false, false, '{"chamados":true}')`,
    );
    await pool.query("UPDATE users SET slack_user_id = 'UNOEMAIL' WHERE email = $1", [`sem-email@${DOMAIN}`]);
    calls = [];
    postMessageOk = true;
    ephemeralOk = true;
    threadMessages = null;
    repliesError = null;
    stored.length = 0;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const href = String(input);
      if (href.startsWith("https://files.slack.com/")) {
        calls.push({ method: "file", params: { url: href, auth: String(init?.headers?.Authorization ?? "") } });
        return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
      }
      if (!href.startsWith("https://slack.com/api/")) return realFetch(input, init);
      const method = href.replace("https://slack.com/api/", "");
      const params = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")));
      calls.push({ method, params });
      const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      if (method === "users.info") {
        const email = SLACK_PROFILES[params.user];
        if (email === null) return json({ ok: true, user: { id: params.user, profile: { real_name: `Pessoa ${params.user}` } } });
        return json(email ? { ok: true, user: { id: params.user, profile: { email, real_name: `Pessoa ${params.user}` } } } : { ok: false, error: "user_not_found" });
      }
      if (method === "chat.getPermalink") return json({ ok: true, permalink: "https://pitzi.slack.com/archives/C1/p123" });
      if (method === "conversations.replies") {
        if (repliesError) return json({ ok: false, error: repliesError });
        const all = threadMessages ?? [];
        return json({ ok: true, messages: Number(params.limit) === 1 ? all.slice(0, 1) : all });
      }
      if (method === "conversations.open") return json({ ok: true, channel: { id: "D1" } });
      if (method === "chat.postEphemeral") return json(ephemeralOk ? { ok: true } : { ok: false, error: "channel_not_found" });
      if (method === "chat.postMessage" && params.thread_ts) return json(postMessageOk ? { ok: true } : { ok: false, error: "not_in_channel" });
      return json({ ok: true });
    }) as any;
  });
  afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
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

  const shortcut = (clicker: string, author: string, options: { ts?: string; text?: string; threadTs?: string } = {}) => interaction({
    type: "message_action", callback_id: "transformar_em_chamado", trigger_id: "TRIG2", team: { id: "T1" },
    user: { id: clicker }, channel: { id: "C1", name: "suporte-ti" },
    message: {
      user: author,
      ts: options.ts ?? "1700000000.000100",
      ...(options.threadTs ? { thread_ts: options.threadTs } : {}),
      text: options.text ?? "slack-test VPN caiu\nde novo hoje",
    },
  });

  it("atalho: Usuário não transforma mensagem de outra pessoa", async () => {
    await shortcut("UUSR", "UTEC");
    expect(calls.some((c) => c.method === "views.open")).toBe(false);
    expect(calls.find((c) => c.method === "chat.postEphemeral")!.params.text).toContain("Só técnicos");
  });

  it("atalho do técnico: cria direto, solicitante é o autor, guarda a thread e responde nela", async () => {
    await shortcut("UTEC", "UUSR", { text: "slack-test não consigo conectar na VPN" });
    const { rows } = await pool.query(
      "SELECT t.code, t.title, t.impact, t.description, t.slack_team_id, t.slack_channel_id, t.slack_thread_ts, t.slack_message_ts, t.slack_user_id, t.slack_permalink, u.email FROM tickets t JOIN users u ON u.id = t.requester_id WHERE t.slack_message_ts = '1700000000.000100'",
    );
    expect(rows[0]).toMatchObject({
      email: `usuario@${DOMAIN}`,
      title: "Problema de acesso à VPN",
      impact: "medio",
      slack_team_id: "T1",
      slack_channel_id: "C1",
      slack_thread_ts: "1700000000.000100",
      slack_message_ts: "1700000000.000100",
      slack_user_id: "UUSR",
      slack_permalink: "https://pitzi.slack.com/archives/C1/p123",
    });
    expect(rows[0].description).toContain("Origem: Slack");
    expect(calls.some((c) => c.method === "views.open")).toBe(false);
    const reply = calls.find((c) => c.method === "chat.postMessage" && c.params.thread_ts)!;
    expect(reply.params.text).toContain(`Chamado ${rows[0].code} criado com sucesso`);
    expect(reply.params.blocks).toContain("Assumir");
  });

  it("sem acesso à conversa: avisa só quem clicou", async () => {
    postMessageOk = false;
    await shortcut("UTEC", "UTEC", { text: "slack-test canal privado" });
    expect(calls.find((c) => c.method === "chat.postEphemeral")!.params.text).toContain("convide o app");
  });

  it("atalho em thread salva a thread original", async () => {
    await shortcut("UTEC", "UUSR", { ts: "1700000000.000200", threadTs: "1699999999.000001", text: "slack-test notebook não liga" });
    const { rows } = await pool.query("SELECT title, slack_thread_ts FROM tickets WHERE slack_message_ts = '1700000000.000200'");
    expect(rows[0]).toMatchObject({ title: "Notebook não liga", slack_thread_ts: "1699999999.000001" });
    expect(calls.find((c) => c.method === "chat.postMessage" && c.params.thread_ts)!.params.thread_ts).toBe("1699999999.000001");
  });

  it("clique repetido no mesmo atalho não duplica chamado", async () => {
    await shortcut("UTEC", "UUSR", { text: "slack-test duplicado" });
    await shortcut("UTEC", "UUSR", { text: "slack-test duplicado" });
    const { rows } = await pool.query("SELECT count(*)::int AS total, max(code) AS code FROM tickets WHERE slack_channel_id = 'C1' AND slack_message_ts = '1700000000.000100'");
    expect(rows[0].total).toBe(1);
    const duplicateNotice = calls.find((c) => c.method === "chat.postMessage" && c.params.text.includes("já possui o chamado"));
    expect(duplicateNotice!.params.text).toContain(rows[0].code);
  });

  it("mensagem sem e-mail disponível usa usuário já relacionado pelo slack_user_id", async () => {
    await shortcut("UTEC", "UNOEMAIL", { ts: "1700000000.000300", text: "slack-test sem email" });
    const { rows } = await pool.query(
      "SELECT u.email FROM tickets t JOIN users u ON u.id = t.requester_id WHERE t.slack_message_ts = '1700000000.000300'",
    );
    expect(rows[0].email).toBe(`sem-email@${DOMAIN}`);
  });

  it("ações rápidas: técnico assume, move para atendimento e resolve", async () => {
    await shortcut("UTEC", "UUSR", { text: "slack-test ação rápida" });
    const { rows } = await pool.query("SELECT id FROM tickets WHERE slack_message_ts = '1700000000.000100'");
    const ticketId = rows[0].id;
    await pool.query("UPDATE users SET is_admin = true WHERE email = $1", [`tecnico@${DOMAIN}`]);

    await interaction({ type: "block_actions", team: { id: "T1" }, user: { id: "UTEC" }, channel: { id: "C1" }, actions: [{ action_id: "chamado_assumir", value: ticketId }] });
    await interaction({ type: "block_actions", team: { id: "T1" }, user: { id: "UTEC" }, channel: { id: "C1" }, actions: [{ action_id: "chamado_em_atendimento", value: ticketId }] });
    await interaction({ type: "block_actions", team: { id: "T1" }, user: { id: "UTEC" }, channel: { id: "C1" }, actions: [{ action_id: "chamado_resolver", value: ticketId }] });

    const updated = await pool.query("SELECT status, assignee_id, data_resolucao IS NOT NULL AS resolved FROM tickets WHERE id = $1", [ticketId]);
    const technician = await pool.query("SELECT id FROM users WHERE email = $1", [`tecnico@${DOMAIN}`]);
    expect(updated.rows[0]).toMatchObject({ status: "resolved", assignee_id: technician.rows[0].id, resolved: true });
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
  it("recusa workspace não autorizado", async () => {
    const res = await interaction({ type: "message_action", callback_id: "transformar_em_chamado", team: { id: "OUTSIDE" } });
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("recusa conta sem permissão de chamados", async () => {
    await pool.query("UPDATE users SET slack_user_id = 'UUSR', module_permissions = '{}' WHERE email = $1", [`usuario@${DOMAIN}`]);
    await shortcut("UUSR", "UUSR");
    expect(calls.find((c) => c.method === "chat.postEphemeral")?.params.text).toContain("permissão");
    expect((await pool.query("SELECT count(*)::int AS total FROM tickets WHERE slack_channel_id = 'C1'")).rows[0].total).toBe(0);
  });

  it("usuário comum não executa ações técnicas", async () => {
    await shortcut("UUSR", "UUSR");
    const { rows } = await pool.query("SELECT id FROM tickets WHERE slack_channel_id = 'C1'");
    await interaction({ type: "block_actions", team: { id: "T1" }, user: { id: "UUSR" }, channel: { id: "C1" }, actions: [{ action_id: "chamado_resolver", value: rows[0].id }] });
    expect((await pool.query("SELECT status FROM tickets WHERE id = $1", [rows[0].id])).rows[0].status).toBe("open");
    expect(calls.some((c) => c.params.text?.includes("Só técnicos podem atualizar"))).toBe(true);
  });

  it("cliques concorrentes não duplicam o chamado", async () => {
    await command("UTEC", "inicializar técnico");
    await command("UUSR", "inicializar usuário");
    calls = [];
    await Promise.all([shortcut("UTEC", "UUSR"), shortcut("UTEC", "UUSR")]);
    expect((await pool.query("SELECT count(*)::int AS total FROM tickets WHERE slack_channel_id = 'C1'")).rows[0].total).toBe(1);
  });

  it("falha de validação ao criar chamado é informada", async () => {
    await pool.query("INSERT INTO ticket_custom_fields (group_key, label, field_type, required, active) VALUES ('sap', 'slack-test obrigatório', 'text', true, true)");
    await shortcut("UUSR", "UUSR");
    expect(calls.some((c) => c.params.text?.includes("Não consegui abrir o chamado"))).toBe(true);
    expect((await pool.query("SELECT count(*)::int AS total FROM tickets WHERE slack_channel_id = 'C1'")).rows[0].total).toBe(0);
  });

  // ─── Conversa inteira ───────────────────────────────────────────────────────
  const ROOT = "1699999999.000001";
  const conversa = () => [
    { ts: ROOT, user: "UUSR", text: "slack-test meu notebook não liga", reply_count: 2 },
    { ts: "1699999999.000002", user: "UTEC", text: "Já tentou outro carregador, <@UUSR>?" },
    {
      ts: "1699999999.000003", user: "UUSR", text: "Sim, segue o print",
      files: [
        { name: "print.png", mimetype: "image/png", size: 4, url_private_download: "https://files.slack.com/files-pri/T1-F1/print.png" },
        { name: "logs.zip", mimetype: "application/zip", size: 100, url_private_download: "https://files.slack.com/files-pri/T1-F2/logs.zip" },
      ],
    },
  ];

  it("Criar chamado numa resposta leva a conversa inteira; solicitante é quem começou; anexos importados", async () => {
    threadMessages = conversa();
    await shortcut("UTEC", "UUSR", { ts: "1699999999.000003", threadTs: ROOT, text: "Sim, segue o print" });
    const { rows } = await pool.query(
      "SELECT t.title, t.description, t.attachments, t.slack_message_ts, t.slack_thread_ts, u.email FROM tickets t JOIN users u ON u.id = t.requester_id WHERE t.slack_channel_id = 'C1'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: `usuario@${DOMAIN}`, title: "Notebook não liga", slack_message_ts: ROOT, slack_thread_ts: ROOT });
    const d = rows[0].description as string;
    expect(d).toContain("Conversa no Slack");
    expect(d).toContain("3 mensagens");
    // Ordem e nomes, com a menção convertida.
    expect(d.indexOf("meu notebook não liga")).toBeLessThan(d.indexOf("outro carregador"));
    expect(d.indexOf("outro carregador")).toBeLessThan(d.indexOf("segue o print"));
    expect(d).toContain("@Pessoa UUSR");
    expect(d).toContain("Origem: Slack");
    // Anexo aceito foi para o R2 com o token do bot; o .zip ficou listado como não importado.
    expect(JSON.parse(rows[0].attachments)).toHaveLength(1);
    expect(stored).toHaveLength(1);
    expect(calls.find((c) => c.method === "file")!.params.auth).toBe("Bearer xoxb-teste");
    expect(d).toContain("não foram importados: logs.zip");
    expect(calls.find((c) => c.method === "chat.postMessage" && c.params.thread_ts)!.params.thread_ts).toBe(ROOT);
  });

  it("a mesma conversa não vira dois chamados, mesmo clicando em outra resposta", async () => {
    threadMessages = conversa();
    await shortcut("UTEC", "UUSR", { ts: "1699999999.000003", threadTs: ROOT });
    await shortcut("UTEC", "UTEC", { ts: "1699999999.000002", threadTs: ROOT });
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM tickets WHERE slack_channel_id = 'C1'");
    expect(rows[0].n).toBe(1);
    expect(calls.some((c) => c.method === "chat.postMessage" && String(c.params.text).includes("já possui o chamado"))).toBe(true);
  });

  it("Usuário não transforma conversa iniciada por outra pessoa, mesmo clicando na própria resposta", async () => {
    threadMessages = [{ ts: ROOT, user: "UTEC", text: "slack-test aviso geral", reply_count: 1 }, { ts: "1699999999.000002", user: "UUSR", text: "comigo também" }];
    await shortcut("UUSR", "UUSR", { ts: "1699999999.000002", threadTs: ROOT });
    expect((await pool.query("SELECT count(*)::int AS n FROM tickets WHERE slack_channel_id = 'C1'")).rows[0].n).toBe(0);
    expect(calls.find((c) => c.method === "chat.postEphemeral")!.params.text).toContain("conversas iniciadas por outras pessoas");
  });

  it("sem permissão para ler a conversa: avisa e cria só com a mensagem clicada", async () => {
    repliesError = "missing_scope";
    await shortcut("UTEC", "UUSR", { ts: "1699999999.000003", threadTs: ROOT, text: "slack-test só esta mensagem" });
    const { rows } = await pool.query("SELECT slack_message_ts, description FROM tickets WHERE slack_channel_id = 'C1'");
    expect(rows[0].slack_message_ts).toBe("1699999999.000003");
    expect(rows[0].description).not.toContain("Conversa no Slack");
    expect(calls.some((c) => c.method === "chat.postEphemeral" && String(c.params.text).includes("channels:history"))).toBe(true);
  });

  it("app fora do canal privado: confirmação vai por DM (conversations.open) com o link e o /invite", async () => {
    postMessageOk = false;
    ephemeralOk = false;
    await shortcut("UTEC", "UUSR", { text: "slack-test canal privado sem app" });
    expect(calls.some((c) => c.method === "conversations.open" && c.params.users === "UTEC")).toBe(true);
    const dm = calls.find((c) => c.method === "chat.postMessage" && c.params.channel === "D1")!;
    expect(dm.params.text).toContain("aberto");
    expect(dm.params.text).toContain("/invite @Chamados Pitzi");
  });

  it("Criar chamado avançado numa resposta: janela com a raiz e, no envio, a conversa inteira", async () => {
    threadMessages = conversa();
    await interaction({
      type: "message_action", callback_id: "criar_chamado_avancado", team: { id: "T1" }, trigger_id: "TRIG", user: { id: "UTEC" },
      channel: { id: "C1", name: "suporte-ti" }, message: { user: "UUSR", ts: "1699999999.000002", thread_ts: ROOT, text: "resposta" },
    });
    const view = viewOf("views.open");
    expect(JSON.stringify(view.blocks)).toContain("quem começou a conversa");
    const meta = JSON.parse(view.private_metadata);
    expect(meta).toMatchObject({ requesterSlackId: "UUSR", messageTs: ROOT, threadTs: ROOT, conversation: true });
    await submit(view.private_metadata, { title: "slack-test avançado conversa", category: "sap" });
    const { rows } = await pool.query("SELECT description, attachments FROM tickets WHERE slack_channel_id = 'C1'");
    expect(rows[0].description).toContain("descrição vinda do Slack");
    expect(rows[0].description).toContain("Conversa no Slack");
    expect(JSON.parse(rows[0].attachments)).toHaveLength(1);
  });

  // ─── Responsável ao converter ───────────────────────────────────────────────
  it("técnico que converte conversa de outra pessoa vira o responsável e enxerga o chamado", async () => {
    await shortcut("UTEC", "UUSR", { ts: "1700000000.000400", text: "slack-test técnico converte" });
    const { rows } = await pool.query(
      `SELECT t.id, t.code, a.email AS responsavel, r.email AS solicitante FROM tickets t
         JOIN users r ON r.id = t.requester_id LEFT JOIN users a ON a.id = t.assignee_id
        WHERE t.slack_message_ts = '1700000000.000400'`,
    );
    expect(rows[0]).toMatchObject({ responsavel: `tecnico@${DOMAIN}`, solicitante: `usuario@${DOMAIN}` });
    // Nota interna de quem converteu e confirmação com o responsável.
    const notas = (await pool.query("SELECT content, is_internal FROM ticket_comments WHERE ticket_id = $1", [rows[0].id])).rows;
    expect(notas.some((n) => n.is_internal && String(n.content).includes("Chamado criado pelo Slack por Técnico Slack"))).toBe(true);
    const reply = calls.find((c) => c.method === "chat.postMessage" && c.params.thread_ts)!;
    expect(reply.params.text).toContain("Responsável: Técnico Slack");
    // Sem e-mail de atribuição para quem se atribuiu.
    expect((await pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE ticket_id = $1 AND event = 'ticket_assigned'", [rows[0].id])).rows[0].n).toBe(0);
    // Como responsável, o técnico enxerga o chamado (mesma regra das rotas).
    const { canViewTicket } = await import("../../../server/services/ticket-queue.service");
    const { getStorage } = await import("../lib/storage");
    const tecnico = (await pool.query("SELECT id FROM users WHERE email = $1", [`tecnico@${DOMAIN}`])).rows[0];
    const storage = getStorage(db);
    expect(await canViewTicket(storage, { userId: tecnico.id, isAdmin: false, tenantId: null }, await storage.getTicket(rows[0].id))).toBe(true);
  });

  it("Usuário que converte a própria mensagem não vira responsável", async () => {
    await shortcut("UUSR", "UUSR", { ts: "1700000000.000500", text: "slack-test usuário converte" });
    const { rows } = await pool.query("SELECT assignee_id FROM tickets WHERE slack_message_ts = '1700000000.000500'");
    expect(rows[0].assignee_id).toBeNull();
    expect(calls.find((c) => c.method === "chat.postMessage" && c.params.thread_ts)!.params.text).toContain("Responsável: Não atribuído");
  });

  it("avançado: técnico que converte vira o responsável", async () => {
    await interaction({ type: "message_action", callback_id: "criar_chamado_avancado", team: { id: "T1" }, trigger_id: "TRIG", user: { id: "UTEC" }, channel: { id: "C1" }, message: { user: "UUSR", ts: "1700000000.000600", text: "slack-test avançado técnico" } });
    await submit(viewOf("views.open").private_metadata, { title: "slack-test avançado técnico", category: "sap" });
    const { rows } = await pool.query(
      "SELECT a.email FROM tickets t LEFT JOIN users a ON a.id = t.assignee_id WHERE t.slack_message_ts = '1700000000.000600'",
    );
    expect(rows[0].email).toBe(`tecnico@${DOMAIN}`);
  });

  it("atalho avançado mantém o formulário e cria com relação Slack", async () => {
    await interaction({ type: "message_action", callback_id: "criar_chamado_avancado", team: { id: "T1" }, trigger_id: "TRIG", user: { id: "UUSR" }, channel: { id: "C1" }, message: { user: "UUSR", ts: "1700000000.000100", text: "slack-test avançado" } });
    const view = viewOf("views.open");
    await submit(view.private_metadata, { title: "slack-test avançado", category: "sap" });
    expect((await pool.query("SELECT slack_team_id FROM tickets WHERE slack_channel_id = 'C1'")).rows[0].slack_team_id).toBe("T1");
  });

  it("eventos repetidos criam uma nota interna e ignoram bots", async () => {
    await shortcut("UUSR", "UUSR");
    const { recordSlackThreadMessage } = await import("../lib/slack-thread-sync");
    const event = { type: "message", user: "UUSR", channel: "C1", thread_ts: "1700000000.000100", ts: "1700000001.000100", text: "slack-test verificando" };
    await Promise.all([recordSlackThreadMessage(db, env as any, "T1", event), recordSlackThreadMessage(db, env as any, "T1", event)]);
    await recordSlackThreadMessage(db, env as any, "T1", { ...event, ts: "1700000002.000100", bot_id: "BOT" });
    const { rows } = await pool.query("SELECT source, is_internal FROM ticket_comments WHERE slack_message_key IS NOT NULL");
    expect(rows).toEqual([{ source: "slack", is_internal: true }]);
  });

  it("erro inesperado ao criar ticket não produz confirmação de sucesso", async () => {
    const creator = await import("../lib/create-ticket");
    vi.spyOn(creator, "createTicketFor").mockRejectedValueOnce(new Error("simulated database failure"));
    await shortcut("UUSR", "UUSR");
    expect(calls.some((c) => c.params.text?.includes("Não consegui abrir o chamado"))).toBe(true);
    expect(calls.some((c) => c.params.text?.includes("criado com sucesso"))).toBe(false);
  });

  it("falha de permalink não impede criação e não inventa link", async () => {
    const mockedFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      if (String(input).endsWith("/chat.getPermalink")) return new Response(JSON.stringify({ ok: false, error: "missing_scope" }));
      return mockedFetch(input, init);
    }) as any;
    await shortcut("UUSR", "UUSR");
    const { rows } = await pool.query("SELECT slack_permalink, description FROM tickets WHERE slack_channel_id = 'C1'");
    expect(rows[0].slack_permalink).toBeNull();
    expect(rows[0].description).toContain("permalink indisponível");
  });

  it("autor sem e-mail e sem vínculo é recusado sem criar identidade falsa", async () => {
    await pool.query("UPDATE users SET slack_user_id = NULL WHERE slack_user_id = 'UNOEMAIL'");
    await shortcut("UTEC", "UNOEMAIL");
    expect(calls.some((c) => c.params.text?.includes("e-mail"))).toBe(true);
    expect((await pool.query("SELECT count(*)::int AS total FROM tickets WHERE slack_channel_id = 'C1'")).rows[0].total).toBe(0);
  });

  it("nota interna só sai com opt-in separado; origem Slack não é reenviada", async () => {
    await shortcut("UUSR", "UUSR");
    const ticket = (await db.select().from(schema.tickets)).find((t: any) => t.slackChannelId === "C1");
    const { sendCommentToSlackThread } = await import("../lib/slack-thread-sync");
    const note = { id: "note", source: "app", content: "<p>Teste de nota</p>", isInternal: true } as any;
    const syncEnv = { ...env, SLACK_THREAD_SYNC_ENABLED: "true" } as any;
    calls = [];
    await sendCommentToSlackThread(syncEnv, ticket, note);
    expect(calls).toHaveLength(0);
    syncEnv.SLACK_INTERNAL_NOTES_TO_THREAD_ENABLED = "true";
    await sendCommentToSlackThread(syncEnv, ticket, note);
    expect(calls).toHaveLength(1);
    expect(calls[0].params.thread_ts).toBe(ticket.slackThreadTs);
    await sendCommentToSlackThread(syncEnv, ticket, { ...note, source: "slack" });
    expect(calls).toHaveLength(1);
  });

  it("ações não alcançam chamados de outro tenant", async () => {
    await shortcut("UUSR", "UUSR");
    const { rows } = await pool.query("UPDATE tickets SET tenant_id = 'another-tenant' WHERE slack_channel_id = 'C1' RETURNING id");
    await pool.query("UPDATE users SET is_admin = true WHERE email = $1", [`tecnico@${DOMAIN}`]);
    await interaction({ type: "block_actions", team: { id: "T1" }, user: { id: "UTEC" }, channel: { id: "C1" }, actions: [{ action_id: "chamado_assumir", value: rows[0].id }] });
    expect((await pool.query("SELECT assignee_id FROM tickets WHERE id = $1", [rows[0].id])).rows[0].assignee_id).toBeNull();
  });

  it("verificação de URL exige assinatura e aceita challenge sem team_id", async () => {
    const body = JSON.stringify({ type: "url_verification", challenge: "challenge-test" });
    expect((await post("/api/slack/events", body, { badSignature: true })).status).toBe(401);
    expect(await (await post("/api/slack/events", body)).json()).toEqual({ challenge: "challenge-test" });
  });

});
