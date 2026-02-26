import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { setupSession, requireAuth } from "./auth";
import { startRecurrenceJob } from "./jobs/recurrence.job";
import { startGitSyncJob } from "./jobs/git-sync.job";
import { storage } from "./storage";

/**
 * --------------------------------------------------
 * GLOBAL ERROR CAPTURE (elimina erros silenciosos)
 * --------------------------------------------------
 */
process.on("unhandledRejection", (reason: any) => {
  console.error("🚨 UNHANDLED REJECTION");
  console.error(reason);
});

process.on("uncaughtException", (error: any) => {
  console.error("🚨 UNCAUGHT EXCEPTION");
  console.error(error);
});

/**
 * --------------------------------------------------
 * APP INIT
 * --------------------------------------------------
 */
const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/**
 * --------------------------------------------------
 * BODY PARSERS
 * --------------------------------------------------
 */
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ limit: "50mb", extended: false }));

/**
 * --------------------------------------------------
 * SESSION + AUTH
 * --------------------------------------------------
 */
setupSession(app);

// ============== ROTA DE TESTE PÚBLICA (TEMPORÁRIA) ==============
// Rota para validar geração de URLs de chamados para e-mails
// Testar acessando: GET /api/test-email-url/CHA-0054
app.get("/api/test-email-url/:code", (req, res) => {
  const { code } = req.params;
  const baseUrl = process.env.APP_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || "https://home.renovsmart.com.br";
  const ticketUrl = `${baseUrl}/chamados?id=${code}`;
  
  res.json({
    code,
    url: ticketUrl,
    env: {
      APP_URL: process.env.APP_URL || "(não definido)",
      REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN || "(não definido)",
      resolvedBaseUrl: baseUrl
    },
    expectedFormat: "https://home.renovsmart.com.br/chamados?id=CHA-XXXX",
    isCorrect: ticketUrl.includes("?id=")
  });
});

// Protege tudo depois disso
app.use((req, res, next) => {
  try {
    requireAuth(req, res, next);
  } catch (err) {
    next(err);
  }
});

/**
 * --------------------------------------------------
 * LOGGER
 * --------------------------------------------------
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

/**
 * --------------------------------------------------
 * ASYNC WRAPPER (use nas rotas)
 * --------------------------------------------------
 */
export const asyncHandler =
  (fn: any) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * --------------------------------------------------
 * BOOTSTRAP
 * --------------------------------------------------
 */
(async () => {
  try {
    await seedDatabase();
    await registerRoutes(httpServer, app);

    /**
     * ----------------------------------------------
     * ERROR MIDDLEWARE (sempre por último)
     * ----------------------------------------------
     */
    app.use(
      (err: any, req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;

        console.error("=================================");
        console.error("🔥 ERROR OCCURRED");
        console.error("Route:", req.method, req.originalUrl);
        console.error("Status:", status);
        console.error("Body:", req.body);
        console.error("Params:", req.params);
        console.error("Query:", req.query);
        console.error("Stack:", err.stack || err);
        console.error("=================================");

        if (res.headersSent) {
          return next(err);
        }

        return res.status(status).json({
          success: false,
          message:
            process.env.NODE_ENV === "production"
              ? "Internal Server Error"
              : err.message,
        });
      },
    );

    /**
     * ----------------------------------------------
     * STATIC / VITE
     * ----------------------------------------------
     */
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    /**
     * ----------------------------------------------
     * SERVER START
     * ----------------------------------------------
     */
    const port = parseInt(process.env.PORT || "5050", 10);

    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
      async () => {
        log(`serving on port ${port}`);

        // Iniciar cron job de recorrência
        startRecurrenceJob();

        // Iniciar cron job de sincronização Git Analytics
        startGitSyncJob();

        // Verificar se a tabela de prompts está vazia e executar sincronização inicial
        // Usando importação dinâmica para evitar erros de módulo na inicialização
        try {
          const { startPromptsSyncJob, runPromptsSyncNow } = await import("./jobs/prompts-sync.job");
          
          // Iniciar cron job de prompts
          startPromptsSyncJob();
          
          // Verificar se precisa de sincronização inicial
          const stats = await storage.getPromptStats();
          if (stats.total === 0) {
            log("[Prompts] Tabela vazia, executando primeira sincronização...", "prompts-sync");
            const result = await runPromptsSyncNow();
            log(`[Prompts] Sincronização inicial concluída: ${result.created} criados, ${result.updated} atualizados`, "prompts-sync");
          } else {
            log(`[Prompts] Biblioteca já possui ${stats.total} prompts`, "prompts-sync");
          }
        } catch (error) {
          console.error("[Prompts] Erro na inicialização do módulo de prompts:", error);
          console.error("[Prompts] O servidor continuará funcionando, mas a sincronização de prompts pode não estar disponível.");
        }
      },
    );
  } catch (err) {
    console.error("❌ FATAL BOOT ERROR:", err);
    process.exit(1);
  }
})();