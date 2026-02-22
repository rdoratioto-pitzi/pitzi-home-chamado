import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";

export function registerSettingsRoutes(router: Router) {
  router.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) return res.status(404).json({ error: "Setting not found" });
      res.json(setting);
    } catch (error) {
      console.error(`Error fetching setting ${req.params.key}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/api/settings", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        key: z.string().min(1),
        value: z.string(),
      });
      const { key, value } = schema.parse(req.body);
      const setting = await storage.setSetting(key, value);
      res.status(201).json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error saving setting:", error);
      res.status(400).json({ error: "Failed to save setting" });
    }
  });
}
