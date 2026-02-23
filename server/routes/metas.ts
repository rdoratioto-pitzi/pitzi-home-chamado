import { Router } from "express";
import { storage } from "../storage";
import {
  insertMetaSchema,
  insertMetaAreaSchema,
  insertMetaCheckinSchema,
} from "@shared/schema";
import { requireAuth, getSessionUser } from "../middleware/auth";
import { z } from "zod";

export function registerMetaRoutes(router: Router) {
  const getId = (req: any) => req.params.id as string;

  // ============== META AREAS ==============
  router.get("/api/meta-areas", requireAuth, async (req, res) => {
    try {
      const areas = await storage.getMetaAreas();
      res.json(areas);
    } catch (error) {
      console.error("Error fetching meta areas:", error);
      res.status(500).json({ error: "Failed to fetch meta areas" });
    }
  });

  router.get("/api/meta-areas/:id", requireAuth, async (req, res) => {
    try {
      const area = await storage.getMetaArea(getId(req));
      if (!area) return res.status(404).json({ error: "Meta area not found" });
      res.json(area);
    } catch (error) {
      console.error("Error fetching meta area:", error);
      res.status(500).json({ error: "Failed to fetch meta area" });
    }
  });

  router.post("/api/meta-areas", requireAuth, async (req, res) => {
    try {
      const validated = insertMetaAreaSchema.parse(req.body);
      const area = await storage.createMetaArea(validated);
      res.status(201).json(area);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating meta area:", error);
      res.status(400).json({ error: "Failed to create meta area" });
    }
  });

  router.patch("/api/meta-areas/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertMetaAreaSchema.partial();
      const validated = partialSchema.parse(req.body);
      const area = await storage.updateMetaArea(getId(req), validated);
      if (!area) return res.status(404).json({ error: "Meta area not found" });
      res.json(area);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating meta area:", error);
      res.status(400).json({ error: "Failed to update meta area" });
    }
  });

  router.delete("/api/meta-areas/:id", requireAuth, async (req, res) => {
    try {
      const area = await storage.getMetaArea(getId(req));
      if (!area) return res.status(404).json({ error: "Meta area not found" });
      
      // Soft delete - archive instead of delete
      const archived = await storage.updateMetaArea(getId(req), { archived: true });
      if (!archived) return res.status(404).json({ error: "Meta area not found" });
      
      res.json({ archived: true });
    } catch (error) {
      console.error("Error archiving meta area:", error);
      res.status(500).json({ error: "Failed to archive meta area" });
    }
  });

  // ============== METAS ==============
  router.get("/api/metas", requireAuth, async (req, res) => {
    try {
      const { month, areaId, responsibleId } = req.query;
      
      const filters: any = {};
      if (month) filters.month = month as string;
      if (areaId) filters.areaId = areaId as string;
      if (responsibleId) filters.responsibleId = responsibleId as string;
      
      const metas = await storage.getMetas(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(metas);
    } catch (error) {
      console.error("Error fetching metas:", error);
      res.status(500).json({ error: "Failed to fetch metas" });
    }
  });

  router.get("/api/metas/:id", requireAuth, async (req, res) => {
    try {
      const meta = await storage.getMeta(getId(req));
      if (!meta) return res.status(404).json({ error: "Meta not found" });
      res.json(meta);
    } catch (error) {
      console.error("Error fetching meta:", error);
      res.status(500).json({ error: "Failed to fetch meta" });
    }
  });

  router.post("/api/metas", requireAuth, async (req, res) => {
    try {
      const validated = insertMetaSchema.parse(req.body);
      const meta = await storage.createMeta(validated);
      res.status(201).json(meta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating meta:", error);
      res.status(400).json({ error: "Failed to create meta" });
    }
  });

  router.patch("/api/metas/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertMetaSchema.partial();
      const validated = partialSchema.parse(req.body);
      const meta = await storage.updateMeta(getId(req), validated);
      if (!meta) return res.status(404).json({ error: "Meta not found" });
      res.json(meta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating meta:", error);
      res.status(400).json({ error: "Failed to update meta" });
    }
  });

  router.delete("/api/metas/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteMeta(getId(req));
      if (!deleted) return res.status(404).json({ error: "Meta not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting meta:", error);
      res.status(500).json({ error: "Failed to delete meta" });
    }
  });

  // ============== META CHECK-INS ==============
  router.get("/api/metas/:id/checkins", requireAuth, async (req, res) => {
    try {
      const checkins = await storage.getMetaCheckins(getId(req));
      const users = await storage.getUsers();

      const checkinsWithUser = checkins.map(checkin => ({
        ...checkin,
        user: users.find(u => u.id === checkin.userId)
      }));

      res.json(checkinsWithUser);
    } catch (error) {
      console.error("Error fetching meta checkins:", error);
      res.status(500).json({ error: "Failed to fetch meta checkins" });
    }
  });

  router.post("/api/metas/:id/checkins", requireAuth, async (req, res) => {
    try {
      const meta = await storage.getMeta(getId(req));
      if (!meta) return res.status(404).json({ error: "Meta not found" });

      const validated = insertMetaCheckinSchema.parse({
        ...req.body,
        metaId: req.params.id,
        previousValue: meta.currentValue,
      });

      const checkin = await storage.createMetaCheckin(validated);

      // Update the meta current value
      await storage.updateMeta(getId(req), {
        currentValue: validated.newValue,
      });

      res.status(201).json(checkin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating meta checkin:", error);
      res.status(400).json({ error: "Failed to create meta checkin" });
    }
  });
}
