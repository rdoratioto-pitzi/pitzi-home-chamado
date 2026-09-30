// Espelho Express de worker/src/routes/ticket-fields.ts (Configurações → Campos do chamado).
import type { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { getSessionUser, requireAuth } from "../middleware/auth";
import { canManageTicketFields } from "@shared/permissions";
import {
  createCustomField,
  getRequestObjectTree,
  saveRequestObjectTree,
  updateCustomField,
} from "../services/ticket-fields.service";

async function requireTicketFieldsManager(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, isAdmin } = getSessionUser(req);
    const user = isAdmin ? null : await storage.getUser(userId);
    if (!canManageTicketFields({ isAdmin, modulePermissions: user?.modulePermissions })) {
      return res.status(403).json({ error: "Sem permissão para gerenciar os campos dos chamados" });
    }
    next();
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

export function registerTicketFieldRoutes(router: Router) {
  router.get("/api/ticket-fields/request-objects", requireAuth, async (_req, res) => {
    res.json(await getRequestObjectTree(storage));
  });

  router.put("/api/ticket-fields/request-objects", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const result = await saveRequestObjectTree(storage, req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.tree);
  });

  router.get("/api/ticket-fields/custom", requireAuth, async (_req, res) => {
    res.json(await storage.getTicketCustomFields());
  });

  router.post("/api/ticket-fields/custom", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const result = await createCustomField(storage, req.body, null);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.field);
  });

  router.put("/api/ticket-fields/custom/:id", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const result = await updateCustomField(storage, String(req.params.id), req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.field);
  });

  router.delete("/api/ticket-fields/custom/:id", requireAuth, requireTicketFieldsManager, async (req, res) => {
    const deleted = await storage.deleteTicketCustomField(String(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Campo não encontrado" });
    res.status(204).end();
  });
}
