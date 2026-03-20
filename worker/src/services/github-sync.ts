// worker/src/services/github-sync.ts
import type { IStorage } from "../lib/storage";

export interface GitSyncDeps {
  storage: IStorage;
  githubToken: string;
}

const GITHUB_API = "https://api.github.com";

function detectCommitType(message: string): string {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.startsWith("feat") || lowerMessage.includes("feature")) return "feature";
  if (lowerMessage.startsWith("fix") || lowerMessage.includes("bugfix") || lowerMessage.includes("hotfix")) return "bugfix";
  if (lowerMessage.startsWith("docs") || lowerMessage.includes("documentation")) return "docs";
  if (lowerMessage.startsWith("refactor")) return "refactor";
  if (lowerMessage.startsWith("security") || lowerMessage.includes("vulnerab") || lowerMessage.includes("cve")) return "security";
  if (lowerMessage.startsWith("style") || lowerMessage.startsWith("chore") || lowerMessage.startsWith("perf") || lowerMessage.startsWith("improvement")) return "improvement";
  return "improvement";
}

async function githubFetch(endpoint: string, githubToken: string): Promise<any> {
  if (!githubToken) throw new Error("GITHUB_TOKEN não configurado");

  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Renov-Home-App",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  return response.json();
}

async function fetchCommitDetails(
  fullName: string,
  sha: string,
  githubToken: string
): Promise<{ filesChanged: number; additions: number; deletions: number }> {
  try {
    const details = await githubFetch(`/repos/${fullName}/commits/${sha}`, githubToken);
    const stats = details.stats || {};
    if (details.files && Array.isArray(details.files) && !stats.additions && !stats.deletions) {
      let additions = 0;
      let deletions = 0;
      for (const file of details.files) {
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
      return { filesChanged: details.files.length, additions, deletions };
    }
    return {
      filesChanged: stats.total || 0,
      additions: stats.additions || 0,
      deletions: stats.deletions || 0,
    };
  } catch (error) {
    console.error(`[GitSync] Error fetching commit details for ${sha}:`, error);
    return { filesChanged: 0, additions: 0, deletions: 0 };
  }
}

async function fetchPRDetails(
  fullName: string,
  prNumber: number,
  githubToken: string
): Promise<{ commitsCount: number; additions: number; deletions: number }> {
  try {
    const files = await githubFetch(`/repos/${fullName}/pulls/${prNumber}/files?per_page=100`, githubToken);
    const commits = await githubFetch(`/repos/${fullName}/pulls/${prNumber}/commits?per_page=100`, githubToken);
    let additions = 0;
    let deletions = 0;
    if (Array.isArray(files)) {
      for (const file of files) {
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
    }
    return { commitsCount: Array.isArray(commits) ? commits.length : 0, additions, deletions };
  } catch (error) {
    console.error(`[GitSync] Error fetching PR details for #${prNumber}:`, error);
    return { commitsCount: 0, additions: 0, deletions: 0 };
  }
}

async function syncCommits(
  deps: GitSyncDeps,
  repositoryId: string,
  fullName: string,
  since?: Date,
  until?: Date
): Promise<number> {
  console.log(`Syncing commits for ${fullName}...`);
  // Worker limit: max 50 subrequests per invocation
  // Fetch only 1 page of 15 commits, skip individual detail fetches
  const perPage = 15;
  let url = `/repos/${fullName}/commits?per_page=${perPage}&page=1`;
  if (since) url += `&since=${since.toISOString()}`;
  if (until) url += `&until=${until.toISOString()}`;
  const allCommits = await githubFetch(url, deps.githubToken);

  if (!Array.isArray(allCommits) || allCommits.length === 0) return 0;

  const commitDataList = allCommits.map((commit: any) => ({
    tenantId: null,
    repositoryId,
    sha: commit.sha,
    message: commit.commit.message.split("\n")[0].substring(0, 255),
    fullMessage: commit.commit.message,
    authorName: commit.commit.author?.name || commit.author?.login || "Unknown",
    authorEmail: commit.commit.author?.email || null,
    authorAvatarUrl: commit.author?.avatar_url || null,
    commitType: detectCommitType(commit.commit.message),
    branch: null,
    prNumber: null,
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    committedAt: new Date(commit.commit.author?.date || new Date()),
  }));

  return deps.storage.createGitCommitsBatch(commitDataList);
}

async function syncPullRequests(deps: GitSyncDeps, repositoryId: string, fullName: string): Promise<number> {
  try {
    // Worker limit: fetch limited PRs, skip individual detail fetches
    const [openPRs, closedPRs] = await Promise.all([
      githubFetch(`/repos/${fullName}/pulls?state=open&per_page=5`, deps.githubToken),
      githubFetch(`/repos/${fullName}/pulls?state=closed&per_page=5&sort=updated&direction=desc`, deps.githubToken),
    ]);
    const allPRs = [...openPRs, ...closedPRs];
    let upserted = 0;
    for (const pr of allPRs) {
      const status = pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open";
      await deps.storage.upsertGitPullRequest({
        repositoryId,
        githubPrNumber: pr.number,
        title: pr.title,
        description: pr.body || "",
        authorName: pr.user?.login || "Unknown",
        authorAvatarUrl: pr.user?.avatar_url || null,
        status,
        prType: detectCommitType(pr.title),
        sourceBranch: pr.head?.ref || "",
        targetBranch: pr.base?.ref || "",
        commitsCount: pr.commits || 0,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        reviewers: JSON.stringify(pr.requested_reviewers?.map((r: any) => r.login) || []),
        labels: JSON.stringify(pr.labels?.map((l: any) => l.name) || []),
        createdAt: pr.created_at ? new Date(pr.created_at) : null,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      });
      upserted++;
    }
    return upserted;
  } catch (error) {
    console.error(`[GitSync] Error syncing PRs:`, error);
    return 0;
  }
}

async function syncSecurityAlerts(deps: GitSyncDeps, repositoryId: string, fullName: string): Promise<number> {
  try {
    const alerts = await githubFetch(`/repos/${fullName}/dependabot/alerts?state=open&per_page=100`, deps.githubToken);
    let upserted = 0;
    for (const alert of alerts) {
      await deps.storage.upsertGitSecurityAlert({
        repositoryId,
        githubAlertNumber: alert.number,
        title: alert.security_advisory?.summary || "Unknown vulnerability",
        description: alert.security_advisory?.description || "",
        severity: alert.security_advisory?.severity || "medium",
        packageName: alert.security_vulnerability?.package?.name || "unknown",
        packageEcosystem: alert.security_vulnerability?.package?.ecosystem || "",
        vulnerableVersion: alert.security_vulnerability?.vulnerable_version_range || "",
        patchedVersion: alert.security_vulnerability?.first_patched_version?.identifier || null,
        status: alert.state === "dismissed" ? "dismissed" : alert.fixed_at ? "fixed" : "open",
        isDirectDependency: alert.dependency?.scope === "runtime",
        cveId: alert.security_advisory?.cve_id || null,
        ghsaId: alert.security_advisory?.ghsa_id || null,
        createdAt: alert.created_at ? new Date(alert.created_at) : null,
        dismissedAt: alert.dismissed_at ? new Date(alert.dismissed_at) : null,
        fixedAt: alert.fixed_at ? new Date(alert.fixed_at) : null,
      });
      upserted++;
    }
    return upserted;
  } catch (error) {
    console.log(`[GitSync] Could not fetch security alerts (may not be enabled)`);
    return 0;
  }
}

async function syncBranches(deps: GitSyncDeps, repositoryId: string, fullName: string): Promise<number> {
  // Worker limit: fetch branches list only, skip per-branch comparisons
  const branchesData = await githubFetch(`/repos/${fullName}/branches?per_page=10`, deps.githubToken);
  if (!Array.isArray(branchesData)) return 0;

  const repoInfo = await githubFetch(`/repos/${fullName}`, deps.githubToken);
  const defaultBranch = repoInfo.default_branch || "main";

  let synced = 0;
  for (const branch of branchesData) {
    try {
      await deps.storage.upsertGitBranch({
        tenantId: null,
        repositoryId,
        name: branch.name,
        sha: branch.commit.sha,
        isDefault: branch.name === defaultBranch,
        isProtected: branch.protected || false,
        aheadBy: 0,
        behindBy: 0,
        hasOpenPR: false,
        lastCommitAt: null,
        lastCommitAuthor: null,
      });
      synced++;
    } catch (error) {
      console.error(`[GitSync] Error syncing branch ${branch.name}:`, error);
    }
  }
  return synced;
}

// ============== EXPORTED FUNCTIONS ==============

export async function syncRepository(deps: GitSyncDeps, repositoryId: string): Promise<void> {
  const repo = await deps.storage.getGitRepository(repositoryId);
  if (!repo) throw new Error(`Repository ${repositoryId} not found`);
  if (!repo.syncEnabled) {
    console.log(`[GitSync] Sync disabled for ${repo.fullName}`);
    return;
  }

  let since: Date | undefined;
  if (repo.lastSyncAt) {
    since = new Date(repo.lastSyncAt);
  } else {
    since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }

  // Serialize to stay within Worker subrequest limits
  await syncCommits(deps, repositoryId, repo.fullName, since);
  await syncPullRequests(deps, repositoryId, repo.fullName);
  await syncBranches(deps, repositoryId, repo.fullName);

  await deps.storage.updateGitRepository(repositoryId, { lastSyncAt: new Date() });
}

export async function syncAllRepositories(deps: GitSyncDeps): Promise<void> {
  const repositories = await deps.storage.getGitRepositories();
  const activeRepos = repositories.filter((r) => r.isActive && r.syncEnabled);
  for (const repo of activeRepos) {
    try {
      await syncRepository(deps, repo.id);
    } catch (error) {
      console.error(`[GitSync] Error syncing ${repo.fullName}:`, error);
    }
  }
}

export async function syncRepositoryByPeriod(
  deps: GitSyncDeps,
  repositoryId: string,
  startDate: Date,
  endDate: Date
): Promise<{ commits: number; prs: number }> {
  const repo = await deps.storage.getGitRepository(repositoryId);
  if (!repo) throw new Error("Repository not found");

  const commits = await syncCommits(deps, repositoryId, repo.fullName, startDate, endDate);
  const prs = await syncPullRequests(deps, repositoryId, repo.fullName);
  await deps.storage.updateGitRepository(repositoryId, { lastSyncAt: new Date() });
  return { commits, prs };
}

export async function addRepository(deps: GitSyncDeps, fullName: string): Promise<any> {
  const repoInfo = await githubFetch(`/repos/${fullName}`, deps.githubToken);
  const existing = await deps.storage.getGitRepositoryByFullName(fullName);
  if (existing) return existing;

  const repo = await deps.storage.createGitRepository({
    githubId: repoInfo.id,
    name: repoInfo.name,
    fullName: repoInfo.full_name,
    owner: repoInfo.owner.login,
    defaultBranch: repoInfo.default_branch || "main",
    isActive: true,
    syncEnabled: true,
  });

  await syncRepository(deps, repo.id);
  return repo;
}
