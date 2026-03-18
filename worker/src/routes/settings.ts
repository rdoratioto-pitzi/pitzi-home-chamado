import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { settings as settingsTable } from "../../../shared/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";

const settings = new Hono<AppEnv>();

settings.get("/api/settings", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const rows = user?.tenantId
    ? await db.select().from(settingsTable).where(eq(settingsTable.tenantId, user.tenantId))
    : await db.select().from(settingsTable);
  return c.json(rows);
});

settings.get("/api/settings/:key", async (c) => {
  const db = c.get("db");
  const key = c.req.param("key");
  const user = c.get("user");

  const conditions = [eq(settingsTable.key, key)];
  // tenantId filter for authenticated non-public requests
  if (user?.tenantId) {
    conditions.push(eq(settingsTable.tenantId, user.tenantId));
  }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(and(...conditions))
    .limit(1);

  if (!setting) {
    return c.json({ error: "Setting not found" }, 404);
  }
  return c.json(setting);
});

settings.post("/api/settings", requireAdmin, async (c) => {
  const body = z.object({
    key: z.string().min(1),
    value: z.string(),
  }).parse(await c.req.json());

  const db = c.get("db");
  const user = c.get("user");

  const tenantFilter = user.tenantId
    ? and(eq(settingsTable.key, body.key), eq(settingsTable.tenantId, user.tenantId))
    : eq(settingsTable.key, body.key);

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(tenantFilter)
    .limit(1);

  if (existing) {
    await db.update(settingsTable).set({ value: body.value }).where(tenantFilter);
  } else {
    await db.insert(settingsTable).values({ key: body.key, value: body.value, tenantId: user.tenantId });
  }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(tenantFilter)
    .limit(1);

  return c.json(setting, existing ? 200 : 201);
});

export { settings };
