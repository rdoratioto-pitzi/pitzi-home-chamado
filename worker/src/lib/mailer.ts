// Envio de e-mails no Worker: escolhe o transporte (Gmail; SendPulse só como reserva, se os
// segredos dele existirem), grava na fila (email_outbox) e dispara o envio em segundo plano
// sem segurar a requisição. O cron (worker/src/index.ts) repete o que falhou.
import { buildMimeMessage, base64UrlUtf8, emailDomain, newMessageId } from "../../../shared/email-mime";
import { EMAIL_SETTINGS_KEY, parseEmailSettings, type EmailSettings } from "../../../shared/email-settings";
import type { EmailOutboxRow, InsertEmailOutbox } from "../../../shared/schema";
import {
  NOT_CONFIGURED_ERROR,
  enqueueEmails,
  processOutbox,
  releaseStuckEmails,
  type DeliveryResult,
} from "../../../server/services/email-outbox.service";
import { getStorage } from "./storage";
import { isGmailConfigured, sendGmailRaw, type GmailEnv } from "./gmail";

export interface MailEnv extends GmailEnv {
  APP_URL: string;
  SENDPULSE_CLIENT_ID?: string;
  SENDPULSE_CLIENT_SECRET?: string;
  SENDPULSE_FROM_NAME?: string;
  SENDPULSE_FROM_EMAIL?: string;
}

export type MailProvider = "gmail" | "sendpulse";

/** Contexto de uma requisição (ou do cron) para gravar e enviar e-mails. */
export interface MailContext {
  env: MailEnv;
  db: any;
  waitUntil?: (promise: Promise<unknown>) => void;
}

/** Monta o contexto a partir do Hono. executionCtx não existe em alguns testes: segue sem ele. */
export function mailContext(c: { env: unknown; get: (key: "db") => unknown; executionCtx?: unknown }): MailContext {
  let waitUntil: MailContext["waitUntil"];
  try {
    const ctx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    if (ctx?.waitUntil) waitUntil = (p) => ctx.waitUntil!(p);
  } catch {
    waitUntil = undefined;
  }
  return { env: (c.env ?? {}) as MailEnv, db: c.get("db"), waitUntil };
}

export function sendPulseConfigured(env: MailEnv): boolean {
  return !!(env.SENDPULSE_CLIENT_ID && env.SENDPULSE_CLIENT_SECRET && env.SENDPULSE_FROM_EMAIL);
}

export function getMailTransportStatus(env: MailEnv): { provider: MailProvider | null; sender: string | null } {
  if (isGmailConfigured(env)) return { provider: "gmail", sender: env.GMAIL_SENDER! };
  if (sendPulseConfigured(env)) return { provider: "sendpulse", sender: env.SENDPULSE_FROM_EMAIL! };
  return { provider: null, sender: env.GMAIL_SENDER || null };
}

export async function loadEmailSettings(db: any): Promise<EmailSettings> {
  try {
    const setting = await getStorage(db).getSetting(EMAIL_SETTINGS_KEY);
    return parseEmailSettings(setting?.value);
  } catch {
    return parseEmailSettings(null);
  }
}

// ── SendPulse (reserva) ─────────────────────────────────────────────────────────
let sendPulseToken: { token: string; expiresAt: number } | null = null;

async function getSendPulseToken(env: MailEnv): Promise<string> {
  if (sendPulseToken && Date.now() < sendPulseToken.expiresAt) return sendPulseToken.token;
  const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.SENDPULSE_CLIENT_ID,
      client_secret: env.SENDPULSE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`SendPulse auth falhou: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  sendPulseToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return sendPulseToken.token;
}

async function sendViaSendPulse(
  env: MailEnv,
  msg: { to: { name: string; email: string }[]; subject: string; html: string; fromName?: string; attachments_binary?: Record<string, string> },
): Promise<void> {
  const token = await getSendPulseToken(env);
  const email: Record<string, unknown> = {
    subject: msg.subject,
    html: msg.html,
    from: { name: msg.fromName || env.SENDPULSE_FROM_NAME || "Pitzi", email: env.SENDPULSE_FROM_EMAIL },
    to: msg.to,
  };
  if (msg.attachments_binary) email.attachments_binary = msg.attachments_binary;
  const res = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`SendPulse envio falhou: ${res.status} ${await res.text()}`);
}

// ── Entrega de uma linha da fila ────────────────────────────────────────────────

export async function deliverOutboxRow(env: MailEnv, settings: EmailSettings, row: EmailOutboxRow): Promise<DeliveryResult> {
  const status = getMailTransportStatus(env);
  if (!status.provider) return { ok: false, error: NOT_CONFIGURED_ERROR, permanent: true };
  if (!row.toEmail) return { ok: false, error: "Destinatário sem e-mail", permanent: true };

  if (status.provider === "gmail") {
    const sender = env.GMAIL_SENDER!;
    const raw = buildMimeMessage({
      from: { name: settings.senderName, email: sender },
      to: { email: row.toEmail },
      replyTo: settings.replyTo ? { email: settings.replyTo } : null,
      subject: row.subject,
      html: row.html,
      text: row.text,
      messageId: row.messageIdHeader || newMessageId(emailDomain(sender)),
      threadRootId: row.threadRootId,
    });
    const sent = await sendGmailRaw(env, base64UrlUtf8(raw));
    return { ok: true, provider: "gmail", providerMessageId: sent.id };
  }

  await sendViaSendPulse(env, {
    to: [{ name: row.toEmail, email: row.toEmail }],
    subject: row.subject,
    html: row.html,
    fromName: settings.senderName,
  });
  return { ok: true, provider: "sendpulse" };
}

/** Processa a fila (cron e disparo imediato). Nunca lança. */
export async function processPendingEmails(
  env: MailEnv,
  db: any,
  opts: { ids?: string[]; limit?: number; releaseStuck?: boolean } = {},
) {
  try {
    if (opts.releaseStuck) await releaseStuckEmails(db);
    const settings = await loadEmailSettings(db);
    return await processOutbox(db, (row) => deliverOutboxRow(env, settings, row), opts);
  } catch (error) {
    console.error("[EMAIL] falha ao processar a fila:", error);
    return { sent: 0, failed: 0, retrying: 0 };
  }
}

/**
 * Grava os e-mails na fila e tenta enviar logo em seguida, em segundo plano. Sem waitUntil
 * (testes), só grava: o cron envia depois.
 */
export async function queueEmails(ctx: MailContext, rows: InsertEmailOutbox[]): Promise<EmailOutboxRow[]> {
  if (rows.length === 0) return [];
  const inserted = await enqueueEmails(ctx.db, rows);
  const ids = inserted.filter((r) => r.status === "pending").map((r) => r.id);
  if (ids.length && ctx.waitUntil) ctx.waitUntil(processPendingEmails(ctx.env, ctx.db, { ids }));
  return inserted;
}

/**
 * Envio direto, sem fila, para os módulos legados (projetos, tarefas, reuniões), que não
 * estão ativos na central de chamados. Anexos só seguem pelo SendPulse.
 */
export async function sendDirect(
  env: MailEnv,
  msg: { to: { name: string; email: string }[]; subject: string; html: string; attachments_binary?: Record<string, string> },
): Promise<void> {
  const status = getMailTransportStatus(env);
  if (!status.provider) throw new Error(NOT_CONFIGURED_ERROR);
  if (status.provider === "sendpulse") return sendViaSendPulse(env, msg);
  const sender = env.GMAIL_SENDER!;
  for (const to of msg.to) {
    const raw = buildMimeMessage({
      from: { name: env.SENDPULSE_FROM_NAME || "Pitzi", email: sender },
      to,
      subject: msg.subject,
      html: msg.html,
      text: msg.subject,
      messageId: newMessageId(emailDomain(sender)),
    });
    await sendGmailRaw(env, base64UrlUtf8(raw));
  }
}
