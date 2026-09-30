// Fila de e-mails: reserva sem envio duplicado, novas tentativas e reenvio.
// Integração: só roda com TEST_DATABASE_URL (banco DESCARTÁVEL com as migrations aplicadas).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import {
  EMAIL_MAX_ATTEMPTS,
  NOT_CONFIGURED_ERROR,
  claimPendingEmails,
  emailBackoffMinutes,
  enqueueEmails,
  listOutbox,
  processOutbox,
  releaseStuckEmails,
  requeueEmail,
} from "./email-outbox.service";

describe("emailBackoffMinutes", () => {
  it("cresce 1, 4, 16, 60 e para em 60", () => {
    expect([1, 2, 3, 4, 5, 9].map(emailBackoffMinutes)).toEqual([1, 4, 16, 60, 60, 60]);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("email_outbox", () => {
  let pool: pg.Pool;
  let db: any;
  const row = (overrides: Partial<schema.InsertEmailOutbox> = {}): schema.InsertEmailOutbox => ({
    event: "outbox-test",
    toEmail: "a@outbox-test.local",
    subject: "[CHA-1] teste",
    html: "<p>x</p>",
    text: "x",
    ...overrides,
  });
  const status = async (id: string) =>
    (await pool.query("SELECT status, attempts, last_error, next_attempt_at > now() AS later FROM email_outbox WHERE id = $1", [id])).rows[0];

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    await pool.query("DELETE FROM email_outbox WHERE event LIKE 'outbox-test%'");
  });
  afterAll(async () => {
    await pool.query("DELETE FROM email_outbox WHERE event LIKE 'outbox-test%'");
    await pool?.end();
  });

  it("duas reservas simultâneas não pegam a mesma linha", async () => {
    const inserted = await enqueueEmails(db, [row(), row(), row()]);
    const ids = inserted.map((r) => r.id);
    const [a, b] = await Promise.all([claimPendingEmails(db, { ids }), claimPendingEmails(db, { ids })]);
    const claimed = [...a, ...b].map((r) => r.id);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.sort()).toEqual([...ids].sort());
    expect([...a, ...b].every((r) => r.status === "sending" && r.attempts === 1)).toBe(true);
    // Já reservadas: nada mais a pegar.
    expect(await claimPendingEmails(db, { ids })).toEqual([]);
  });

  it("sucesso marca enviado; falha volta para a fila com espera; esgotou → failed", async () => {
    const [ok, flaky] = await enqueueEmails(db, [row({ toEmail: "ok@outbox-test.local" }), row({ toEmail: "falha@outbox-test.local" })]);
    const summary = await processOutbox(db, async (r) =>
      r.toEmail.startsWith("ok") ? { ok: true, provider: "gmail", providerMessageId: "g-1" } : { ok: false, error: "503 indisponível" },
      { ids: [ok.id, flaky.id] });
    expect(summary).toEqual({ sent: 1, failed: 0, retrying: 1 });
    expect(await status(ok.id)).toMatchObject({ status: "sent", attempts: 1, last_error: null });
    expect(await status(flaky.id)).toMatchObject({ status: "pending", attempts: 1, last_error: "503 indisponível", later: true });

    // Na última tentativa a linha desiste.
    await pool.query("UPDATE email_outbox SET attempts = $2, next_attempt_at = now() WHERE id = $1", [flaky.id, EMAIL_MAX_ATTEMPTS - 1]);
    await processOutbox(db, async () => ({ ok: false, error: "503 de novo" }), { ids: [flaky.id] });
    expect(await status(flaky.id)).toMatchObject({ status: "failed", attempts: EMAIL_MAX_ATTEMPTS });
  });

  it("não configurado vai direto para failed; reenviar zera as tentativas", async () => {
    const [r] = await enqueueEmails(db, [row()]);
    await processOutbox(db, async () => { throw new Error(NOT_CONFIGURED_ERROR); }, { ids: [r.id] });
    expect(await status(r.id)).toMatchObject({ status: "failed", attempts: 1, last_error: NOT_CONFIGURED_ERROR });

    const requeued = await requeueEmail(db, r.id);
    expect(requeued).toMatchObject({ status: "pending", attempts: 0, lastError: null });
    // Enviado não pode ser reenviado.
    await processOutbox(db, async () => ({ ok: true, provider: "gmail" }), { ids: [r.id] });
    expect(await requeueEmail(db, r.id)).toBeNull();
  });

  it("linha presa em sending volta para a fila; skipped não é enviada", async () => {
    const [stuck, skipped] = await enqueueEmails(db, [row(), row({ status: "skipped", lastError: "Usuário inativo" })]);
    await claimPendingEmails(db, { ids: [stuck.id, skipped.id] });
    await pool.query("UPDATE email_outbox SET next_attempt_at = now() - interval '20 minutes' WHERE id = $1", [stuck.id]);
    expect(await releaseStuckEmails(db)).toBeGreaterThanOrEqual(1);
    expect((await status(stuck.id)).status).toBe("pending");
    expect((await status(skipped.id)).status).toBe("skipped");
  });

  it("histórico lista sem o HTML e filtra por status", async () => {
    await enqueueEmails(db, [row({ event: "outbox-test-a" }), row({ event: "outbox-test-b", status: "skipped" })]);
    const skipped = await listOutbox(db, { status: "skipped", pageSize: 100 });
    const mine = skipped.items.filter((i) => i.event.startsWith("outbox-test"));
    expect(mine.map((i) => i.event)).toEqual(["outbox-test-b"]);
    expect(mine[0]).not.toHaveProperty("html");
  });
});
