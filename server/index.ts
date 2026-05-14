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
 * DATABASE CONNECTION TEST
 * --------------------------------------------------
 */
import { pool } from './db';

async function fixOmieConfig() {
  try {
    console.log('[Omie Setup] Verificando configuração...');
    
    // Verificar se tabela existe
    const tableCheck = await pool?.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'omie_config'
      );
    `);
    
    if (!tableCheck?.rows[0].exists) {
      console.error('[Omie Setup] Tabela omie_config não existe! Execute a migration.');
      return;
    }
    
    // Verificar se há configuração
    const configCheck = await pool?.query('SELECT * FROM omie_config LIMIT 1');
    
    if (!configCheck?.rows || configCheck.rows.length === 0) {
      console.log('[Omie Setup] Nenhuma configuração encontrada. Inserindo credenciais...');
      
      await pool?.query(`
        INSERT INTO omie_config (app_key, app_secret, is_active)
        VALUES ($1, $2, $3)
      `, ['3512564154099', '3bf7b7131fe0f76a23f567387841fbb8', true]);
      
      console.log('[Omie Setup] ✓ Credenciais inseridas com sucesso');
    } else {
      console.log('[Omie Setup] ✓ Configuração existente encontrada');
      console.log('  - App Key:', configCheck.rows[0].app_key?.substring(0, 5) + '...');
      console.log('  - Ativo:', configCheck.rows[0].is_active);
      // Não sobrescrever credenciais salvas pelo usuário
    }
    
    // Verificar tabela de logs
    const logsTableCheck = await pool?.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'omie_sync_log'
      );
    `);
    
    if (logsTableCheck?.rows[0].exists) {
      console.log('[Omie Setup] ✓ Tabela de logs OK');
    } else {
      console.error('[Omie Setup] ✗ Tabela omie_sync_log não existe!');
    }
    
  } catch (error: any) {
    console.error('[Omie Setup] Erro ao verificar configuração:', error.message);
  }
}

async function testDatabaseConnection() {
  try {
    console.log('[Database] Testing connection...');
    
    const timeResult = await pool?.query('SELECT NOW()');
    console.log('[Database] Connection OK:', timeResult?.rows[0]?.now);
    
    // Test if omie_config table exists and has data
    const configTest = await pool?.query('SELECT * FROM omie_config LIMIT 1');
    console.log('[Database] Omie config table exists:', configTest?.rows !== undefined);
    
    if (configTest?.rows && configTest.rows.length > 0) {
      console.log('[Database] Omie config app_key:', configTest.rows[0].app_key?.substring(0, 5) + '...');
      console.log('[Database] Omie config is_active:', configTest.rows[0].is_active);
    } else {
      console.log('[Database] WARNING: No omie_config found. Run migration.');
    }
    
    // Test if omie_sync_log table exists
    const logTest = await pool?.query('SELECT COUNT(*) as count FROM omie_sync_log');
    console.log('[Database] Omie sync log count:', logTest?.rows[0]?.count);
    
  } catch (error: any) {
    console.error('[Database] Connection test failed:', error.message);
  }
}

/**
 * --------------------------------------------------
 * AUTO-MIGRATION: ensure production schema is up-to-date
 * --------------------------------------------------
 */
async function autoMigrateSchema() {
  if (!pool) return;
  try {
    console.log('[migration] Checking schema...');
    const migrations: string[] = [
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating integer`,
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_comment text`,
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_date timestamp`,
      `ALTER TABLE prompts_library ADD COLUMN IF NOT EXISTS translated_content text`,
      `ALTER TABLE prompts_library ADD COLUMN IF NOT EXISTS translated_at timestamp`,
      `ALTER TABLE prompts_library ADD COLUMN IF NOT EXISTS is_translated boolean DEFAULT false`,
      // Omie integration tables
      `CREATE TABLE IF NOT EXISTS omie_config (
        id SERIAL PRIMARY KEY,
        app_key VARCHAR(255) NOT NULL,
        app_secret VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS omie_sync_log (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        total_records INTEGER DEFAULT 0,
        request_params JSONB,
        response_data JSONB,
        error_message TEXT,
        synced_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_omie_sync_category ON omie_sync_log(category)`,
      `CREATE INDEX IF NOT EXISTS idx_omie_sync_status ON omie_sync_log(status)`,
      `CREATE INDEX IF NOT EXISTS idx_omie_sync_synced_at ON omie_sync_log(synced_at DESC)`,
      // Migration 0012: Kanban Labels, Checklist, Card Dependencies e Subtarefas em Tasks
      `ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS checklist text`,
      `ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS label_ids text`,
      `CREATE TABLE IF NOT EXISTS kanban_labels (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar,
        project_id varchar NOT NULL,
        name text NOT NULL,
        color text NOT NULL DEFAULT '#6366f1',
        created_at timestamp DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS kanban_card_dependencies (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar,
        project_id varchar NOT NULL,
        blocking_card_id varchar NOT NULL,
        blocked_card_id varchar NOT NULL,
        created_at timestamp DEFAULT now()
      )`,
      `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_task_parent_id varchar`,
      `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimation_hours integer`,
      `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0`,
      // Módulo Diagramas/Fluxogramas (feat-modulo-diagramas)
      `CREATE TABLE IF NOT EXISTS flowcharts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar,
        title text NOT NULL,
        description text,
        owner_id varchar NOT NULL,
        visibility text NOT NULL DEFAULT 'private',
        nodes_data text,
        edges_data text,
        viewport text,
        permissions text,
        is_template boolean DEFAULT false,
        template_category text,
        thumbnail text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS flowchart_versions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar,
        flowchart_id varchar NOT NULL,
        nodes_data text,
        edges_data text,
        viewport text,
        created_by varchar NOT NULL,
        version_label text,
        created_at timestamp DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS flowchart_comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar,
        flowchart_id varchar NOT NULL,
        author_id varchar NOT NULL,
        content text NOT NULL,
        parent_comment_id varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )`,
      // Tabela de comentários do Kanban
      `CREATE TABLE IF NOT EXISTS kanban_comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar,
        card_id varchar NOT NULL,
        user_id varchar NOT NULL,
        content text NOT NULL,
        created_at timestamp DEFAULT now()
      )`,
      // Migration 0013: Status independente no kanban_cards
      `ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo'`,
    ];
    let applied = 0;
    let skipped = 0;
    for (const sql of migrations) {
      try {
        await pool.query(sql);
        applied++;
      } catch (err: any) {
        skipped++;
        console.warn(`[migration] Skipped: ${sql.substring(0, 80)}... → ${err.message}`);
      }
    }
    console.log(`[migration] Schema check complete. Applied: ${applied}, Skipped: ${skipped}`);
  } catch (error: any) {
    console.error('[migration] Error:', error.message);
  }
}

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

import { sanitizeRichText } from "./lib/sanitize-rich-text";

const RICH_TEXT_FIELDS = ["descricao", "description", "content", "comentario", "message", "texto"] as const;

app.use((req, _res, next) => {
  if ((req.method === "POST" || req.method === "PATCH" || req.method === "PUT") && req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    for (const key of RICH_TEXT_FIELDS) {
      const v = (req.body as any)[key];
      if (typeof v === "string" && v.length > 0) {
        (req.body as any)[key] = sanitizeRichText(v);
      }
    }
  }
  next();
});

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
    || "https://rdoratioto-pitzi.github.io/pitzi-home-chamado";
  const ticketUrl = `${baseUrl}/chamados?id=${code}`;
  
  res.json({
    code,
    url: ticketUrl,
    env: {
      APP_URL: process.env.APP_URL || "(não definido)",
      REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN || "(não definido)",
      resolvedBaseUrl: baseUrl
    },
    expectedFormat: "https://rdoratioto-pitzi.github.io/pitzi-home-chamado/chamados?id=CHA-XXXX",
    isCorrect: ticketUrl.includes("?id=")
  });
});

// ============== ROTA DE TESTE PÚBLICA OMIE (TEMPORÁRIA) ==============
// Teste direto no banco de dados - apenas para debug
app.get("/api/omie-debug/config", async (req, res) => {
  try {
    console.log('[OMIE DEBUG] Direct DB query test');
    
    const configCheck = await pool?.query('SELECT * FROM omie_config LIMIT 1');
    
    if (!configCheck?.rows || configCheck.rows.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }
    
    // Retornar no formato esperado pelo frontend
    res.json({
      success: true,
      data: {
        app_key: configCheck.rows[0].app_key || '',
        app_secret: configCheck.rows[0].app_secret || '',
        is_active: configCheck.rows[0].is_active || false
      }
    });
  } catch (error: any) {
    console.error('[OMIE DEBUG] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Claude Code Usage (autenticado por secret, não por sessão) ──────────────
app.post("/api/git-analytics/claude-code-usage", async (req, res) => {
  try {
    const secret = process.env.CLAUDE_USAGE_SECRET;
    if (!secret || req.headers["x-claude-usage-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { z } = await import("zod");
    const { storage } = await import("./storage");

    const bodySchema = z.object({
      developerName:        z.string().min(1),
      reportDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      inputTokens:          z.number().int().min(0),
      outputTokens:         z.number().int().min(0),
      cacheCreationTokens:  z.number().int().min(0),
      cacheReadTokens:      z.number().int().min(0),
      totalTokens:          z.number().int().min(0),
      sourceMachine:        z.string().optional(),
    });

    const body = bodySchema.parse(req.body);
    const report = await storage.upsertClaudeCodeUsage(body);

    console.log(`[claude-usage] ${body.developerName} @ ${body.reportDate}: ${body.totalTokens.toLocaleString()} tokens`);
    res.json({ ok: true, report });
  } catch (error: any) {
    console.error("Claude Code usage report error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Protege tudo depois disso
app.use((req, res, next) => {
  try {
    requireAuth(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Compat: endpoint de versão disponível também no runtime Express.
app.get("/api/version", (req, res) => {
  const version = process.env.APP_VERSION || "dev";
  const parts = version.split("-");
  const commit = parts.length > 1 ? parts[parts.length - 1] : "local";
  const buildDate = parts.length > 1 ? parts.slice(0, -1).join("-") : "local";

  return res.json({
    version,
    commit,
    buildDate,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
  });
});

// Compat: fallback do dashboard de geração de estoque no runtime Express.
app.post("/api/estoques/dashboard/gerar-estoque", async (req, res) => {
  try {
    if (req.session?.isAdmin !== true) {
      return res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
    }

    const rawImeis = Array.isArray(req.body?.imeis)
      ? req.body.imeis
      : typeof req.body?.imeis === "string"
        ? req.body.imeis.split(/[\n,;\t\s]+/)
        : [];

    const cleanedImeis = rawImeis
      .map((item: unknown) => String(item ?? "").trim())
      .filter((item: string) => item.length > 0)
      .map((item: string) => item.replace(/\.0$/, ""));

    const imeis = Array.from(new Set(cleanedImeis));

    if (imeis.length === 0) {
      return res.status(400).json({ success: false, error: "Informe o campo 'imeis' (lista ou string)." });
    }

    const response = await fetch("https://dash.pitzi.com.br/api/dash_estoque/defeitos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer Renov123",
      },
      body: JSON.stringify({ imeis }),
    });

    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      const remoteError = (payload as any)?.error;
      return res.status(response.status).json({ success: false, error: remoteError || `Erro ${response.status} na API externa` });
    }

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.data)
        ? (payload as any).data
        : Array.isArray((payload as any)?.results)
          ? (payload as any).results
          : [];

    return res.json({ success: true, data: { rows, total: rows.length } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Erro interno ao gerar estoque" });
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
    // Test database connection on startup
    await testDatabaseConnection();
    
    // Auto-migrate schema (add missing columns)
    await autoMigrateSchema();
    
    // Fix Omie config on startup
    await fixOmieConfig();
    
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

    // Fallback de API: evita que /api/* sem rota caia no index.html do Vite.
    app.use("/api", (req: Request, res: Response) => {
      if (res.headersSent) return;
      return res.status(404).json({
        success: false,
        error: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
      });
    });

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

        // Pré-aquecer cache de posição de estoques em background (não bloqueia startup)
        import("./services/estoque-pos.service").then(({ getCachedPosEstoque }) => {
          getCachedPosEstoque().then((idx) => {
            log(`[EstoquePos] Cache pré-aquecido — ${idx.size} produtos`, "estoque-pos");
          }).catch((err: any) => {
            console.error("[EstoquePos] Falha no pré-aquecimento:", err.message);
          });
        }).catch(() => {});

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