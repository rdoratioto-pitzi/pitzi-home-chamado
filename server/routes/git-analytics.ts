import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { insertGitRepositorySchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

export function registerGitAnalyticsRoutes(router: Router) {
  // ============== GIT ANALYTICS API ==============

  // Repositories
  router.get("/api/git-analytics/repositories", requireAuth, async (req, res) => {
    try {
      const repositories = await storage.getGitRepositories();
      res.json(repositories);
    } catch (error: any) {
      console.error("Get git repositories error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/git-analytics/repositories/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const repository = await storage.getGitRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repositório não encontrado" });
      }
      res.json(repository);
    } catch (error: any) {
      console.error("Get git repository error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/api/git-analytics/repositories", requireAuth, async (req, res) => {
    try {
      const data = insertGitRepositorySchema.parse(req.body);
      const repository = await storage.createGitRepository(data);
      res.status(201).json(repository);
    } catch (error: any) {
      console.error("Create git repository error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.put("/api/git-analytics/repositories/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const updated = await storage.updateGitRepository(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Repositório não encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update git repository error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/api/git-analytics/repositories/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const deleted = await storage.deleteGitRepository(id);
      res.json({ success: deleted });
    } catch (error: any) {
      console.error("Delete git repository error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Commits
  router.get("/api/git-analytics/commits", requireAuth, async (req, res) => {
    try {
      const { repositoryId, authorName, commitType, branch, startDate, endDate, limit, offset } = req.query;
      
      const commits = await storage.getGitCommits({
        repositoryId: repositoryId as string,
        authorName: authorName as string,
        commitType: commitType as string,
        branch: branch as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      const total = await storage.countGitCommits({
        repositoryId: repositoryId as string,
        authorName: authorName as string,
        commitType: commitType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json({ commits, total });
    } catch (error: any) {
      console.error("Get git commits error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pull Requests
  router.get("/api/git-analytics/pull-requests", requireAuth, async (req, res) => {
    try {
      const { repositoryId, authorName, status, prType, startDate, endDate, limit, offset } = req.query;
      
      const pullRequests = await storage.getGitPullRequests({
        repositoryId: repositoryId as string,
        authorName: authorName as string,
        status: status as string,
        prType: prType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      const total = await storage.countGitPullRequests({
        repositoryId: repositoryId as string,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json({ pullRequests, total });
    } catch (error: any) {
      console.error("Get git pull requests error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Security Alerts
  router.get("/api/git-analytics/security-alerts", requireAuth, async (req, res) => {
    try {
      const { repositoryId, severity, status } = req.query;
      
      const alerts = await storage.getGitSecurityAlerts({
        repositoryId: repositoryId as string,
        severity: severity as string,
        status: status as string,
      });
      
      res.json(alerts);
    } catch (error: any) {
      console.error("Get git security alerts error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pending Branches (branches com commits à frente sem PR aberto)
  router.get("/api/git-analytics/pending-branches", requireAuth, async (req, res) => {
    try {
      const { repositoryId } = req.query;
      const branches = await storage.getPendingBranches(repositoryId as string);
      res.json(branches);
    } catch (error: any) {
      console.error("Get pending branches error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all branches
  router.get("/api/git-analytics/branches", requireAuth, async (req, res) => {
    try {
      const { repositoryId } = req.query;
      const branches = await storage.getGitBranches(repositoryId as string);
      res.json(branches);
    } catch (error: any) {
      console.error("Get branches error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stats (agregações para dashboard)
  router.get("/api/git-analytics/stats", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate, authorName } = req.query;
      
      const stats = await storage.getGitAnalyticsStats({
        repositoryId: repositoryId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        authorName: authorName as string,
      });
      
      res.json(stats);
    } catch (error: any) {
      console.error("Get git analytics stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Developer stats
  router.get("/api/git-analytics/developer-stats", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate, authorName } = req.query;
      
      const stats = await storage.getGitDeveloperStats({
        repositoryId: repositoryId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        authorName: authorName as string,
      });
      
      res.json(stats);
    } catch (error: any) {
      console.error("Get developer stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Volume by day (para gráficos)
  router.get("/api/git-analytics/commits-by-day", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate } = req.query;
      
      const data = await storage.getGitCommitsByDay({
        repositoryId: repositoryId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json(data);
    } catch (error: any) {
      console.error("Get commits by day error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/git-analytics/prs-by-day", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate } = req.query;
      
      const data = await storage.getGitPRsByDay({
        repositoryId: repositoryId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json(data);
    } catch (error: any) {
      console.error("Get PRs by day error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Volume by month
  router.get("/api/git-analytics/commits-by-month", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate } = req.query;
      
      const data = await storage.getGitCommitsByMonth({
        repositoryId: repositoryId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json(data);
    } catch (error: any) {
      console.error("Get commits by month error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/git-analytics/prs-by-month", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate } = req.query;
      
      const data = await storage.getGitPRsByMonth({
        repositoryId: repositoryId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.json(data);
    } catch (error: any) {
      console.error("Get PRs by month error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync (sincronização com GitHub)
  router.post("/api/git-analytics/sync", requireAuth, async (req, res) => {
    try {
      const repositoryId = req.body?.repositoryId || null;
      
      const { syncRepository, syncAllRepositories } = await import("../services/github-sync");
      
      if (repositoryId) {
        await syncRepository(repositoryId);
        res.json({ success: true, message: "Repositório sincronizado com sucesso" });
      } else {
        await syncAllRepositories();
        res.json({ success: true, message: "Todos os repositórios sincronizados com sucesso" });
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/api/git-analytics/sync-period", requireAuth, async (req, res) => {
    try {
      const { repositoryId, startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate e endDate são obrigatórios" });
      }

      const { syncRepositoryByPeriod, syncAllRepositories } = await import("../services/github-sync");
      
      if (repositoryId) {
        const result = await syncRepositoryByPeriod(repositoryId, new Date(startDate), new Date(endDate));
        res.json({ success: true, ...result });
      } else {
        // Sync all repositories for the period
        const repos = await storage.getGitRepositories();
        let totalCommits = 0;
        let totalPRs = 0;
        
        for (const repo of repos) {
          if (repo.syncEnabled) {
            const result = await syncRepositoryByPeriod(repo.id, new Date(startDate), new Date(endDate));
            totalCommits += result.commits;
            totalPRs += result.prs;
          }
        }
        
        res.json({ success: true, commits: totalCommits, prs: totalPRs });
      }
    } catch (error: any) {
      console.error("Sync period error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add repository (adiciona e sincroniza)
  router.post("/api/git-analytics/add-repository", requireAuth, async (req, res) => {
    try {
      const { fullName } = req.body;
      
      if (!fullName) {
        return res.status(400).json({ error: "fullName é obrigatório (ex: Renov-BD/Renov.Home)" });
      }
      
      const { addRepository } = await import("../services/github-sync");
      const repo = await addRepository(fullName);
      
      res.status(201).json(repo);
    } catch (error: any) {
      console.error("Add repository error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync status - endpoint de diagnóstico
  router.get("/api/git-analytics/sync-status", requireAuth, async (req, res) => {
    try {
      const hasToken = !!process.env.GITHUB_TOKEN;
      const repositories = await storage.getGitRepositories();
      
      // Contagem de registros por tabela
      const activeRepos = repositories.filter(r => r.isActive && r.syncEnabled);
      
      // Buscar último repositório sincronizado
      let lastSyncRepo = null;
      let lastSyncTime = null;
      
      for (const repo of repositories) {
        if (repo.lastSyncAt) {
          const syncTime = new Date(repo.lastSyncAt).getTime();
          if (!lastSyncTime || syncTime > lastSyncTime) {
            lastSyncTime = syncTime;
            lastSyncRepo = repo;
          }
        }
      }
      
      res.json({
        hasGitHubToken: hasToken,
        tokenPreview: hasToken ? `${process.env.GITHUB_TOKEN?.substring(0, 8)}...` : null,
        totalRepositories: repositories.length,
        activeRepositories: activeRepos.length,
        lastSync: lastSyncRepo ? {
          repository: lastSyncRepo.fullName,
          lastSyncAt: lastSyncRepo.lastSyncAt,
        } : null,
        environment: process.env.NODE_ENV || 'development',
      });
    } catch (error: any) {
      console.error("Get sync status error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
