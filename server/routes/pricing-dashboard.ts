import { Router } from "express";
import { storage } from "../storage";
import { getSessionUser, requireAuth } from "../middleware/auth";

const DASHBOARD_RH_BASE_URL =
  process.env.DASHBOARD_PRICING_RH_BASE_URL ||
  "http://localhost:2060/api/dashboard_pricing_rh";
const DASHBOARD_RH_TOKEN = process.env.DASHBOARD_PRICING_RH_TOKEN || "Renov123";

async function fetchDashboardRh(path: string, init?: RequestInit) {
  const response = await fetch(`${DASHBOARD_RH_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${DASHBOARD_RH_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `dashboard_pricing_rh ${path} failed: ${response.status} ${message}`
    );
  }

  return response.json();
}

export function registerPricingDashboardRoutes(router: Router) {
  /**
   * GET /api/pricing/metadata
   * Retorna metadados para os filtros (redes, categorias, semanas)
   */
  router.get("/api/pricing/metadata", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const user = await storage.getUser(userId);
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [networksResp, categoriesResp, weeksResp] = await Promise.all([
        fetchDashboardRh("/networks"),
        fetchDashboardRh("/categories"),
        fetchDashboardRh("/weeks"),
      ]);

      res.json({
        networks: networksResp?.networks || [],
        categories: categoriesResp?.categories || [],
        weeks: weeksResp?.weeks || [],
        defaultWeeks: weeksResp?.default || [],
      });
    } catch (error) {
      console.error("[PRICING DASHBOARD] Metadata error:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  /**
   * POST /api/pricing/top50
   * Retorna top N modelos com métricas de pricing
   * Body: { networks?, categories?, weeks?, limit }
   */
  router.post("/api/pricing/top50", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const user = await storage.getUser(userId);
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { networks, categories, weeks, limit = 50 } = req.body;

      const data = await fetchDashboardRh("/top50", {
        method: "POST",
        body: JSON.stringify({
          networks,
          categories,
          weeks,
          limit,
        }),
      });

      res.json({ data: Array.isArray(data) ? data : [] });
    } catch (error) {
      console.error("[PRICING DASHBOARD] Top50 error:", error);
      res.status(500).json({ error: "Failed to fetch top50 data" });
    }
  });

  /**
   * POST /api/pricing/monthly
   * Retorna evolução mensal dos top 3 fabricantes
   * Body: { networks?, categories? }
   */
  router.post("/api/pricing/monthly", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const user = await storage.getUser(userId);
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { networks, categories } = req.body;

      const data = await fetchDashboardRh("/monthly", {
        method: "POST",
        body: JSON.stringify({
          networks,
          categories,
        }),
      });

      res.json({ data: Array.isArray(data) ? data : [] });
    } catch (error) {
      console.error("[PRICING DASHBOARD] Monthly error:", error);
      res.status(500).json({ error: "Failed to fetch monthly data" });
    }
  });
}
