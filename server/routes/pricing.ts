import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { insertPricingAlertSchema } from "@shared/schema";

export function registerPricingRoutes(router: Router) {
  const RENOVSMART_API_BASE = "https://rp.renovsmart.com.br/api";

  // ============== PRICING API PROXY (RenovSmart) ==============
  router.get("/api/pricing/eligible-devices", async (req, res) => {
    try {
      const { categoryId, pageNumber = "1", pageSize = "100" } = req.query;
      if (!categoryId) {
        return res.json({ items: [], currentPage: 1, hasNextPage: false });
      }
      const params = new URLSearchParams();
      params.append("categoryId", String(categoryId));
      params.append("pageNumber", String(pageNumber));
      params.append("pageSize", String(pageSize));

      const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        return res.json({ items: [], currentPage: 1, hasNextPage: false });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Pricing eligible-devices error:", error);
      res.json({ items: [], currentPage: 1, hasNextPage: false });
    }
  });

  router.get("/api/pricing/search", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${RENOVSMART_API_BASE}/search?${queryParams}`;
      const response = await fetch(url);
      if (!response.ok) return res.json({ raw: { shopping_results: [] } });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Pricing search error:", error);
      res.json({ raw: { shopping_results: [] } });
    }
  });

  router.get("/api/pricing/agg/by-device", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${RENOVSMART_API_BASE}/agg/by-device?${queryParams}`;
      const response = await fetch(url);
      if (!response.ok) return res.json([]);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Pricing agg/by-device error:", error);
      res.json([]);
    }
  });

  router.get("/api/pricing/eligible-devices/price", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${RENOVSMART_API_BASE}/eligible-devices/price?${queryParams}`;
      const response = await fetch(url);
      if (!response.ok) return res.json({});
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Pricing eligible-devices/price error:", error);
      res.json({});
    }
  });

  // ============== LOCAL PRICING DEVICES API ==============
  router.get("/api/pricing/devices", async (req, res) => {
    try {
      const { categoryId, manufacturerName, isActive } = req.query;
      const filters: any = {};
      if (categoryId) filters.categoryId = categoryId as string;
      if (manufacturerName) filters.manufacturerName = manufacturerName as string;
      if (isActive !== undefined) filters.isActive = isActive === "true";
      const devices = await storage.getPricingDevices(filters);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching local pricing devices:", error);
      res.status(500).json({ error: "Failed to fetch pricing devices" });
    }
  });

  router.get("/api/pricing/devices/:id", async (req, res) => {
    try {
      const device = await storage.getPricingDevice(req.params.id);
      if (!device) return res.status(404).json({ error: "Pricing device not found" });
      res.json(device);
    } catch (error) {
      console.error("Error fetching local pricing device:", error);
      res.status(500).json({ error: "Failed to fetch pricing device" });
    }
  });

  router.post("/api/pricing/devices", requireAdmin, async (req, res) => {
    try {
      const validated = z.object({
        name: z.string(),
        description: z.string().optional(),
        manufacturerName: z.string(),
        categoryId: z.string(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      }).parse(req.body);

      const device = await storage.createPricingDevice(validated as any);
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create pricing device" });
    }
  });

  router.put("/api/pricing/devices/:id", requireAdmin, async (req, res) => {
    try {
      const validated = z.object({
        name: z.string(),
        description: z.string().optional(),
        manufacturerName: z.string(),
        categoryId: z.string(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      }).partial().parse(req.body);

      const device = await storage.updatePricingDevice(req.params.id as string, validated as any);
      if (!device) return res.status(404).json({ error: "Pricing device not found" });
      res.json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update pricing device" });
    }
  });

  router.delete("/api/pricing/devices/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deletePricingDevice(req.params.id as string);
      if (!deleted) return res.status(404).json({ error: "Pricing device not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing device" });
    }
  });

  // ============== PRICING ALERTS ============== 
  router.get("/api/pricing-alerts", async (req, res) => {
    try {
      const alerts = await storage.getPricingAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pricing alerts" });
    }
  });

  router.post("/api/pricing-alerts", async (req, res) => {
    try {
      const validated = insertPricingAlertSchema.parse(req.body);
      const alert = await storage.createPricingAlert(validated);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create pricing alert" });
    }
  });

  router.delete("/api/pricing-alerts/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePricingAlert(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Pricing alert not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing alert" });
    }
  });
}
