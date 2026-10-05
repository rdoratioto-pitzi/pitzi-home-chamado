// Respostas por e-mail viram comentários do chamado.
//
// O cron (worker/src/index.ts, a cada 5 min) lê a caixa chamados@ pela API do Gmail (escopo
// gmail.modify na delegação do Workspace), identifica o chamado pela conversa (In-Reply-To /
// References com os Message-IDs que nós enviamos, ou o código [CHA-XXXX] do assunto), limpa o
// histórico citado e grava o texto novo como comentário público de quem respondeu — com os
// mesmos efeitos de um comentário feito na tela (worker/src/lib/ticket-comment-effects.ts).
// Cada mensagem recebe o marcador "Chamados/Processado" ou "Chamados/Ignorado" e sai da caixa
// de entrada; inbound_email_log e ticket_comments.inbound_email_id impedem duplicar.
import { and, eq, inArray, gte, sql } from "drizzle-orm";
import {
  emailOutbox,
  inboundEmailLog,
  tickets,
  type Ticket,
  type User,
} from "../../../shared/schema";
import {
  ATTACHMENTS_NOT_IMPORTED_NOTE,
  detectAutomatedMessage,
  extractTicketReference,
  htmlToText,
  normalizeHeaders,
  parseEmailAddress,
  stripQuotedReply,
  textToCommentHtml,
  type MailHeaders,
  type TicketReference,
} from "../../../shared/inbound-email";
import { slaPauseUpdate } from "../../../shared/sla";
import { canViewTicket } from "../../../server/services/ticket-queue.service";
import { runTicketAutomations } from "../../../server/services/automations.service";
import {
  GmailScopeError,
  decodeBase64UrlText,
  ensureGmailLabels,
  getGmailAttachment,
  getGmailMessage,
  isGmailConfigured,
  listGmailMessages,
  modifyGmailMessage,
  type GmailEnv,
  type GmailMessagePart,
} from "./gmail";
import type { MailContext, MailEnv } from "./mailer";
import { sanitizeRichText } from "./sanitize-rich-text";
import { getStorage, type IStorage } from "./storage";
import { runTicketCommentEffects } from "./ticket-comment-effects";

export const LABEL_PROCESSED = "Chamados/Processado";
export const LABEL_IGNORED = "Chamados/Ignorado";
export const INBOUND_QUERY = `in:inbox -label:"${LABEL_PROCESSED}" -label:"${LABEL_IGNORED}" newer_than:14d`;
export const INBOUND_STATUS_KEY = "inbound_email_status";
export const INBOUND_SCOPE_HELP = "Autorize o escopo gmail.modify na delegação do Workspace";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const IMPORTABLE_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain|text\/csv|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/(msword|vnd\.ms-excel))$/i;
/** Mensagem com erro há mais que isso deixa de ser tentada (vai para "Ignorado"). */
const ERROR_GIVE_UP_MS = 24 * 60 * 60 * 1000;

export interface InboundEnv extends GmailEnv, MailEnv {
  ATTACHMENTS?: R2Bucket;
}

export interface InboundResult {
  status: "ok" | "not_configured" | "scope_missing" | "error";
  processed: number;
  ignored: number;
  errors: number;
  error?: string;
}

export interface InboundStatus {
  lastRunAt: string | null;
  ok: boolean;
  scopeOk: boolean | null;
  lastError: string | null;
  lastResult: { processed: number; ignored: number; errors: number } | null;
}

type FetchLike = typeof fetch;

interface Outcome {
  status: "processed" | "ignored" | "error";
  reason?: string;
  ticketId?: string;
  commentId?: string;
  fromEmail?: string;
  subject?: string;
}

// ============== leitura da mensagem ==============

function walkParts(part: GmailMessagePart | undefined, visit: (p: GmailMessagePart) => void): void {
  if (!part) return;
  visit(part);
  for (const child of part.parts ?? []) walkParts(child, visit);
}

function partHeader(part: GmailMessagePart, name: string): string {
  return part.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
}

export function extractBodies(payload: GmailMessagePart | undefined): { text: string; html: string } {
  let text = "";
  let html = "";
  walkParts(payload, (p) => {
    if (p.filename || !p.body?.data) return;
    if (!text && p.mimeType === "text/plain") text = decodeBase64UrlText(p.body.data);
    if (!html && p.mimeType === "text/html") html = decodeBase64UrlText(p.body.data);
  });
  return { text, html };
}

export interface MailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

/** Anexos de verdade: com nome e fora do corpo (imagens inline de assinatura ficam de fora). */
export function listAttachments(payload: GmailMessagePart | undefined): MailAttachment[] {
  const list: MailAttachment[] = [];
  walkParts(payload, (p) => {
    if (!p.filename || !p.body?.attachmentId) return;
    const disposition = partHeader(p, "content-disposition").toLowerCase();
    if (disposition.startsWith("inline") && partHeader(p, "content-id")) return;
    list.push({ filename: p.filename, mimeType: p.mimeType ?? "application/octet-stream", size: p.body.size ?? 0, attachmentId: p.body.attachmentId });
  });
  return list;
}

/** Texto novo da resposta, sem o histórico citado. */
export function replyText(payload: GmailMessagePart | undefined): string {
  const { text, html } = extractBodies(payload);
  return stripQuotedReply(text || (html ? htmlToText(html) : ""));
}

// ============== identificação ==============

export async function findTicketForReply(db: any, storage: IStorage, ref: TicketReference): Promise<Ticket | undefined> {
  if (ref.messageIds.length > 0) {
    const [row] = await db
      .select({ ticketId: emailOutbox.ticketId })
      .from(emailOutbox)
      .where(and(inArray(emailOutbox.messageIdHeader, ref.messageIds), sql`${emailOutbox.ticketId} IS NOT NULL`))
      .limit(1);
    if (row?.ticketId) {
      const ticket = await storage.getTicket(row.ticketId);
      if (ticket) return ticket;
    }
  }
  for (const id of ref.ticketIds) {
    const ticket = await storage.getTicket(id);
    if (ticket) return ticket;
  }
  if (ref.code) {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.code, ref.code)).limit(1);
    if (ticket) return ticket as Ticket;
  }
  return undefined;
}

/** Quem pode comentar pela tela também pode responder por e-mail (solicitante, responsável, grupo, admin). */
export async function senderCanComment(storage: IStorage, user: User | undefined, ticket: Ticket): Promise<boolean> {
  if (!user || user.status !== "active") return false;
  return canViewTicket(storage, { userId: user.id, isAdmin: user.isAdmin === true, tenantId: user.tenantId ?? null }, ticket);
}

// ============== anexos ==============

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "arquivo";
}

async function importAttachments(
  env: InboundEnv,
  messageId: string,
  ticket: Ticket,
  attachments: MailAttachment[],
  fetchImpl: FetchLike,
): Promise<{ saved: Array<{ name: string; url: string; size: number; type: string }>; skipped: number }> {
  const saved: Array<{ name: string; url: string; size: number; type: string }> = [];
  let skipped = 0;
  for (const a of attachments) {
    if (!env.ATTACHMENTS || saved.length >= MAX_ATTACHMENTS || a.size > MAX_ATTACHMENT_BYTES || !IMPORTABLE_TYPES.test(a.mimeType)) {
      skipped++;
      continue;
    }
    try {
      const bytes = await getGmailAttachment(env, messageId, a.attachmentId, fetchImpl);
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) { skipped++; continue; }
      const key = `${ticket.tenantId}/uploads/${crypto.randomUUID()}-${safeFileName(a.filename)}`;
      await env.ATTACHMENTS.put(key, bytes, { httpMetadata: { contentType: a.mimeType } });
      saved.push({ name: safeFileName(a.filename), url: `/objects/${key}`, size: bytes.byteLength, type: a.mimeType });
    } catch (error) {
      console.error("[inbound] anexo não importado:", a.filename, error);
      skipped++;
    }
  }
  return { saved, skipped };
}

// ============== processamento ==============

async function handleMessage(
  env: InboundEnv,
  db: any,
  storage: IStorage,
  mailCtx: MailContext,
  messageId: string,
  fetchImpl: FetchLike,
): Promise<Outcome> {
  const message = await getGmailMessage(env, messageId, fetchImpl);
  const headers: MailHeaders = normalizeHeaders(message.payload?.headers ?? []);
  const fromEmail = parseEmailAddress(headers["from"]);
  const subject = headers["subject"] ?? "";
  const base = { fromEmail, subject };

  const automated = detectAutomatedMessage(headers, fromEmail, env.GMAIL_SENDER ?? "");
  if (automated.automated) return { ...base, status: "ignored", reason: automated.reason };

  const ticket = await findTicketForReply(db, storage, extractTicketReference(headers));
  if (!ticket) return { ...base, status: "ignored", reason: "Chamado não identificado" };

  const sender = await storage.getUserByEmail(fromEmail);
  if (!(await senderCanComment(storage, sender, ticket))) {
    return { ...base, ticketId: ticket.id, status: "ignored", reason: "Remetente sem acesso ao chamado" };
  }

  const text = replyText(message.payload);
  const attachments = listAttachments(message.payload);
  if (!text && attachments.length === 0) {
    return { ...base, ticketId: ticket.id, status: "ignored", reason: "Resposta vazia" };
  }

  const imported = await importAttachments(env, messageId, ticket, attachments, fetchImpl);
  const note = imported.skipped > 0 ? `\n\n${ATTACHMENTS_NOT_IMPORTED_NOTE}` : "";
  const content = sanitizeRichText(textToCommentHtml(`${text || "(anexo enviado por e-mail)"}${note}`));

  let comment;
  try {
    comment = await storage.createTicketComment({
      ticketId: ticket.id,
      userId: sender!.id,
      tenantId: ticket.tenantId,
      content,
      attachments: imported.saved.length > 0 ? JSON.stringify(imported.saved) : null,
      isInternal: false,
      mentions: [],
      source: "email",
      inboundEmailId: messageId,
    });
  } catch (error) {
    // Índice único em inbound_email_id: a resposta já virou comentário numa execução anterior.
    if (/inbound_email_id|duplicate key|unique/i.test(String((error as Error)?.message ?? error))) {
      return { ...base, ticketId: ticket.id, status: "processed", reason: "Já importada" };
    }
    throw error;
  }

  await runTicketCommentEffects(mailCtx, storage, ticket, comment);

  // O solicitante respondeu o que a equipe pediu: o chamado volta para atendimento (com as
  // mesmas regras da troca de status na tela: pausa do SLA e automações de status).
  if (ticket.status === "waiting_requester" && sender!.id === ticket.requesterId) {
    const fresh = (await storage.getTicket(ticket.id)) ?? ticket;
    const saved = await storage.updateTicket(ticket.id, { status: "in_progress", ...slaPauseUpdate(fresh, "in_progress") });
    if (saved) await runTicketAutomations(storage, "status_changed", saved, { actorId: sender!.id, newStatus: "in_progress" });
  }

  return { ...base, ticketId: ticket.id, commentId: comment.id, status: "processed" };
}

async function writeLog(db: any, messageId: string, outcome: Outcome): Promise<void> {
  const values = {
    gmailMessageId: messageId,
    ticketId: outcome.ticketId ?? null,
    commentId: outcome.commentId ?? null,
    fromEmail: outcome.fromEmail ?? null,
    subject: outcome.subject?.slice(0, 300) ?? null,
    status: outcome.status,
    reason: outcome.reason?.slice(0, 500) ?? null,
  };
  await db.insert(inboundEmailLog).values(values).onConflictDoUpdate({
    target: inboundEmailLog.gmailMessageId,
    set: { ...values },
  });
}

async function saveStatus(storage: IStorage, status: InboundStatus): Promise<void> {
  try {
    await storage.setSetting(INBOUND_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error("[inbound] não gravou o status:", error);
  }
}

export async function processInboundEmails(
  env: InboundEnv,
  db: any,
  opts: { limit?: number; timeBudgetMs?: number } = {},
  deps: { fetch?: FetchLike; now?: () => number } = {},
): Promise<InboundResult> {
  const result: InboundResult = { status: "ok", processed: 0, ignored: 0, errors: 0 };
  if (!isGmailConfigured(env)) return { ...result, status: "not_configured" };
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const started = now();
  const storage = getStorage(db);
  // Os e-mails gerados pelos comentários são aguardados no fim (o cron não tem request).
  const pending: Promise<unknown>[] = [];
  const mailCtx: MailContext = { env, db, waitUntil: (p) => { pending.push(p); } };

  try {
    const labels = await ensureGmailLabels(env, [LABEL_PROCESSED, LABEL_IGNORED], fetchImpl);
    const messages = await listGmailMessages(env, INBOUND_QUERY, opts.limit ?? 25, fetchImpl);

    for (const { id } of messages) {
      if (now() - started > (opts.timeBudgetMs ?? 20_000)) break;
      const [previous] = await db.select().from(inboundEmailLog).where(eq(inboundEmailLog.gmailMessageId, id)).limit(1);

      let outcome: Outcome;
      if (previous && previous.status !== "error") {
        // Já tratada (o marcador é que falhou): só remarca.
        outcome = { status: previous.status, reason: previous.reason ?? undefined };
      } else {
        try {
          outcome = await handleMessage(env, db, storage, mailCtx, id, fetchImpl);
        } catch (error) {
          if (error instanceof GmailScopeError) throw error;
          const firstError = previous ? new Date(previous.createdAt).getTime() : now();
          outcome = now() - firstError > ERROR_GIVE_UP_MS
            ? { status: "ignored", reason: `Falhou por mais de 24 h: ${String((error as Error)?.message ?? error)}` }
            : { status: "error", reason: String((error as Error)?.message ?? error) };
          console.error("[inbound] falha ao processar mensagem", id, error);
        }
        await writeLog(db, id, outcome);
      }

      if (outcome.status === "error") { result.errors++; continue; }
      if (outcome.status === "processed") result.processed++; else result.ignored++;
      const label = outcome.status === "processed" ? labels[LABEL_PROCESSED] : labels[LABEL_IGNORED];
      await modifyGmailMessage(env, id, { addLabelIds: [label], removeLabelIds: ["INBOX"] }, fetchImpl);
    }
    await Promise.allSettled(pending);
    await saveStatus(storage, {
      lastRunAt: new Date(now()).toISOString(), ok: true, scopeOk: true, lastError: null,
      lastResult: { processed: result.processed, ignored: result.ignored, errors: result.errors },
    });
    return result;
  } catch (error) {
    await Promise.allSettled(pending);
    const scope = error instanceof GmailScopeError;
    const message = scope ? INBOUND_SCOPE_HELP : String((error as Error)?.message ?? error);
    await saveStatus(storage, {
      lastRunAt: new Date(now()).toISOString(), ok: false, scopeOk: scope ? false : null, lastError: message,
      lastResult: { processed: result.processed, ignored: result.ignored, errors: result.errors },
    });
    return { ...result, status: scope ? "scope_missing" : "error", error: message };
  }
}

/** Painel de Configurações → E-mail: último resultado e contagem das últimas 24 h. */
export async function inboundEmailOverview(db: any, storage: IStorage, now: Date = new Date()) {
  const raw = (await storage.getSetting(INBOUND_STATUS_KEY))?.value;
  let status: InboundStatus | null = null;
  try { status = raw ? (JSON.parse(raw) as InboundStatus) : null; } catch { status = null; }
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows: Array<{ status: string; n: number }> = await db
    .select({ status: inboundEmailLog.status, n: sql<number>`count(*)::int` })
    .from(inboundEmailLog)
    .where(gte(inboundEmailLog.createdAt, since))
    .groupBy(inboundEmailLog.status);
  const last24h = { processed: 0, ignored: 0, error: 0 };
  for (const r of rows) if (r.status in last24h) last24h[r.status as keyof typeof last24h] = Number(r.n);
  const recent = await db
    .select({
      createdAt: inboundEmailLog.createdAt,
      fromEmail: inboundEmailLog.fromEmail,
      subject: inboundEmailLog.subject,
      status: inboundEmailLog.status,
      reason: inboundEmailLog.reason,
      ticketId: inboundEmailLog.ticketId,
    })
    .from(inboundEmailLog)
    .orderBy(sql`${inboundEmailLog.createdAt} DESC`)
    .limit(10);
  return { status, last24h, recent, scopeHelp: INBOUND_SCOPE_HELP };
}
