import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "./lib/db";
import { createCorsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { auth } from "./routes/auth";
import { settings } from "./routes/settings";
import { notifications } from "./routes/notifications";
import { slas } from "./routes/slas";
import { updates } from "./routes/updates";
import { flowcharts } from "./routes/flowcharts";
import { cep } from "./routes/cep";
import { users } from "./routes/users";
import { labels } from "./routes/labels";
import { devTools } from "./routes/dev-tools";
import { ai } from "./routes/ai";
import { okrs } from "./routes/okrs";
import { metas } from "./routes/metas";
import { knowledge } from "./routes/knowledge";
import { integrations } from "./routes/integrations";
import { tickets } from "./routes/tickets";
import { gitAnalytics } from "./routes/git-analytics";
import { pricing } from "./routes/pricing";
import { omie } from "./routes/omie";
import { projects } from "./routes/projects";
import { tasks } from "./routes/tasks";
import { shipments } from "./routes/shipments";
import { estoques } from "./routes/estoques";
import { uploads } from "./routes/uploads";
import { workspace } from "./routes/workspace";
import { triagem } from "./routes/triagem";

type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
  APP_URL: string;
  API_URL: string;
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
  GITHUB_WEBHOOK_SECRET: string;
  // SendPulse (Phase 2A — replaces nodemailer)
  SENDPULSE_CLIENT_ID: string;
  SENDPULSE_CLIENT_SECRET: string;
  SENDPULSE_FROM_EMAIL: string;
  SENDPULSE_FROM_NAME: string;
  DEV_TOOLS_TOKEN: string;
  APP_VERSION: string;
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

// Version endpoint
app.get("/api/version", (c) => {
  const version = c.env.APP_VERSION || "dev";
  const parts = version.split("-");
  const commit = parts.length > 1 ? parts[parts.length - 1] : "local";
  const buildDate = parts.length > 1 ? parts.slice(0, -1).join("-") : "local";
  const env = c.env.CORS_ORIGIN?.includes("-dev") ? "development" : "production";
  return c.json({ version, commit, buildDate, environment: env });
});

// Mount routes
app.route("/", auth);
app.route("/", settings);
app.route("/", notifications);
app.route("/", slas);
app.route("/", updates);
app.route("/", flowcharts);
app.route("/", cep);
app.route("/", users);
app.route("/", labels);
app.route("/", devTools);
app.route("/", ai);
app.route("/", okrs);
app.route("/", metas);
app.route("/", knowledge);
app.route("/", integrations);
app.route("/", tickets);
app.route("/", gitAnalytics);
app.route("/", pricing);
app.route("/", omie);
app.route("/", projects);
app.route("/", tasks);
app.route("/", shipments);
app.route("/", estoques);
app.route("/", uploads);
app.route("/", workspace);
app.route("/", triagem);

export default app;
