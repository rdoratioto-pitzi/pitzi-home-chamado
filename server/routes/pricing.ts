import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { insertPricingAlertSchema } from "@shared/schema";
import {
  fetchEligibleDevices,
  processEligibleDevices,
  processSingleDevice,
  type DeviceWithPrices
} from "../services/pricing-service";

export function registerPricingRoutes(router: Router) {
  const RENOVSMART_API_BASE = "https://rp.renovsmart.com.br/api";

  // ============== PRICING API PROXY (RenovSmart) ==============
  router.get("/api/pricing/eligible-devices", async (req, res) => {
    try {
      const { categoryId, pageNumber = "1", pageSize = "100" } = req.query;
      console.log("[PRICING] /eligible-devices called with categoryId:", categoryId);
      if (!categoryId) {
        return res.json({ items: [], currentPage: 1, hasNextPage: false });
      }
      const params = new URLSearchParams();
      params.append("categoryId", String(categoryId));
      params.append("pageNumber", String(pageNumber));
      params.append("pageSize", String(pageSize));

      const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
      console.log("[PRICING] Calling external API:", url);
      
      // Debug: Log request details
      console.log("[PRICING] Request details:", {
        url,
        method: 'GET',
        headers: {
          'User-Agent': 'RenovSmart-Pricing/1.0',
          'Accept': 'application/json'
        }
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'RenovSmart-Pricing/1.0',
          'Accept': 'application/json'
        }
      });

      console.log("[PRICING] External API response status:", response.status);
      console.log("[PRICING] External API response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.log("[PRICING] External API failed with status:", response.status);
        // Try to get error details
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.log("[PRICING] External API error details:", errorText);
        return res.json({ items: [], currentPage: 1, hasNextPage: false });
      }

      const data = await response.json();
      console.log("[PRICING] External API returned items:", data?.items?.length || 0);

      // Filtrando dispositivos Xiaomi e Redmi
      if (data.items && Array.isArray(data.items)) {
        data.items = data.items.filter((item: any) => {
          const brand = (item.manufacturerName || "").toUpperCase();
          return !brand.includes("XIAOMI") && !brand.includes("XIOMI") && !brand.includes("REDMI");
        });
        console.log("[PRICING] After filtering Xiaomi/Redmi:", data.items.length);
      }

      res.json(data);
    } catch (error) {
      console.error("[PRICING] eligible-devices error:", error);
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
      console.log("[PRICING] /api/pricing/devices called, session:", req.session?.userId ? "authenticated" : "NOT authenticated");
      const { categoryId, manufacturerName, isActive } = req.query;
      const filters: any = {};
      if (categoryId) filters.categoryId = categoryId as string;
      if (manufacturerName) filters.manufacturerName = manufacturerName as string;
      if (isActive !== undefined) filters.isActive = isActive === "true";
      let devices = await storage.getPricingDevices(filters);
      console.log("[PRICING] Local devices found:", devices?.length || 0);
      
      // If no local devices found, fall back to external API
      // Try external API without categoryId first to get all devices
      if (!devices || devices.length === 0) {
        console.log("[PRICING] No local devices found, falling back to external API");
        const params = new URLSearchParams();
        if (categoryId) params.append("categoryId", categoryId as string);
        if (manufacturerName) params.append("manufacturerName", manufacturerName as string);
        params.append("pageNumber", "1");
        params.append("pageSize", "200");
        
        const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
        console.log("[PRICING] Calling external API:", url);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          devices = data.items || [];
          console.log("[PRICING] External API returned devices:", devices?.length || 0);
        } else {
          console.log("[PRICING] External API failed:", response.status);
        }
      }
      
      res.json(devices);
    } catch (error) {
      console.error("[PRICING] Error fetching pricing devices:", error);
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

  // ============== PRICING SERVICE (Cache de 7 dias + Scraping) ==============
  
  /**
   * POST /api/pricing/process-devices
   * Processa lista de dispositivos elegíveis com lógica de cache de 7 dias
   * Input: { categoryId: string, devices: EligibleDevice[] }
   * Output: DeviceWithPrices[] com preços atualizados
   */
  router.post("/api/pricing/process-devices", async (req, res) => {
    try {
      const { categoryId, devices } = req.body;
      
      if (!categoryId) {
        return res.status(400).json({ error: "categoryId is required" });
      }

      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({ error: "devices array is required" });
      }

      const results = await processEligibleDevices(categoryId, devices);
      res.json(results);
    } catch (error) {
      console.error("Error processing pricing devices:", error);
      res.status(500).json({ error: "Failed to process pricing devices" });
    }
  });

  /**
   * GET /api/pricing/device/:categoryId/:manufacturer/:model/:storage
   * Processa um único dispositivo com lógica de cache de 7 dias
   * Query params: forceRefresh=true para forçar novo scraping
   */
  router.get("/api/pricing/device/:categoryId/:manufacturer/:model/:storage", async (req, res) => {
    try {
      const { categoryId, manufacturer, model, storage } = req.params;
      const forceRefresh = req.query.forceRefresh === "true";
      
      const result = await processSingleDevice(
        categoryId,
        manufacturer,
        model,
        parseInt(storage, 10),
        forceRefresh
      );
      
      if (!result) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error processing single device:", error);
      res.status(500).json({ error: "Failed to process device" });
    }
  });

  /**
   * POST /api/pricing/device/refresh
   * Força o refresh de um dispositivo específico
   * Input: { categoryId, manufacturerName, modelName, storage }
   */
  router.post("/api/pricing/device/refresh", async (req, res) => {
    try {
      const { categoryId, manufacturerName, modelName, storage } = req.body;
      
      if (!categoryId || !manufacturerName || !modelName || !storage) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await processSingleDevice(
        categoryId,
        manufacturerName,
        modelName,
        storage,
        true // forceRefresh = true
      );
      
      if (!result) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error refreshing device:", error);
      res.status(500).json({ error: "Failed to refresh device" });
    }
  });

  /**
   * GET /api/pricing/scraped-data/:deviceId
   * Retorna os dados de scraping salvos para um dispositivo
   */
  router.get("/api/pricing/scraped-data/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const data = await storage.getPricingScrapedData(deviceId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching scraped data:", error);
      res.status(500).json({ error: "Failed to fetch scraped data" });
    }
  });

  /**
   * POST /api/pricing/devices/refresh
   * Força o refresh de múltiplos dispositivos (faz novo scraping)
   * Input: { devices: [{ categoryId, manufacturerName, modelName, storage }] }
   */
  router.post("/api/pricing/devices/refresh", async (req, res) => {
    console.log("[PRICING] POST /api/pricing/devices/refresh called");
    console.log("[PRICING] Request body:", req.body);
    
    try {
      const { devices } = req.body;
      
      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        console.log("[PRICING] No devices provided");
        return res.status(400).json({ error: "No devices provided" });
      }

      console.log(`[PRICING] Processing ${devices.length} devices for refresh`);

      const results = await Promise.all(
        devices.map(async (device) => {
          try {
            console.log(`[PRICING] Processing device:`, device);
            const result = await processSingleDevice(
              device.categoryId,
              device.manufacturerName,
              device.modelName,
              parseInt(device.storage, 10),
              true // forceRefresh = true
            );
            console.log(`[PRICING] Device processed:`, device.manufacturerName, device.modelName, "result:", !!result);
            
            // Save scraped data to database
            if (result && result.scrapedData && result.scrapedData.length > 0) {
              const deviceId = `${device.manufacturerName}-${device.modelName}-${device.storage}`.toLowerCase().replace(/\s+/g, "-");
              
              const scrapedDataRecords = result.scrapedData.map((offer: any) => ({
                deviceId,
                categoryId: device.categoryId,
                manufacturerName: device.manufacturerName,
                modelName: device.modelName,
                storage: parseInt(device.storage, 10),
                source: offer.source,
                extractedPrice: offer.extractedPrice ? String(offer.extractedPrice) : "0",
                productUrl: offer.productUrl,
                title: offer.title,
                priceText: offer.priceText,
                rawId: offer.rawId,
                thumbnail: offer.thumbnail,
                fromCache: result.fromCache,
                scrapedAt: new Date(),
              }));
              
              await storage.bulkCreatePricingScrapedData(scrapedDataRecords as any);
              console.log(`[PRICING] Saved ${scrapedDataRecords.length} records for device ${deviceId}`);
            }
            
            return {
              device: `${device.manufacturerName} ${device.modelName} ${device.storage}GB`,
              success: !!result,
              data: result
            };
          } catch (error) {
            console.error(`[PRICING] Error processing device ${device.manufacturerName} ${device.modelName}:`, error);
            return {
              device: `${device.manufacturerName} ${device.modelName} ${device.storage}GB`,
              success: false,
              error: String(error)
            };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      console.log(`[PRICING] Refresh complete: ${successCount}/${devices.length} succeeded`);
      
      res.json({
        message: `Refresh concluído: ${successCount}/${devices.length} dispositivos atualizados`,
        results
      });
    } catch (error) {
      console.error("[PRICING] Error refreshing devices:", error);
      res.status(500).json({ error: "Failed to refresh devices" });
    }
  });
}
