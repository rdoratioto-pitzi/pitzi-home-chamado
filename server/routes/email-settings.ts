// Espelho Express de worker/src/routes/email-settings.ts. O Express só roda localmente e não
// envia e-mails pela fila: configuração, histórico e reenfileirar funcionam; o envio real
// (Gmail) acontece no Worker, pelo disparo imediato e pelo cron.
import type { Router } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { getSessionUser, requireAuth } from "../middleware/auth";
import { requireTicketFieldsManager } from "./ticket-fields";
import {
  DEFAULT_EMAIL_SETTINGS,
  EMAIL_SETTINGS_KEY,
  parseEmailSettings,
  validateEmailSettings,
} from "@shared/email-settings";
import {
  listOutbox,
  outboxRowSummary,
  outboxStatusCounts,
  requeueEmail,
} from "../services/email-outbox.service";

const LOCAL_ONLY = "O envio de e-mails só acontece no Worker (produção).";

export function registerEmailSettingsRoutes(router: Router) {
  router.get("/api/email/settings", requireAuth, requireTicketFieldsManager, async (_req, res) => {
    const setting = await storage.getSetting(EMAIL_SETTINGS_KEY);
    res.json({ settings: parseEmailSettings(setting?.value), defaults: DEFAULT_EMAIL_SETTINGS });
  });

  router.put("/api/email/settings", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const result = validateEmailSettings(req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    await storage.setSetting(EMAIL_SETTINGS_KEY, JSON.stringify(result.settings));
    res.json({ settings: result.settings });
  });

  // Respostas por e-mail só são lidas no Worker (cron com a API do Gmail).
  router.get("/api/email/inbound", requireAuth, requireTicketFieldsManager, async (_req, res) => {
    res.json({
      status: null,
      last24h: { processed: 0, ignored: 0, error: 0 },
      recent: [],
      scopeHelp: "Autorize o escopo gmail.modify na delegação do Workspace",
      localOnly: true,
    });
  });

  router.get("/api/email/status", requireAuth, requireTicketFieldsManager, async (_req, res) => {
    const counts = db ? await outboxStatusCounts(db).catch(() => ({})) : {};
    res.json({ provider: null, sender: null, configured: false, counts, note: LOCAL_ONLY });
  });

  router.post("/api/email/test", requireAuth, requireTicketFieldsManager, async (req, res) => {
    getSessionUser(req);
    res.status(501).json({ error: LOCAL_ONLY });
  });

  router.get("/api/email/outbox", requireAuth, requireTicketFieldsManager, async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not available" });
    res.json(await listOutbox(db, {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 25,
    }));
  });

  router.post("/api/email/outbox/:id/resend", requireAuth, requireTicketFieldsManager, async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not available" });
    const row = await requeueEmail(db, String(req.params.id));
    if (!row) return res.status(404).json({ error: "Só e-mails com falha ou não enviados podem ser reenviados" });
    res.json(outboxRowSummary(row));
  });
}
