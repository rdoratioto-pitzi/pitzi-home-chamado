// worker/src/routes/comercial-kpis.ts
import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { AppEnv } from "../index";
import { comercialKpis, insertComercialKpiSchema } from "../../../shared/schema";

const comercialKpisRoutes = new Hono<AppEnv>();

// GET /api/comercial/kpis — lista todos os KPIs ordenados por periodo DESC
comercialKpisRoutes.get("/api/comercial/kpis", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(comercialKpis).orderBy(desc(comercialKpis.periodo));
  return c.json(rows);
});

// GET /api/comercial/kpis/:periodo — KPI de um mês específico
comercialKpisRoutes.get("/api/comercial/kpis/:periodo", async (c) => {
  const db = c.get("db");
  const periodo = c.req.param("periodo");
  const [row] = await db.select().from(comercialKpis).where(eq(comercialKpis.periodo, periodo));
  if (!row) return c.json({ error: "KPI não encontrado para este período" }, 404);
  return c.json(row);
});

// PUT /api/comercial/kpis/:periodo — upsert KPI mensal
comercialKpisRoutes.put("/api/comercial/kpis/:periodo", async (c) => {
  const db = c.get("db");
  const periodo = c.req.param("periodo");
  const body = await c.req.json();
  const validated = insertComercialKpiSchema.parse({ ...body, periodo });

  const [existing] = await db.select().from(comercialKpis).where(eq(comercialKpis.periodo, periodo));

  if (existing) {
    const [updated] = await db
      .update(comercialKpis)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(comercialKpis.periodo, periodo))
      .returning();
    return c.json(updated);
  }

  const [created] = await db.insert(comercialKpis).values(validated).returning();
  return c.json(created, 201);
});

export { comercialKpisRoutes };
