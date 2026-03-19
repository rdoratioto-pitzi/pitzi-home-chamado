// worker/src/routes/git-analytics.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { verifyGitHubWebhookSignature } from "../lib/github-webhook";
import {
  syncRepository,
  syncAllRepositories,
  syncRepositoryByPeriod,
  addRepository,
} from "../services/github-sync";
import { insertGitRepositorySchema } from "@shared/schema";

const gitAnalytics = new Hono<AppEnv>();

// Helper to build GitSyncDeps from Hono context
function getSyncDeps(c: any) {
  return {
    storage: getStorage(c.get("db")),
    githubToken: c.env.GITHUB_TOKEN,
  };
}

// ============== REPOSITORIES ==============

gitAnalytics.get("/api/git-analytics/repositories", async (c) => {
  const storage = getStorage(c.get("db"));
  return c.json(await storage.getGitRepositories());
});

gitAnalytics.get("/api/git-analytics/repositories/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const repo = await storage.getGitRepository(c.req.param("id"));
  if (!repo) return c.json({ error: "Repositório não encontrado" }, 404);
  return c.json(repo);
});

gitAnalytics.post("/api/git-analytics/repositories", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const data = insertGitRepositorySchema.parse(body);
  const repo = await storage.createGitRepository(data);
  return c.json(repo, 201);
});

gitAnalytics.put("/api/git-analytics/repositories/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const updated = await storage.updateGitRepository(c.req.param("id"), body);
  if (!updated) return c.json({ error: "Repositório não encontrado" }, 404);
  return c.json(updated);
});

gitAnalytics.delete("/api/git-analytics/repositories/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteGitRepository(c.req.param("id"));
  return c.json({ success: deleted });
});

// ============== COMMITS ==============

gitAnalytics.get("/api/git-analytics/commits", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, authorName, commitType, branch, startDate, endDate, limit, offset } = c.req.query() as Record<string, string>;

  const commits = await storage.getGitCommits({
    repositoryId,
    authorName,
    commitType,
    branch,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
  });
  const total = await storage.countGitCommits({
    repositoryId,
    authorName,
    commitType,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  return c.json({ commits, total });
});

// ============== PULL REQUESTS ==============

gitAnalytics.get("/api/git-analytics/pull-requests", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, authorName, status, prType, startDate, endDate, limit, offset } = c.req.query() as Record<string, string>;

  const pullRequests = await storage.getGitPullRequests({
    repositoryId,
    authorName,
    status,
    prType,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
  });
  const total = await storage.countGitPullRequests({
    repositoryId,
    status,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  return c.json({ pullRequests, total });
});

// ============== SECURITY ALERTS ==============

gitAnalytics.get("/api/git-analytics/security-alerts", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, severity, status } = c.req.query() as Record<string, string>;
  const alerts = await storage.getGitSecurityAlerts({ repositoryId, severity, status });
  return c.json(alerts);
});

// ============== BRANCHES ==============

gitAnalytics.get("/api/git-analytics/pending-branches", async (c) => {
  const storage = getStorage(c.get("db"));
  const repositoryId = c.req.query("repositoryId");
  return c.json(await storage.getPendingBranches(repositoryId as string));
});

gitAnalytics.get("/api/git-analytics/branches", async (c) => {
  const storage = getStorage(c.get("db"));
  const repositoryId = c.req.query("repositoryId");
  return c.json(await storage.getGitBranches(repositoryId as string));
});

// ============== STATS & CHARTS ==============

gitAnalytics.get("/api/git-analytics/stats", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate, authorName } = c.req.query() as Record<string, string>;
  const stats = await storage.getGitAnalyticsStats({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    authorName,
  });
  return c.json(stats);
});

gitAnalytics.get("/api/git-analytics/developer-stats", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate, authorName } = c.req.query() as Record<string, string>;
  const stats = await storage.getGitDeveloperStats({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    authorName,
  });
  return c.json(stats);
});

gitAnalytics.get("/api/git-analytics/commits-by-day", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitCommitsByDay({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

gitAnalytics.get("/api/git-analytics/prs-by-day", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitPRsByDay({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

gitAnalytics.get("/api/git-analytics/commits-by-month", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitCommitsByMonth({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

gitAnalytics.get("/api/git-analytics/prs-by-month", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitPRsByMonth({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

// ============== DEVELOPER TOKENS (OpenRouter + Claude Code) ==============

gitAnalytics.get("/api/git-analytics/developer-tokens", async (c) => {
  const storage = getStorage(c.get("db"));
  const { startDate: startDateStr, endDate: endDateStr } = c.req.query() as Record<string, string>;

  const now = new Date();
  const startDate = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endDateStr ? new Date(endDateStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Import pure data module
  const { DEVELOPER_KEYS, getAllDevelopers } = await import("../../../server/config/openrouter-keys");

  // Claude Code usage from DB
  const claudeRows = await storage.getClaudeCodeUsageByPeriod(startDate, endDate);
  const claudeByDev: Record<string, { tokens: number; spend: number; keysCount: number }> = {};
  for (const row of claudeRows) {
    if (!claudeByDev[row.developerName]) {
      claudeByDev[row.developerName] = { tokens: 0, spend: 0, keysCount: 1 };
    }
    claudeByDev[row.developerName].tokens += row.totalTokens;
    claudeByDev[row.developerName].spend += (row.totalTokens / 1_000_000) * 9;
  }

  const allDevelopers = Array.from(
    new Set([...getAllDevelopers(), ...Object.keys(claudeByDev)])
  );

  const tokenUsage = await Promise.all(
    allDevelopers.map(async (developerName) => {
      const orKeys = DEVELOPER_KEYS[developerName] || [];
      let openrouterTokens = 0;
      let openrouterSpend = 0;
      let openrouterRequests = 0;

      for (const key of orKeys) {
        try {
          const statsResponse = await fetch("https://openrouter.ai/api/v1/auth/key", {
            headers: { Authorization: `Bearer ${key.apiKey}` },
          });
          if (statsResponse.ok) {
            const statsData = await statsResponse.json() as any;
            const usageMonthly = statsData.data?.usage_monthly || 0;
            openrouterTokens += Math.round(usageMonthly * 1000000);
            openrouterSpend += usageMonthly;
            openrouterRequests += 1;
          }
        } catch (error) {
          console.error(`Error fetching OpenRouter usage for ${key.keyName}:`, error);
        }
      }

      const claude = claudeByDev[developerName] || { tokens: 0, spend: 0, keysCount: 0 };
      return {
        developerName,
        totalTokens: openrouterTokens + claude.tokens,
        totalRequests: openrouterRequests + (claude.tokens > 0 ? 1 : 0),
        totalSpend: openrouterSpend + claude.spend,
        keysCount: orKeys.length + claude.keysCount,
        openrouterTokens,
        openrouterSpend,
        openrouterKeysCount: orKeys.length,
        anthropicTokens: claude.tokens,
        anthropicSpend: claude.spend,
        anthropicKeysCount: claude.keysCount,
      };
    })
  );

  return c.json(tokenUsage.sort((a, b) => b.totalTokens - a.totalTokens));
});

// ============== SYNC ==============

gitAnalytics.post("/api/git-analytics/sync", async (c) => {
  const deps = getSyncDeps(c);
  const body = await c.req.json();
  const repositoryId = body?.repositoryId || null;

  if (repositoryId) {
    await syncRepository(deps, repositoryId);
    return c.json({ success: true, message: "Repositório sincronizado com sucesso" });
  }
  await syncAllRepositories(deps);
  return c.json({ success: true, message: "Todos os repositórios sincronizados com sucesso" });
});

gitAnalytics.post("/api/git-analytics/sync-period", async (c) => {
  const deps = getSyncDeps(c);
  const { repositoryId, startDate, endDate } = await c.req.json();

  if (!startDate || !endDate) {
    return c.json({ error: "startDate e endDate são obrigatórios" }, 400);
  }

  if (repositoryId) {
    const result = await syncRepositoryByPeriod(deps, repositoryId, new Date(startDate), new Date(endDate));
    return c.json({ success: true, ...result });
  }

  const storage = getStorage(c.get("db"));
  const repos = await storage.getGitRepositories();
  let totalCommits = 0;
  let totalPRs = 0;
  for (const repo of repos) {
    if (repo.syncEnabled) {
      const result = await syncRepositoryByPeriod(deps, repo.id, new Date(startDate), new Date(endDate));
      totalCommits += result.commits;
      totalPRs += result.prs;
    }
  }
  return c.json({ success: true, commits: totalCommits, prs: totalPRs });
});

gitAnalytics.post("/api/git-analytics/add-repository", async (c) => {
  const deps = getSyncDeps(c);
  const { fullName } = await c.req.json();
  if (!fullName) {
    return c.json({ error: "fullName é obrigatório (ex: Renov-BD/Renov.Home)" }, 400);
  }
  const repo = await addRepository(deps, fullName);
  return c.json(repo, 201);
});

// ============== SYNC STATUS ==============

gitAnalytics.get("/api/git-analytics/sync-status", async (c) => {
  const storage = getStorage(c.get("db"));
  const hasToken = !!c.env.GITHUB_TOKEN;
  const repositories = await storage.getGitRepositories();
  const activeRepos = repositories.filter((r) => r.isActive && r.syncEnabled);

  let lastSyncRepo = null as any;
  let lastSyncTime = null as number | null;
  for (const repo of repositories) {
    if (repo.lastSyncAt) {
      const syncTime = new Date(repo.lastSyncAt).getTime();
      if (!lastSyncTime || syncTime > lastSyncTime) {
        lastSyncTime = syncTime;
        lastSyncRepo = repo;
      }
    }
  }

  return c.json({
    hasGitHubToken: hasToken,
    tokenPreview: hasToken ? `${c.env.GITHUB_TOKEN.substring(0, 8)}...` : null,
    totalRepositories: repositories.length,
    activeRepositories: activeRepos.length,
    lastSync: lastSyncRepo
      ? { repository: lastSyncRepo.fullName, lastSyncAt: lastSyncRepo.lastSyncAt }
      : null,
    environment: "production",
  });
});

// ============== CLAUDE CODE USAGE (secret auth — handled by middleware) ==============

gitAnalytics.post("/api/git-analytics/claude-code-usage", async (c) => {
  const storage = getStorage(c.get("db"));
  const bodySchema = z.object({
    developerName: z.string().min(1),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cacheCreationTokens: z.number().int().min(0),
    cacheReadTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
    sourceMachine: z.string().optional(),
  });

  const body = bodySchema.parse(await c.req.json());
  const report = await storage.upsertClaudeCodeUsage(body);
  console.log(`[claude-usage] ${body.developerName} @ ${body.reportDate}: ${body.totalTokens.toLocaleString()} tokens`);
  return c.json({ ok: true, report });
});

// ============== GITHUB WEBHOOK (public — signature validated in-route) ==============

gitAnalytics.post("/api/git-analytics/github-webhook", async (c) => {
  const signature = c.req.header("X-Hub-Signature-256") || "";
  const rawBody = await c.req.text();

  const webhookSecret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const isValid = await verifyGitHubWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = c.req.header("X-GitHub-Event");
  const payload = JSON.parse(rawBody);

  if (event === "push") {
    const fullName = payload.repository?.full_name;
    if (fullName) {
      const deps = getSyncDeps(c);
      const storage = getStorage(c.get("db"));
      const repo = await storage.getGitRepositoryByFullName(fullName);
      if (repo && repo.syncEnabled) {
        // Use waitUntil to keep worker alive during sync
        c.executionCtx.waitUntil(
          syncRepository(deps, repo.id).catch((err) =>
            console.error(`[Webhook] Sync failed for ${fullName}:`, err)
          )
        );
      }
    }
  }

  return c.json({ ok: true, event });
});

export { gitAnalytics };
