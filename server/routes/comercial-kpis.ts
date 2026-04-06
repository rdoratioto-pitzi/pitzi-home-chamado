import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { comercialKpis, insertComercialKpiSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";

export function registerComercialKpisRoutes(router: Router) {
  // GET /api/comercial/kpis — lista todos os KPIs ordenados por periodo DESC
  router.get("/api/comercial/kpis", requireAuth, async (_req, res) => {
    try {
      if (!db) return res.status(503).json({ error: "Database not available" });
      const rows = await db.select().from(comercialKpis).orderBy(desc(comercialKpis.periodo));
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar KPIs comerciais" });
    }
  });

  // GET /api/comercial/kpis/:periodo — KPI de um mês específico
  router.get("/api/comercial/kpis/:periodo", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: "Database not available" });
      const periodo = String(req.params.periodo);
      const [row] = await db.select().from(comercialKpis).where(eq(comercialKpis.periodo, periodo));
      if (!row) return res.status(404).json({ error: "KPI não encontrado para este período" });
      res.json(row);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar KPI" });
    }
  });

  // PUT /api/comercial/kpis/:periodo — upsert KPI mensal
  router.put("/api/comercial/kpis/:periodo", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: "Database not available" });
      const periodo = String(req.params.periodo);
      const validated = insertComercialKpiSchema.parse({ ...req.body, periodo });

      const [existing] = await db.select().from(comercialKpis).where(eq(comercialKpis.periodo, periodo));

      if (existing) {
        const [updated] = await db
          .update(comercialKpis)
          .set({ ...validated, updatedAt: new Date() })
          .where(eq(comercialKpis.periodo, periodo))
          .returning();
        return res.json(updated);
      }

      const [created] = await db.insert(comercialKpis).values(validated).returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Erro ao salvar KPI" });
    }
  });
}
