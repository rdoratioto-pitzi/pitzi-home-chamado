import { Router } from "express";
import { storage } from "../storage";
import { insertSlaRuleSchema } from "@shared/schema";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";

export function registerSlaRoutes(router: Router) {
  router.get("/api/slas", async (req, res) => {
    try {
      const rules = await storage.getSlaRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching SLA rules:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/api/slas/:id", async (req, res) => {
    try {
      const rule = await storage.getSlaRule(req.params.id);
      if (!rule) return res.status(404).json({ error: "SLA rule not found" });
      res.json(rule);
    } catch (error) {
      console.error(`Error fetching SLA rule ${req.params.id}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/api/slas", requireAdmin, async (req, res) => {
    try {
      const validated = insertSlaRuleSchema.parse(req.body);

      const existing = await storage.getSlaRuleByTipoAndPrioridade(validated.tipo, validated.prioridade);
      if (existing) {
        return res.status(409).json({
          error: "conflict",
          message: `Já existe uma regra de SLA para ${validated.tipo} com prioridade ${validated.prioridade}`
        });
      }

      const rule = await storage.createSlaRule(validated);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating SLA rule:", error);
      res.status(400).json({ error: "Failed to create SLA rule" });
    }
  });

  router.put("/api/slas/:id", requireAdmin, async (req, res) => {
    try {
      const partialSchema = insertSlaRuleSchema.partial();
      const validated = partialSchema.parse(req.body);

      if (validated.tipo && validated.prioridade) {
        const existing = await storage.getSlaRuleByTipoAndPrioridade(validated.tipo, validated.prioridade);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({
            error: "conflict",
            message: `Já existe uma regra de SLA para ${validated.tipo} com prioridade ${validated.prioridade}`
          });
        }
      }

      const rule = await storage.updateSlaRule(req.params.id as string, validated);
      if (!rule) return res.status(404).json({ error: "SLA rule not found" });
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating SLA rule:", error);
      res.status(400).json({ error: "Failed to update SLA rule" });
    }
  });

  router.delete("/api/slas/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSlaRule(req.params.id as string);
      if (!deleted) return res.status(404).json({ error: "SLA rule not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting SLA rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
