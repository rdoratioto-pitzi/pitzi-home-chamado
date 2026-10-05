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
import { supportGroups } from "./routes/support-groups";
import { ticketQueue } from "./routes/ticket-queue";
import { ticketFields } from "./routes/ticket-fields";
import { automations } from "./routes/automations";
import { knowledgeBase } from "./routes/knowledge-base";
import { emailSettings } from "./routes/email-settings";
import { slack } from "./routes/slack";
import { getStorage } from "./lib/storage";
import { runWaitingRequesterTimeouts } from "../../server/services/automations.service";
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
import { hermes } from "./routes/hermes";

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
  // Segredo do emissor externo de eventos de logística reversa (header X-Webhook-Secret).
  LOGISTICA_WEBHOOK_SECRET?: string;
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  // Slack (Fase 1 — outbound only). Todos opcionais — service desabilita
  // silenciosamente se SLACK_BOT_TOKEN ausente ou SLACK_INTEGRATION_ENABLED=false.
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string; // Assinatura das requisições do Slack (/chamado e atalhos)
  SLACK_THREAD_SYNC_ENABLED?: string;
  SLACK_INTERNAL_NOTES_TO_THREAD_ENABLED?: string;
  SLACK_ALLOWED_TEAM_ID?: string;
  SLACK_ALLOWED_TEAM_IDS?: string;
  SLACK_CHANNEL_DEVS?: string;
  SLACK_INTEGRATION_ENABLED?: string;
  // SendPulse (Phase 2A — replaces nodemailer)
  SENDPULSE_CLIENT_ID: string;
  SENDPULSE_CLIENT_SECRET: string;
  SENDPULSE_FROM_EMAIL: string;
  SENDPULSE_FROM_NAME: string;
  // Gmail (e-mails dos chamados). GMAIL_SENDER é var; as credenciais da conta de serviço com
  // delegação no domínio são segredos (docs/emails-gmail-setup.md). Sem elas, a fila registra
  // os e-mails como "not_configured".
  GMAIL_SENDER?: string;
  // Login com Google (docs/login-google-setup.md). Vazio = ainda não configurado.
  GOOGLE_LOGIN_CLIENT_ID?: string;
  ALLOWED_GOOGLE_DOMAINS?: string;
  /** Chave de emergência: "true" volta a aceitar senha, só para admins. */
  PASSWORD_LOGIN_ENABLED?: string;
  GOOGLE_SA_CLIENT_EMAIL?: string;
  GOOGLE_SA_PRIVATE_KEY?: string;
  VENUS_API_KEY: string;
  DEV_TOOLS_TOKEN: string;
  // Token das APIs em dash.pitzi.com.br (estoque, triagem, logística, avaliações).
  RENOVSMART_API_TOKEN?: string;
  APP_VERSION: string;
  // Hermes (Fase 2 — webhook outbound). Opcionais — service desabilita
  // silenciosamente se ausentes.
  HERMES_ROUTINE_URL?: string;
  HERMES_ROUTINE_TOKEN?: string;
  // Hermes (Fase 4 — Executor pós-aprovação). Opcionais — service desabilita
  // silenciosamente se ausentes.
  HERMES_EXECUTOR_URL?: string;
  HERMES_EXECUTOR_TOKEN?: string;
};

export type AuthUser = {
  userId: string;
  tenantId: string | null;
  role: "admin" | "user";
  /** Linha de refresh_tokens que representa a sessão (dispositivo) do token de acesso. */
  sessionId?: string;
  /** users.module_permissions atual (JSON), carregado com a sessão. */
  modulePermissions?: unknown;
};

type Variables = {
  user: AuthUser;
  db: Database;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

import { activeRoutesMiddleware } from "./middleware/active-routes";
import { configureRsApiToken } from "./lib/rs-token";
import { processPendingEmails } from "./lib/mailer";
import { processInboundEmails } from "./lib/inbound-email";

const app = new Hono<AppEnv>();

// Error handler
app.onError(errorHandler);

// CORS
app.use("*", createCorsMiddleware());
app.use("*", activeRoutesMiddleware);

// Per-request DB
app.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  configureRsApiToken(c.env.RENOVSMART_API_TOKEN);
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
app.route("/", supportGroups);
app.route("/", ticketQueue);
app.route("/", ticketFields);
app.route("/", automations);
app.route("/", knowledgeBase);
app.route("/", emailSettings);
app.route("/", slack);
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
app.route("/", hermes);

// Cron (wrangler.toml [triggers]): automações "X dias aguardando o solicitante".
async function scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
  const db = createDb(env.DATABASE_URL);
  // Fila de e-mails: a cada execução (5 em 5 minutos).
  ctx.waitUntil((async () => {
    const result = await processPendingEmails(env, db, { releaseStuck: true, limit: 50 });
    if (result.sent || result.failed || result.retrying) console.log("[cron] e-mails:", result);
  })());
  // Respostas por e-mail: lê a caixa chamados@ e grava como comentário (lib/inbound-email.ts).
  ctx.waitUntil((async () => {
    const inbound = await processInboundEmails(env, db, { limit: 25, timeBudgetMs: 20_000 });
    if (inbound.processed || inbound.ignored || inbound.errors || inbound.status !== "ok") {
      console.log("[cron] respostas por e-mail:", inbound);
    }
  })());
  // Automações por tempo: só na execução do minuto 0 de cada hora (o cron roda a cada minuto),
  // para uma regra que não muda o status não repetir a nota a cada execução.
  if (new Date(event.scheduledTime).getUTCMinutes() !== 0) return;
  ctx.waitUntil((async () => {
    try {
      const touched = await runWaitingRequesterTimeouts(getStorage(db));
      if (touched) console.log(`[cron] automações por tempo aplicadas em ${touched} chamado(s)`);
    } catch (error) {
      console.error("[cron] falha nas automações por tempo:", error);
    }
  })());
}

export { app };
export default { fetch: app.fetch, scheduled };
