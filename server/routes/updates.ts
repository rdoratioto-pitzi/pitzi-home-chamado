import { Router } from "express";
import { storage } from "../storage";
import { insertUpdateSchema } from "@shared/schema";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";

export function registerUpdateRoutes(router: Router) {
  // ============== UPDATES / CHANGELOG ============== 
  router.get("/api/updates", async (req, res) => {
    try {
      const updates = await storage.getUpdates();
      res.json(updates);
    } catch (error) {
      console.error("Error fetching updates:", error);
      res.status(500).json({ error: "Failed to fetch updates" });
    }
  });

  router.post("/api/updates", requireAdmin, async (req, res) => {
    try {
      const validated = insertUpdateSchema.parse(req.body);
      const newUpdate = await storage.createUpdate(validated);
      res.status(201).json(newUpdate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating update:", error);
      res.status(400).json({ error: "Failed to create update" });
    }
  });

  router.put("/api/updates/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertUpdateSchema.partial().parse(req.body);
      const updated = await storage.updateUpdate(req.params.id as string, validated);
      if (!updated) return res.status(404).json({ error: "Update not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating update:", error);
      res.status(400).json({ error: "Failed to update update" });
    }
  });

  router.delete("/api/updates/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteUpdate(req.params.id as string);
      if (!deleted) return res.status(404).json({ error: "Update not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting update:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
