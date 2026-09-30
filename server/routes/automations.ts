// Espelho Express de worker/src/routes/automations.ts (respostas prontas e automações).
import type { Router } from "express";
import { storage } from "../storage";
import { getSessionUser, requireAuth } from "../middleware/auth";
import { canManageTicketFields } from "@shared/permissions";
import { requireTicketFieldsManager } from "./ticket-fields";
import {
  createAutomationRule,
  createCannedResponse,
  filterCannedResponses,
  updateAutomationRule,
  updateCannedResponse,
} from "../services/automations.service";

export function registerAutomationRoutes(router: Router) {
  router.get("/api/canned-responses", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const user = isAdmin ? null : await storage.getUser(userId);
    const manager = canManageTicketFields({ isAdmin, modulePermissions: user?.modulePermissions });
    const all = await storage.getCannedResponses();
    res.json(filterCannedResponses(all, {
      includeInactive: manager && req.query.all === "1",
      group: typeof req.query.group === "string" ? req.query.group : null,
    }));
  });

  router.post("/api/canned-responses", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const { userId } = getSessionUser(req);
    const result = await createCannedResponse(storage, req.body, { userId, tenantId: null });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.response);
  });

  router.put("/api/canned-responses/:id", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const result = await updateCannedResponse(storage, String(req.params.id), req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.response);
  });

  router.delete("/api/canned-responses/:id", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const deleted = await storage.deleteCannedResponse(String(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Resposta não encontrada" });
    res.status(204).end();
  });

  router.get("/api/automations", requireAuth, requireTicketFieldsManager, async (_req, res) => {
    res.json(await storage.getAutomationRules());
  });

  router.post("/api/automations", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const { userId } = getSessionUser(req);
    const result = await createAutomationRule(storage, req.body, { userId, tenantId: null });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.rule);
  });

  router.put("/api/automations/:id", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const result = await updateAutomationRule(storage, String(req.params.id), req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.rule);
  });

  router.delete("/api/automations/:id", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const deleted = await storage.deleteAutomationRule(String(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Automação não encontrada" });
    res.status(204).end();
  });
}
