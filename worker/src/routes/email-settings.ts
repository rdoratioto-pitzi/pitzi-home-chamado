// worker/src/routes/email-settings.ts
// Configurações → E-mail: situação da conexão, remetente, eventos/modelos, e-mail de teste e
// histórico da fila. Tudo restrito a admin ou a quem tem a permissão "campos_chamado".
// Credenciais nunca passam por aqui: são segredos do Worker.
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireTicketFieldsManager } from "./ticket-fields";
import {
  DEFAULT_EMAIL_SETTINGS,
  EMAIL_SETTINGS_KEY,
  escapeHtml,
  validateEmailSettings,
} from "../../../shared/email-settings";
import { emailDomain, newMessageId } from "../../../shared/email-mime";
import { emailTemplate } from "../../../server/email-templates";
import {
  getOutboxRow,
  listOutbox,
  outboxRowSummary,
  outboxStatusCounts,
  requeueEmail,
} from "../../../server/services/email-outbox.service";
import { getMailTransportStatus, loadEmailSettings, mailContext, processPendingEmails, queueEmails } from "../lib/mailer";

export const emailSettings = new Hono<AppEnv>();

emailSettings.use("/api/email/*", requireTicketFieldsManager);

emailSettings.get("/api/email/settings", async (c) => {
  return c.json({ settings: await loadEmailSettings(c.get("db")), defaults: DEFAULT_EMAIL_SETTINGS });
});

emailSettings.put("/api/email/settings", async (c) => {
  const result = validateEmailSettings(await c.req.json().catch(() => null));
  if (!result.ok) return c.json({ error: result.error }, 400);
  await getStorage(c.get("db")).setSetting(EMAIL_SETTINGS_KEY, JSON.stringify(result.settings));
  return c.json({ settings: result.settings });
});

emailSettings.get("/api/email/status", async (c) => {
  const transport = getMailTransportStatus(c.env);
  const counts = await outboxStatusCounts(c.get("db")).catch(() => ({}));
  return c.json({ ...transport, configured: transport.provider !== null, counts });
});

/** Envia um e-mail de teste para quem clicou e devolve o resultado do envio. */
emailSettings.post("/api/email/test", async (c) => {
  const user = await getStorage(c.get("db")).getUser(c.get("user").userId);
  if (!user?.email) return c.json({ error: "Seu usuário não tem e-mail cadastrado" }, 400);
  const settings = await loadEmailSettings(c.get("db"));
  const html = emailTemplate({
    title: "E-mail de teste",
    greeting: `Olá ${escapeHtml(user.name)},`,
    body: `<p style="color:#334155;font-size:15px;line-height:1.6;">Este é um teste do envio de e-mails da central de chamados. Se ele chegou, a configuração está funcionando.</p>
      <p style="color:#64748b;font-size:13px;line-height:1.6;">Remetente: ${escapeHtml(settings.senderName)}</p>`,
  });
  const ctx = mailContext(c);
  const sender = getMailTransportStatus(c.env).sender || "chamados@pitzi.com.br";
  const [row] = await queueEmails({ ...ctx, waitUntil: undefined }, [{
    tenantId: user.tenantId ?? null,
    event: "test",
    toEmail: user.email,
    toUserId: user.id,
    subject: "Teste de e-mail — Central de chamados",
    html,
    text: "Este é um teste do envio de e-mails da central de chamados. Se ele chegou, a configuração está funcionando.",
    status: "pending",
    messageIdHeader: newMessageId(emailDomain(sender), "teste"),
  }]);
  await processPendingEmails(c.env, c.get("db"), { ids: [row.id] });
  const final = await getOutboxRow(c.get("db"), row.id);
  return c.json(final ? outboxRowSummary(final) : outboxRowSummary(row));
});

emailSettings.get("/api/email/outbox", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const pageSize = Number(c.req.query("pageSize") || 25);
  return c.json(await listOutbox(c.get("db"), {
    status: c.req.query("status") || undefined,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  }));
});

emailSettings.post("/api/email/outbox/:id/resend", async (c) => {
  const row = await requeueEmail(c.get("db"), c.req.param("id"));
  if (!row) return c.json({ error: "Só e-mails com falha ou não enviados podem ser reenviados" }, 404);
  await processPendingEmails(c.env, c.get("db"), { ids: [row.id] });
  const final = await getOutboxRow(c.get("db"), row.id);
  return c.json(outboxRowSummary(final ?? row));
});
