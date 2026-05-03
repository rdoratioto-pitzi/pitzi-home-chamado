import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "./lib/db";
import { createCorsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { sanitizeRichText } from "./lib/sanitize-rich-text";
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
import { avaliacoes } from "./routes/avaliacoes";
import { comercialKpisRoutes } from "./routes/comercial-kpis";
import { external } from "./routes/external";
import { serviceAccounts } from "./routes/service-accounts";

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
  // Slack (Fase 1 — outbound only). Todos opcionais — service desabilita
  // silenciosamente se SLACK_BOT_TOKEN ausente ou SLACK_INTEGRATION_ENABLED=false.
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string; // Reservado para Fase 2 (eventos inbound)
  SLACK_CHANNEL_DEVS?: string;
  SLACK_INTEGRATION_ENABLED?: string;
  // SendPulse (Phase 2A — replaces nodemailer)
  SENDPULSE_CLIENT_ID: string;
  SENDPULSE_CLIENT_SECRET: string;
  SENDPULSE_FROM_EMAIL: string;
  SENDPULSE_FROM_NAME: string;
  VENUS_API_KEY: string;
  DEV_TOOLS_TOKEN: string;
  APP_VERSION: string;
  // Hermes (Fase 2 — webhook outbound). Opcionais — service desabilita
  // silenciosamente se ausentes.
  HERMES_ROUTINE_URL?: string;
  HERMES_ROUTINE_TOKEN?: string;
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

// Sanitização de campos rich-text em bodies JSON (POST/PATCH/PUT)
const RICH_TEXT_FIELDS = ["descricao", "description", "content", "comentario", "message", "texto"] as const;
app.use("*", async (c, next) => {
  const method = c.req.method;
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const ctype = c.req.header("content-type") || "";
    if (ctype.includes("application/json")) {
      try {
        const body: any = await c.req.json();
        if (body && typeof body === "object" && !Array.isArray(body)) {
          for (const key of RICH_TEXT_FIELDS) {
            if (typeof body[key] === "string" && body[key].length > 0) {
              body[key] = sanitizeRichText(body[key]);
            }
          }
        }
        // Override c.req.json para retornar o body sanitizado nas chamadas dos handlers
        (c.req as any).json = async () => body;
      } catch {
        // body vazio / não-JSON / json inválido — segue sem mexer
      }
    }
  }
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
app.route("/", avaliacoes);
app.route("/", comercialKpisRoutes);
app.route("/", external);
app.route("/", serviceAccounts);

export default app;
