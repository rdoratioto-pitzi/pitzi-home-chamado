// worker/src/routes/pricing.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import { insertPricingAlertSchema } from "../../../shared/schema";
import {
  processEligibleDevices,
  processSingleDevice,
} from "../services/pricing.service";

const pricing = new Hono<AppEnv>();

const RENOVSMART_API_BASE = "https://rp.pitzi.com.br/api";

// ============== PRICING API PROXY (Pitzi) ==============

// GET /api/pricing/eligible-devices
pricing.get("/api/pricing/eligible-devices", async (c) => {
  try {
    const categoryId = c.req.query("categoryId");
    const pageNumber = c.req.query("pageNumber") || "1";
    const pageSize = c.req.query("pageSize") || "100";

    if (!categoryId) {
      return c.json({ items: [], currentPage: 1, hasNextPage: false });
    }

    const params = new URLSearchParams();
    params.append("categoryId", categoryId);
    params.append("pageNumber", pageNumber);
    params.append("pageSize", pageSize);

    const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Pitzi-Pricing/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return c.json({ items: [], currentPage: 1, hasNextPage: false });
    }

    const data = (await response.json()) as any;

    // Filter Xiaomi/Redmi devices
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.filter((item: any) => {
        const brand = (item.manufacturerName || "").toUpperCase();
        return (
          !brand.includes("XIAOMI") &&
          !brand.includes("XIOMI") &&
          !brand.includes("REDMI")
        );
      });
    }

    return c.json(data);
  } catch (error) {
    console.error("[PRICING] eligible-devices error:", error);
    return c.json({ items: [], currentPage: 1, hasNextPage: false });
  }
});

// GET /api/pricing/search
pricing.get("/api/pricing/search", async (c) => {
  try {
    const queryParams = new URLSearchParams(
      c.req.query() as Record<string, string>,
    ).toString();
    const url = `${RENOVSMART_API_BASE}/search?${queryParams}`;
    const response = await fetch(url);
    if (!response.ok) return c.json({ raw: { shopping_results: [] } });
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Pricing search error:", error);
    return c.json({ raw: { shopping_results: [] } });
  }
});

// GET /api/pricing/agg/by-device
pricing.get("/api/pricing/agg/by-device", async (c) => {
  try {
    const queryParams = new URLSearchParams(
      c.req.query() as Record<string, string>,
    ).toString();
    const url = `${RENOVSMART_API_BASE}/agg/by-device?${queryParams}`;
    const response = await fetch(url);
    if (!response.ok) return c.json([]);
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Pricing agg/by-device error:", error);
    return c.json([]);
  }
});

// GET /api/pricing/eligible-devices/price
pricing.get("/api/pricing/eligible-devices/price", async (c) => {
  try {
    const queryParams = new URLSearchParams(
      c.req.query() as Record<string, string>,
    ).toString();
    const url = `${RENOVSMART_API_BASE}/eligible-devices/price?${queryParams}`;
    const response = await fetch(url);
    if (!response.ok) return c.json({});
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Pricing eligible-devices/price error:", error);
    return c.json({});
  }
});

// ============== LOCAL PRICING DEVICES API ==============

// GET /api/pricing/devices
pricing.get("/api/pricing/devices", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const categoryId = c.req.query("categoryId");
    const manufacturerName = c.req.query("manufacturerName");
    const isActive = c.req.query("isActive");

    const filters: any = {};
    if (categoryId) filters.categoryId = categoryId;
    if (manufacturerName) filters.manufacturerName = manufacturerName;
    if (isActive !== undefined) filters.isActive = isActive === "true";

    let devices = await storage.getPricingDevices(filters);

    // Fallback to external API if no local devices
    if (!devices || devices.length === 0) {
      const params = new URLSearchParams();
      if (categoryId) params.append("categoryId", categoryId);
      if (manufacturerName)
        params.append("manufacturerName", manufacturerName);
      params.append("pageNumber", "1");
      params.append("pageSize", "200");

      const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as any;
        devices = data.items || [];
      }
    }

    return c.json(devices);
  } catch (error) {
    console.error("[PRICING] Error fetching pricing devices:", error);
    return c.json({ error: "Failed to fetch pricing devices" }, 500);
  }
});

// GET /api/pricing/devices/:id
pricing.get("/api/pricing/devices/:id", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const device = await storage.getPricingDevice(c.req.param("id"));
    if (!device)
      return c.json({ error: "Pricing device not found" }, 404);
    return c.json(device);
  } catch (error) {
    return c.json({ error: "Failed to fetch pricing device" }, 500);
  }
});

// POST /api/pricing/devices (admin)
pricing.post("/api/pricing/devices", requireAdmin, async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const body = await c.req.json();
    const validated = z
      .object({
        name: z.string(),
        description: z.string().optional(),
        manufacturerName: z.string(),
        categoryId: z.string(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      })
      .parse(body);

    const device = await storage.createPricingDevice(validated as any);
    return c.json(device, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation failed", details: error.errors },
        400,
      );
    }
    return c.json({ error: "Failed to create pricing device" }, 500);
  }
});

// PUT /api/pricing/devices/:id (admin)
pricing.put("/api/pricing/devices/:id", requireAdmin, async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const body = await c.req.json();
    const validated = z
      .object({
        name: z.string(),
        description: z.string().optional(),
        manufacturerName: z.string(),
        categoryId: z.string(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      })
      .partial()
      .parse(body);

    const device = await storage.updatePricingDevice(
      c.req.param("id"),
      validated as any,
    );
    if (!device)
      return c.json({ error: "Pricing device not found" }, 404);
    return c.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation failed", details: error.errors },
        400,
      );
    }
    return c.json({ error: "Failed to update pricing device" }, 500);
  }
});

// DELETE /api/pricing/devices/:id (admin)
pricing.delete("/api/pricing/devices/:id", requireAdmin, async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const deleted = await storage.deletePricingDevice(c.req.param("id"));
    if (!deleted)
      return c.json({ error: "Pricing device not found" }, 404);
    return c.body(null, 204);
  } catch (error) {
    return c.json({ error: "Failed to delete pricing device" }, 500);
  }
});

// ============== PRICING ALERTS ==============

// GET /api/pricing-alerts
pricing.get("/api/pricing-alerts", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const alerts = await storage.getPricingAlerts();
    return c.json(alerts);
  } catch (error) {
    return c.json({ error: "Failed to fetch pricing alerts" }, 500);
  }
});

// POST /api/pricing-alerts
pricing.post("/api/pricing-alerts", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const body = await c.req.json();
    const validated = insertPricingAlertSchema.parse(body);
    const alert = await storage.createPricingAlert(validated);
    return c.json(alert, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation failed", details: error.errors },
        400,
      );
    }
    return c.json({ error: "Failed to create pricing alert" }, 400);
  }
});

// DELETE /api/pricing-alerts/:id
pricing.delete("/api/pricing-alerts/:id", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const deleted = await storage.deletePricingAlert(c.req.param("id"));
    if (!deleted)
      return c.json({ error: "Pricing alert not found" }, 404);
    return c.body(null, 204);
  } catch (error) {
    return c.json({ error: "Failed to delete pricing alert" }, 500);
  }
});

// ============== PRICING SERVICE (Cache + Scraping) ==============

// POST /api/pricing/process-devices
pricing.post("/api/pricing/process-devices", async (c) => {
  try {
    const { categoryId, devices } = await c.req.json();

    if (!categoryId) {
      return c.json({ error: "categoryId is required" }, 400);
    }
    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return c.json({ error: "devices array is required" }, 400);
    }

    const results = await processEligibleDevices(categoryId, devices);
    return c.json(results);
  } catch (error) {
    console.error("Error processing pricing devices:", error);
    return c.json({ error: "Failed to process pricing devices" }, 500);
  }
});

// GET /api/pricing/device/:categoryId/:manufacturer/:model/:storage
pricing.get(
  "/api/pricing/device/:categoryId/:manufacturer/:model/:storage",
  async (c) => {
    try {
      const categoryId = c.req.param("categoryId");
      const manufacturer = c.req.param("manufacturer");
      const model = c.req.param("model");
      const storageParam = c.req.param("storage");
      const forceRefresh = c.req.query("forceRefresh") === "true";

      const result = await processSingleDevice(
        categoryId,
        manufacturer,
        model,
        parseInt(storageParam, 10),
        forceRefresh,
      );

      if (!result) {
        return c.json({ error: "Device not found" }, 404);
      }

      return c.json(result);
    } catch (error) {
      console.error("Error processing single device:", error);
      return c.json({ error: "Failed to process device" }, 500);
    }
  },
);

// POST /api/pricing/device/refresh
pricing.post("/api/pricing/device/refresh", async (c) => {
  try {
    const { categoryId, manufacturerName, modelName, storage } =
      await c.req.json();

    if (!categoryId || !manufacturerName || !modelName || !storage) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result = await processSingleDevice(
      categoryId,
      manufacturerName,
      modelName,
      storage,
      true,
    );

    if (!result) {
      return c.json({ error: "Device not found" }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error("Error refreshing device:", error);
    return c.json({ error: "Failed to refresh device" }, 500);
  }
});

// GET /api/pricing/scraped-data/:deviceId
pricing.get("/api/pricing/scraped-data/:deviceId", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const data = await storage.getPricingScrapedData(c.req.param("deviceId"));
    return c.json(data);
  } catch (error) {
    console.error("Error fetching scraped data:", error);
    return c.json({ error: "Failed to fetch scraped data" }, 500);
  }
});

// POST /api/pricing/devices/refresh
pricing.post("/api/pricing/devices/refresh", async (c) => {
  try {
    const storage = getStorage(c.get("db"));
    const { devices } = await c.req.json();

    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return c.json({ error: "No devices provided" }, 400);
    }

    const results = await Promise.all(
      devices.map(async (device: any) => {
        try {
          const result = await processSingleDevice(
            device.categoryId,
            device.manufacturerName,
            device.modelName,
            parseInt(device.storage, 10),
            true,
          );

          // Save scraped data to database
          if (result && result.scrapedData && result.scrapedData.length > 0) {
            const deviceId =
              `${device.manufacturerName}-${device.modelName}-${device.storage}`
                .toLowerCase()
                .replace(/\s+/g, "-");

            const scrapedDataRecords = result.scrapedData.map(
              (offer: any) => ({
                deviceId,
                categoryId: device.categoryId,
                manufacturerName: device.manufacturerName,
                modelName: device.modelName,
                storage: parseInt(device.storage, 10),
                source: offer.source,
                extractedPrice: offer.extractedPrice
                  ? String(offer.extractedPrice)
                  : "0",
                productUrl: offer.productUrl,
                title: offer.title,
                priceText: offer.priceText,
                rawId: offer.rawId,
                thumbnail: offer.thumbnail,
                fromCache: result.fromCache,
                scrapedAt: new Date(),
              }),
            );

            await storage.bulkCreatePricingScrapedData(
              scrapedDataRecords as any,
            );
          }

          return {
            device: `${device.manufacturerName} ${device.modelName} ${device.storage}GB`,
            success: !!result,
            data: result,
          };
        } catch (error) {
          return {
            device: `${device.manufacturerName} ${device.modelName} ${device.storage}GB`,
            success: false,
            error: String(error),
          };
        }
      }),
    );

    const successCount = results.filter((r) => r.success).length;
    return c.json({
      message: `Refresh concluído: ${successCount}/${devices.length} dispositivos atualizados`,
      results,
    });
  } catch (error) {
    console.error("[PRICING] Error refreshing devices:", error);
    return c.json({ error: "Failed to refresh devices" }, 500);
  }
});

export { pricing };
