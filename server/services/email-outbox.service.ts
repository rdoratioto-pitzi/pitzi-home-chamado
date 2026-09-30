// Fila de e-mails (tabela email_outbox, migration 0029). Usada pelo Worker (envio real) e
// pelo Express (só leitura/reenfileirar). Quem envia de fato é a função `deliver` passada
// pelo chamador; aqui ficam a reserva das linhas, as novas tentativas e o histórico.
import { and, count, desc, eq, sql } from "drizzle-orm";
import { emailOutbox, type EmailOutboxRow, type InsertEmailOutbox } from "../../shared/schema";

export const EMAIL_MAX_ATTEMPTS = 5;
export const EMAIL_STATUSES = ["pending", "sending", "sent", "failed", "skipped"] as const;
export type EmailOutboxStatus = (typeof EMAIL_STATUSES)[number];

/** Erro que não adianta repetir (ex.: envio não configurado): vai direto para failed. */
export const NOT_CONFIGURED_ERROR = "not_configured";

export type DeliveryResult =
  | { ok: true; provider: string; providerMessageId?: string | null }
  | { ok: false; error: string; permanent?: boolean };

type Db = any;

/** Espera antes da próxima tentativa: 1, 4, 16 e 60 minutos. */
export function emailBackoffMinutes(attempts: number): number {
  return Math.min(60, 4 ** Math.max(0, attempts - 1));
}

export async function enqueueEmails(db: Db, rows: InsertEmailOutbox[]): Promise<EmailOutboxRow[]> {
  if (rows.length === 0) return [];
  return db.insert(emailOutbox).values(rows).returning();
}

/**
 * Reserva linhas prontas para envio (pending e com next_attempt_at vencido), marcando-as como
 * sending numa única instrução. FOR UPDATE SKIP LOCKED evita que duas execuções simultâneas
 * (waitUntil da requisição e cron) peguem a mesma linha.
 */
export async function claimPendingEmails(
  db: Db,
  opts: { limit?: number; ids?: string[] } = {},
): Promise<EmailOutboxRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  if (opts.ids && opts.ids.length === 0) return [];
  const idFilter = opts.ids
    ? sql` AND id IN (${sql.join(opts.ids.map((id) => sql`${id}`), sql`, `)})`
    : sql``;
  return db
    .update(emailOutbox)
    .set({ status: "sending", attempts: sql`${emailOutbox.attempts} + 1`, nextAttemptAt: sql`now()` })
    .where(sql`${emailOutbox.id} IN (
      SELECT id FROM email_outbox
      WHERE status = 'pending' AND next_attempt_at <= now()${idFilter}
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )`)
    .returning();
}

/** Linhas presas em sending (isolate encerrado no meio do envio) voltam para a fila. */
export async function releaseStuckEmails(db: Db, olderThanMinutes = 15): Promise<number> {
  const rows = await db
    .update(emailOutbox)
    .set({ status: "pending" })
    .where(and(
      eq(emailOutbox.status, "sending"),
      sql`${emailOutbox.nextAttemptAt} < now() - make_interval(mins => ${olderThanMinutes})`,
    ))
    .returning({ id: emailOutbox.id });
  return rows.length;
}

export async function recordDelivery(db: Db, row: EmailOutboxRow, result: DeliveryResult): Promise<void> {
  if (result.ok) {
    await db.update(emailOutbox).set({
      status: "sent",
      sentAt: sql`now()`,
      provider: result.provider,
      providerMessageId: result.providerMessageId ?? null,
      lastError: null,
    }).where(eq(emailOutbox.id, row.id));
    return;
  }
  const giveUp = result.permanent || row.attempts >= EMAIL_MAX_ATTEMPTS;
  await db.update(emailOutbox).set({
    status: giveUp ? "failed" : "pending",
    lastError: result.error.slice(0, 1000),
    nextAttemptAt: giveUp ? sql`now()` : sql`now() + make_interval(mins => ${emailBackoffMinutes(row.attempts)})`,
  }).where(eq(emailOutbox.id, row.id));
}

/** Envia o que estiver pronto. Nunca lança: falhas ficam registradas na linha. */
export async function processOutbox(
  db: Db,
  deliver: (row: EmailOutboxRow) => Promise<DeliveryResult>,
  opts: { limit?: number; ids?: string[] } = {},
): Promise<{ sent: number; failed: number; retrying: number }> {
  const summary = { sent: 0, failed: 0, retrying: 0 };
  const rows = await claimPendingEmails(db, opts);
  for (const row of rows) {
    let result: DeliveryResult;
    try {
      result = await deliver(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = { ok: false, error: message, permanent: message === NOT_CONFIGURED_ERROR };
    }
    await recordDelivery(db, row, result);
    if (result.ok) summary.sent++;
    else if (result.permanent || row.attempts >= EMAIL_MAX_ATTEMPTS) summary.failed++;
    else summary.retrying++;
  }
  return summary;
}

/** Reenvio manual (Configurações → E-mail): volta para a fila com as tentativas zeradas. */
export async function requeueEmail(db: Db, id: string): Promise<EmailOutboxRow | null> {
  const [row] = await db
    .update(emailOutbox)
    .set({ status: "pending", attempts: 0, nextAttemptAt: sql`now()`, lastError: null })
    .where(and(eq(emailOutbox.id, id), sql`${emailOutbox.status} IN ('failed', 'skipped')`))
    .returning();
  return row ?? null;
}

export interface OutboxListItem {
  id: string;
  event: string;
  ticketId: string | null;
  toEmail: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  provider: string | null;
  createdAt: Date | string;
  sentAt: Date | string | null;
  nextAttemptAt: Date | string;
}

export async function listOutbox(
  db: Db,
  opts: { status?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: OutboxListItem[]; total: number; page: number; pageSize: number }> {
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 25, 100));
  const page = Math.max(1, opts.page ?? 1);
  const status = opts.status && (EMAIL_STATUSES as readonly string[]).includes(opts.status) ? opts.status : null;
  const where = status ? eq(emailOutbox.status, status) : undefined;

  const items = await db
    .select({
      id: emailOutbox.id,
      event: emailOutbox.event,
      ticketId: emailOutbox.ticketId,
      toEmail: emailOutbox.toEmail,
      subject: emailOutbox.subject,
      status: emailOutbox.status,
      attempts: emailOutbox.attempts,
      lastError: emailOutbox.lastError,
      provider: emailOutbox.provider,
      createdAt: emailOutbox.createdAt,
      sentAt: emailOutbox.sentAt,
      nextAttemptAt: emailOutbox.nextAttemptAt,
    })
    .from(emailOutbox)
    .where(where)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: count() }).from(emailOutbox).where(where);
  return { items, total: Number(total), page, pageSize };
}

export async function getOutboxRow(db: Db, id: string): Promise<EmailOutboxRow | null> {
  const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
  return row ?? null;
}

/** Contagem por status (cartão de situação em Configurações → E-mail). */
export async function outboxStatusCounts(db: Db): Promise<Record<string, number>> {
  const rows: { status: string; total: number | string }[] = await db
    .select({ status: emailOutbox.status, total: count() })
    .from(emailOutbox)
    .groupBy(emailOutbox.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.total)]));
}

/** Resumo sem o HTML, para a resposta das rotas. */
export function outboxRowSummary(row: EmailOutboxRow): OutboxListItem {
  const { html: _html, text: _text, ...rest } = row;
  return {
    id: rest.id,
    event: rest.event,
    ticketId: rest.ticketId,
    toEmail: rest.toEmail,
    subject: rest.subject,
    status: rest.status,
    attempts: rest.attempts,
    lastError: rest.lastError,
    provider: rest.provider,
    createdAt: rest.createdAt,
    sentAt: rest.sentAt,
    nextAttemptAt: rest.nextAttemptAt,
  };
}
