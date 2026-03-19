// worker/src/routes/dev-tools.ts
import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";

const devTools = new Hono<AppEnv>();

const EXTERNAL_API_BASE = "https://dash.renovsmart.com.br/api/sql";

// POST /api/dev/sql-execute (admin — security fix: was unprotected)
devTools.post("/api/dev/sql-execute", requireAdmin, async (c) => {
  const { query } = await c.req.json();
  if (!query) {
    return c.json({ error: "Query is required" }, 400);
  }

  const token = c.env.DEV_TOOLS_TOKEN;
  if (!token) {
    return c.json({ error: "DEV_TOOLS_TOKEN not configured" }, 500);
  }

  const response = await fetch(`${EXTERNAL_API_BASE}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    try {
      return c.json(JSON.parse(errorData), response.status as any);
    } catch {
      return c.json({ error: "External API Error", details: errorData }, response.status as any);
    }
  }

  const data = await response.json();
  return c.json(data);
});

// POST /api/dev/sql-export (admin — security fix: was unprotected)
devTools.post("/api/dev/sql-export", requireAdmin, async (c) => {
  const { query, format } = await c.req.json();
  if (!query) {
    return c.json({ error: "Query is required" }, 400);
  }

  const token = c.env.DEV_TOOLS_TOKEN;
  if (!token) {
    return c.json({ error: "DEV_TOOLS_TOKEN not configured" }, 500);
  }

  const response = await fetch(`${EXTERNAL_API_BASE}/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, format }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      return c.json(JSON.parse(errorText), response.status as any);
    } catch {
      return c.json(
        { error: "External API Error", details: errorText },
        response.status as any,
      );
    }
  }

  // Stream the file response directly to client
  const contentType = response.headers.get("Content-Type") || "application/octet-stream";
  const contentDisposition =
    response.headers.get("Content-Disposition") ||
    `attachment; filename=export.${format === "csv" ? "csv" : "xlsx"}`;

  return new Response(response.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
    },
  });
});

export { devTools };
