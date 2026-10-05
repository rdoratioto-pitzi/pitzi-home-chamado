// Integração: respostas por e-mail viram comentários. Gmail simulado (fetch), banco real.
// Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com as migrations aplicadas).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";
import { clearGmailTokenCache } from "./gmail";

const { processInboundEmails, LABEL_PROCESSED, LABEL_IGNORED } = await import("./inbound-email");

const url = process.env.TEST_DATABASE_URL;
const b64url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe.skipIf(!url)("respostas por e-mail", () => {
  let pool: pg.Pool;
  let db: any;
  let pem = "";
  const ids: Record<string, string> = {};
  let ticketId = "";
  let ticketCode = "";
  let inbox: Record<string, any> = {};
  let modified: Record<string, any> = {};
  let sent = 0;
  let tokenError: string | null = null;

  const env = () => ({
    GOOGLE_SA_CLIENT_EMAIL: "envio@test.iam.gserviceaccount.com",
    GOOGLE_SA_PRIVATE_KEY: pem,
    GMAIL_SENDER: "chamados@pitzi.com.br",
    APP_URL: "https://app.test",
  });

  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      return tokenError ? json({ error: tokenError }, 401) : json({ access_token: "tok", expires_in: 3600 });
    }
    if (u.endsWith("/messages/send")) { sent++; return json({ id: `sent-${sent}` }); }
    if (u.endsWith("/labels") && (!init || init.method !== "POST")) return json({ labels: [] });
    if (u.endsWith("/labels")) return json({ id: `L-${JSON.parse(String(init!.body)).name}` });
    const modify = u.match(/\/messages\/([^/?]+)\/modify$/);
    if (modify) { modified[modify[1]] = JSON.parse(String(init!.body)); return json({}); }
    if (u.includes("/messages?")) return json({ messages: Object.keys(inbox).filter((id) => !modified[id]).map((id) => ({ id })) });
    const get = u.match(/\/messages\/([^/?]+)\?format=full$/);
    if (get) return json(inbox[decodeURIComponent(get[1])]);
    return json({ error: `rota não simulada ${u}` }, 404);
  }) as typeof fetch;

  const message = (id: string, headers: Record<string, string>, text: string) => {
    inbox[id] = {
      id,
      payload: {
        mimeType: "multipart/alternative",
        headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
        parts: [{ mimeType: "text/plain", body: { data: b64url(text) } }],
      },
    };
  };

  const run = () => processInboundEmails(env() as any, db, { limit: 25 }, { fetch: fakeFetch });

  async function cleanup() {
    await pool.query("DELETE FROM inbound_email_log WHERE gmail_message_id LIKE 'inb-test-%'");
    await pool.query("DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'inbound-test%')");
    await pool.query("DELETE FROM email_outbox WHERE ticket_id IN (SELECT id FROM tickets WHERE title LIKE 'inbound-test%')");
    await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@inbound-test.local')");
    await pool.query("DELETE FROM tickets WHERE title LIKE 'inbound-test%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@inbound-test.local'");
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    const pair = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true, ["sign", "verify"],
    )) as CryptoKeyPair;
    const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
    let binary = "";
    for (const b of pkcs8) binary += String.fromCharCode(b);
    pem = `-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----\n`;
  });

  beforeEach(async () => {
    await cleanup();
    clearGmailTokenCache();
    inbox = {}; modified = {}; sent = 0; tokenError = null;
    for (const [key, tech, admin] of [["solic", false, false], ["tec", true, false], ["outsider", false, false]] as const) {
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, status, is_admin, is_technician) VALUES ($1, $2, 'active', $3, $4) RETURNING id",
        [key, `${key}@inbound-test.local`, admin, tech],
      );
      ids[key] = rows[0].id;
    }
    const { rows } = await pool.query(
      `INSERT INTO tickets (code, title, description, category, type, status, requester_id, assignee_id)
       VALUES ('CHA-9' || lpad((floor(random() * 1000000))::int::text, 6, '0'), 'inbound-test impressora', 'd', 'helpdesk', 'bug', 'waiting_requester', $1, $2)
       RETURNING id, code`,
      [ids.solic, ids.tec],
    );
    ticketId = rows[0].id; ticketCode = rows[0].code;
    await pool.query("UPDATE tickets SET sla_pausado_em = now() - interval '1 hour' WHERE id = $1", [ticketId]);
    await pool.query(
      `INSERT INTO email_outbox (event, ticket_id, to_email, subject, html, text, status, message_id_header)
       VALUES ('agent_reply', $1, 'solic@inbound-test.local', 's', 'h', 't', 'sent', '<chamado-inbtest@pitzi.com.br>')`,
      [ticketId],
    );
  });

  afterAll(async () => {
    await cleanup();
    await pool?.end();
  });

  const comments = async () => (await pool.query(
    "SELECT user_id, content, source, inbound_email_id, is_internal FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at", [ticketId],
  )).rows;

  it("resposta do solicitante vira comentário público 'via e-mail', sem o histórico, e volta o chamado para atendimento", async () => {
    message("inb-test-1", {
      From: "Solicitante <SOLIC@inbound-test.local>",
      Subject: "Re: [CHA-9999] inbound-test impressora",
      "In-Reply-To": "<chamado-inbtest@pitzi.com.br>",
      References: "<chamado-inbtest@pitzi.com.br>",
    }, "Testei e continua sem imprimir.\n\nEm seg., 5 de out. de 2026 às 10:00, Chamados Pitzi <chamados@pitzi.com.br> escreveu:\n> Pode testar?");
    const result = await run();
    expect(result).toMatchObject({ status: "ok", processed: 1, ignored: 0 });
    const rows = await comments();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: ids.solic, source: "email", inbound_email_id: "inb-test-1", is_internal: false });
    expect(rows[0].content).toBe("<p>Testei e continua sem imprimir.</p>");
    const t = (await pool.query("SELECT status, sla_pausado_em, sla_pausa_minutos FROM tickets WHERE id = $1", [ticketId])).rows[0];
    expect(t.status).toBe("in_progress");
    expect(t.sla_pausado_em).toBeNull();
    expect(modified["inb-test-1"]).toEqual({ addLabelIds: [`L-${LABEL_PROCESSED}`], removeLabelIds: ["INBOX"] });
    // O responsável recebe o e-mail da resposta; o próprio solicitante não.
    const outbox = (await pool.query("SELECT to_email, event FROM email_outbox WHERE ticket_id = $1 AND event = 'requester_reply'", [ticketId])).rows;
    expect(outbox.map((r: any) => r.to_email)).toEqual(["tec@inbound-test.local"]);
  });

  it("não duplica: a mesma mensagem processada de novo não cria outro comentário", async () => {
    message("inb-test-2", { From: "solic@inbound-test.local", Subject: `Re: [${ticketCode}] x` }, "ok");
    await run();
    delete modified["inb-test-2"]; // simula falha ao marcar no Gmail
    await pool.query("DELETE FROM inbound_email_log WHERE gmail_message_id = 'inb-test-2'"); // e no log
    const second = await run();
    expect(second.processed).toBe(1);
    expect(await comments()).toHaveLength(1);
  });

  it("identifica pelo código do assunto quando não há cabeçalhos da conversa", async () => {
    message("inb-test-3", { From: "tec@inbound-test.local", Subject: `RES: [${ticketCode.toLowerCase()}] impressora` }, "Troquei o toner.");
    const result = await run();
    expect(result.processed).toBe(1);
    expect((await comments())[0]).toMatchObject({ user_id: ids.tec, source: "email" });
  });

  it("ignora resposta automática, a própria caixa, quem não tem acesso e chamado não identificado", async () => {
    message("inb-test-4", { From: "solic@inbound-test.local", Subject: `[${ticketCode}]`, "Auto-Submitted": "auto-replied" }, "Estou de férias");
    message("inb-test-5", { From: "chamados@pitzi.com.br", Subject: `[${ticketCode}]` }, "loop");
    message("inb-test-6", { From: "outsider@inbound-test.local", Subject: `[${ticketCode}]` }, "quero ver");
    message("inb-test-7", { From: "solic@inbound-test.local", Subject: "Sem código" }, "oi");
    const result = await run();
    expect(result).toMatchObject({ processed: 0, ignored: 4 });
    expect(await comments()).toHaveLength(0);
    for (const id of ["inb-test-4", "inb-test-5", "inb-test-6", "inb-test-7"]) {
      expect(modified[id].addLabelIds).toEqual([`L-${LABEL_IGNORED}`]);
    }
    const reasons = (await pool.query("SELECT gmail_message_id, reason FROM inbound_email_log WHERE gmail_message_id LIKE 'inb-test-%' ORDER BY gmail_message_id")).rows;
    expect(reasons.map((r: any) => r.reason)).toEqual([
      "Resposta automática (Auto-Submitted)",
      "Enviada pela própria caixa de chamados",
      "Remetente sem acesso ao chamado",
      "Chamado não identificado",
    ]);
  });

  it("sem o escopo gmail.modify autorizado: não lê e registra o aviso para o painel", async () => {
    tokenError = "unauthorized_client";
    message("inb-test-8", { From: "solic@inbound-test.local", Subject: `[${ticketCode}]` }, "oi");
    const result = await run();
    expect(result.status).toBe("scope_missing");
    expect(await comments()).toHaveLength(0);
    const status = (await pool.query("SELECT value FROM settings WHERE key = 'inbound_email_status'")).rows[0];
    expect(JSON.parse(status.value)).toMatchObject({ ok: false, scopeOk: false });
  });
});
