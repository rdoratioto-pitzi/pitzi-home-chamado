import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "./lib/db";
import { createCorsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";

type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
  APP_URL: string;
  ATTACHMENTS: R2Bucket;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_FROM: string;
  OPENROUTER_API_KEY: string;
  CORREIOS_USUARIO: string;
  CORREIOS_SENHA: string;
  CORREIOS_CARTAO_POSTAGEM: string;
  CORREIOS_COD_ADMINISTRATIVO: string;
  CORREIOS_TOKEN: string;
  CORREIOS_HOMOLOGACAO: string;
  FIRECRAWL_API_KEY: string;
  CLAUDE_USAGE_SECRET: string;
  GITHUB_TOKEN: string;
};

export type AuthUser = {
  userId: string;
  tenantId: string | null;
  role: "admin" | "user";
};

type Variables = {
  user: AuthUser;
  db: Database;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

// Error handler
app.onError(errorHandler);

// CORS
app.use("*", createCorsMiddleware());

// Per-request DB
app.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  await next();
});

// Auth
app.use("/api/*", authMiddleware);

// Health check
app.get("/api/health", async (c) => {
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    return c.json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() }, 500);
  }
});

export default app;
