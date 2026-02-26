import { storage } from "../storage";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API = "https://api.github.com";

// Detecta o tipo do commit baseado na mensagem
function detectCommitType(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.startsWith('feat') || lowerMessage.includes('feature')) {
    return 'feature';
  }
  if (lowerMessage.startsWith('fix') || lowerMessage.includes('bugfix') || lowerMessage.includes('hotfix')) {
    return 'bugfix';
  }
  if (lowerMessage.startsWith('docs') || lowerMessage.includes('documentation')) {
    return 'docs';
  }
  if (lowerMessage.startsWith('refactor')) {
    return 'refactor';
  }
  if (lowerMessage.startsWith('security') || lowerMessage.includes('vulnerab') || lowerMessage.includes('cve')) {
    return 'security';
  }
  if (lowerMessage.startsWith('style') || lowerMessage.startsWith('chore') || lowerMessage.startsWith('perf') || lowerMessage.startsWith('improvement')) {
    return 'improvement';
  }
  
  return 'improvement';
}

// Faz requisição para a API do GitHub
async function githubFetch(endpoint: string): Promise<any> {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN não configurado");
  }
  
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Renov-Home-App'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// Busca detalhes de um commit específico (para obter statistics)
async function fetchCommitDetails(fullName: string, sha: string): Promise<{ filesChanged: number; additions: number; deletions: number }> {
  try {
    const details = await githubFetch(`/repos/${fullName}/commits/${sha}`);
    // A API retorna 'stats' campo que pode ter { additions, deletions, total }
    // ou pode vir em 'files' para calcular manualmente
    const stats = details.stats || {};
    
    // Se stats não estiver disponível, calcular a partir dos arquivos
    if (details.files && Array.isArray(details.files) && (!stats.additions && !stats.deletions)) {
      let additions = 0;
      let deletions = 0;
      for (const file of details.files) {
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
      return {
        filesChanged: details.files.length,
        additions,
        deletions
      };
    }
    
    return {
      filesChanged: stats.total || 0,
      additions: stats.additions || 0,
      deletions: stats.deletions || 0
    };
  } catch (error) {
    console.error(`[GitSync] Error fetching commit details for ${sha}:`, error);
    return { filesChanged: 0, additions: 0, deletions: 0 };
  }
}

// Busca detalhes de um PR específico (para obter contagem de commits)
async function fetchPRDetails(fullName: string, prNumber: number): Promise<{ commitsCount: number; additions: number; deletions: number }> {
  try {
    // Buscar arquivos do PR para calcular adições e deleções
    const files = await githubFetch(`/repos/${fullName}/pulls/${prNumber}/files?per_page=100`);
    
    // Buscar commits do PR para contar
    const commits = await githubFetch(`/repos/${fullName}/pulls/${prNumber}/commits?per_page=100`);
    
    // Calcular adições e deleções a partir dos arquivos
    let additions = 0;
    let deletions = 0;
    
    if (Array.isArray(files)) {
      for (const file of files) {
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
    }
    
    return {
      commitsCount: Array.isArray(commits) ? commits.length : 0,
      additions,
      deletions
    };
  } catch (error) {
    console.error(`[GitSync] Error fetching PR details for #${prNumber}:`, error);
    return { commitsCount: 0, additions: 0, deletions: 0 };
  }
}

async function syncCommits(repositoryId: string, fullName: string, since?: Date, until?: Date): Promise<number> {
  console.log(`Syncing commits for ${fullName}...`);
  
  let allCommits: any[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    let url = `/repos/${fullName}/commits?per_page=${perPage}&page=${page}`;
    if (since) url += `&since=${since.toISOString()}`;
    if (until) url += `&until=${until.toISOString()}`;

    const commitsPage = await githubFetch(url);
    
    if (!Array.isArray(commitsPage) || commitsPage.length === 0) {
      hasMore = false;
      break;
    }

    allCommits = allCommits.concat(commitsPage);
    console.log(`Fetched page ${page}: ${commitsPage.length} commits (total: ${allCommits.length})`);

    if (commitsPage.length < perPage) {
      hasMore = false;
    } else {
      page++;
      if (allCommits.length >= 5000) {
        console.log("Reached 5000 commits limit, stopping pagination");
        hasMore = false;
      }
    }
  }

  if (allCommits.length === 0) {
    console.log("No commits found");
    return 0;
  }

  console.log(`Total commits fetched: ${allCommits.length}`);

  // Buscar detalhes de cada commit para obter statistics (em lotes para não sobrecarregar a API)
  const commitDataList = [];
  const batchSize = 10;
  
  for (let i = 0; i < allCommits.length; i += batchSize) {
    const batch = allCommits.slice(i, i + batchSize);
    const batchWithStats = await Promise.all(
      batch.map(async (commit: any) => {
        // Buscar detalhes apenas para commits que ainda não têm dados
        const stats = await fetchCommitDetails(fullName, commit.sha);
        return {
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
          filesChanged: stats.filesChanged,
          additions: stats.additions,
          deletions: stats.deletions,
          committedAt: new Date(commit.commit.author?.date || new Date()),
        };
      })
    );
    commitDataList.push(...batchWithStats);
    console.log(`Processed ${Math.min(i + batchSize, allCommits.length)}/${allCommits.length} commits with stats`);
  }

  const inserted = await storage.createGitCommitsBatch(commitDataList);
  console.log(`Synced ${inserted} new commits`);
  return inserted;
}

export async function syncRepositoryByPeriod(repositoryId: string, startDate: Date, endDate: Date): Promise<{ commits: number; prs: number }> {
  const repo = await storage.getGitRepository(repositoryId);
  if (!repo) {
    throw new Error("Repository not found");
  }

  console.log(`Syncing ${repo.fullName} for period ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const commits = await syncCommits(repositoryId, repo.fullName, startDate, endDate);
  const prs = await syncPullRequests(repositoryId, repo.fullName);

  await storage.updateGitRepository(repositoryId, { lastSyncAt: new Date() });
  
  console.log(`Period sync completed: ${commits} commits, ${prs} PRs`);
  return { commits, prs };
}

// Sincroniza PRs de um repositório
async function syncPullRequests(repositoryId: string, fullName: string): Promise<number> {
  console.log(`[GitSync] Syncing PRs for ${fullName}...`);
  
  try {
    const [openPRs, closedPRs] = await Promise.all([
      githubFetch(`/repos/${fullName}/pulls?state=open&per_page=100`),
      githubFetch(`/repos/${fullName}/pulls?state=closed&per_page=50&sort=updated&direction=desc`),
    ]);
    
    const allPRs = [...openPRs, ...closedPRs];
    console.log(`[GitSync] Found ${allPRs.length} PRs`);
    
    let upserted = 0;
    for (const pr of allPRs) {
      const status = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';
      
      // Buscar detalhes do PR para obter contagem de commits e linhas
      const prDetails = await fetchPRDetails(fullName, pr.number);
      
      await storage.upsertGitPullRequest({
        repositoryId,
        githubPrNumber: pr.number,
        title: pr.title,
        description: pr.body || '',
        authorName: pr.user?.login || 'Unknown',
        authorAvatarUrl: pr.user?.avatar_url || null,
        status,
        prType: detectCommitType(pr.title),
        sourceBranch: pr.head?.ref || '',
        targetBranch: pr.base?.ref || '',
        commitsCount: prDetails.commitsCount,
        additions: prDetails.additions,
        deletions: prDetails.deletions,
        reviewers: JSON.stringify(pr.requested_reviewers?.map((r: any) => r.login) || []),
        labels: JSON.stringify(pr.labels?.map((l: any) => l.name) || []),
        createdAt: pr.created_at ? new Date(pr.created_at) : null,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      });
      upserted++;
    }
    
    console.log(`[GitSync] Upserted ${upserted} PRs`);
    return upserted;
  } catch (error) {
    console.error(`[GitSync] Error syncing PRs:`, error);
    return 0;
  }
}

// Sincroniza alertas de segurança (Dependabot)
async function syncSecurityAlerts(repositoryId: string, fullName: string): Promise<number> {
  console.log(`[GitSync] Syncing security alerts for ${fullName}...`);
  
  try {
    const alerts = await githubFetch(`/repos/${fullName}/dependabot/alerts?state=open&per_page=100`);
    console.log(`[GitSync] Found ${alerts.length} security alerts`);
    
    let upserted = 0;
    for (const alert of alerts) {
      await storage.upsertGitSecurityAlert({
        repositoryId,
        githubAlertNumber: alert.number,
        title: alert.security_advisory?.summary || 'Unknown vulnerability',
        description: alert.security_advisory?.description || '',
        severity: alert.security_advisory?.severity || 'medium',
        packageName: alert.security_vulnerability?.package?.name || 'unknown',
        packageEcosystem: alert.security_vulnerability?.package?.ecosystem || '',
        vulnerableVersion: alert.security_vulnerability?.vulnerable_version_range || '',
        patchedVersion: alert.security_vulnerability?.first_patched_version?.identifier || null,
        status: alert.state === 'dismissed' ? 'dismissed' : alert.fixed_at ? 'fixed' : 'open',
        isDirectDependency: alert.dependency?.scope === 'runtime',
        cveId: alert.security_advisory?.cve_id || null,
        ghsaId: alert.security_advisory?.ghsa_id || null,
        createdAt: alert.created_at ? new Date(alert.created_at) : null,
        dismissedAt: alert.dismissed_at ? new Date(alert.dismissed_at) : null,
        fixedAt: alert.fixed_at ? new Date(alert.fixed_at) : null,
      });
      upserted++;
    }
    
    console.log(`[GitSync] Upserted ${upserted} security alerts`);
    return upserted;
  } catch (error) {
    // Dependabot alerts podem não estar disponíveis
    console.log(`[GitSync] Could not fetch security alerts (may not be enabled)`);
    return 0;
  }
}

// Sincroniza branches de um repositório
async function syncBranches(repositoryId: string, fullName: string): Promise<number> {
  console.log(`[GitSync] Syncing branches for ${fullName}...`);
  
  const branchesData = await githubFetch(`/repos/${fullName}/branches?per_page=100`);
  
  if (!Array.isArray(branchesData)) {
    console.log("[GitSync] No branches found or error fetching branches");
    return 0;
  }

  // Buscar PRs abertos para verificar quais branches têm PR
  const openPRs = await githubFetch(`/repos/${fullName}/pulls?state=open&per_page=100`);
  const branchesWithPR = new Set(openPRs.map((pr: any) => pr.head.ref));

  // Buscar branch default
  const repoInfo = await githubFetch(`/repos/${fullName}`);
  const defaultBranch = repoInfo.default_branch || "main";

  let synced = 0;

  for (const branch of branchesData) {
    try {
      // Comparar com a branch default para saber ahead/behind
      let aheadBy = 0;
      let behindBy = 0;
      
      if (branch.name !== defaultBranch) {
        try {
          const comparison = await githubFetch(`/repos/${fullName}/compare/${defaultBranch}...${branch.name}`);
          aheadBy = comparison.ahead_by || 0;
          behindBy = comparison.behind_by || 0;
        } catch (e) {
          // Ignora erro de comparação
        }
      }

      // Buscar último commit da branch
      let lastCommitAt = null;
      let lastCommitAuthor = null;
      try {
        const commits = await githubFetch(`/repos/${fullName}/commits?sha=${branch.name}&per_page=1`);
        if (commits.length > 0) {
          lastCommitAt = new Date(commits[0].commit.author?.date);
          lastCommitAuthor = commits[0].commit.author?.name || commits[0].author?.login;
        }
      } catch (e) {
        // Ignora erro
      }

      await storage.upsertGitBranch({
        tenantId: null,
        repositoryId,
        name: branch.name,
        sha: branch.commit.sha,
        isDefault: branch.name === defaultBranch,
        isProtected: branch.protected || false,
        aheadBy,
        behindBy,
        hasOpenPR: branchesWithPR.has(branch.name),
        lastCommitAt,
        lastCommitAuthor,
      });

      synced++;
    } catch (error) {
      console.error(`[GitSync] Error syncing branch ${branch.name}:`, error);
    }
  }

  console.log(`[GitSync] Synced ${synced} branches`);
  return synced;
}

// Sincroniza um repositório específico
export async function syncRepository(repositoryId: string): Promise<void> {
  const repo = await storage.getGitRepository(repositoryId);
  if (!repo) {
    throw new Error(`Repository ${repositoryId} not found`);
  }
  
  if (!repo.syncEnabled) {
    console.log(`[GitSync] Sync disabled for ${repo.fullName}`);
    return;
  }
  
  console.log(`[GitSync] Starting sync for ${repo.fullName}`);
  
  // Para first-sync (lastSyncAt null), limita a 90 dias para evitar timeout
  // Isso evita buscar todo o histórico de repositórios grandes
  let since: Date | undefined;
  if (repo.lastSyncAt) {
    since = new Date(repo.lastSyncAt);
  } else {
    // First sync: buscar últimos 90 dias apenas
    since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    console.log(`[GitSync] First sync for ${repo.fullName}, limitando a 90 dias`);
  }
  
  await Promise.all([
    syncCommits(repositoryId, repo.fullName, since),
    syncPullRequests(repositoryId, repo.fullName),
    syncSecurityAlerts(repositoryId, repo.fullName),
    syncBranches(repositoryId, repo.fullName),
  ]);
  
  await storage.updateGitRepository(repositoryId, {
    lastSyncAt: new Date(),
  });
  
  console.log(`[GitSync] Completed sync for ${repo.fullName}`);
}

// Sincroniza todos os repositórios ativos
export async function syncAllRepositories(): Promise<void> {
  const repositories = await storage.getGitRepositories();
  const activeRepos = repositories.filter(r => r.isActive && r.syncEnabled);
  
  console.log(`[GitSync] Starting sync for ${activeRepos.length} repositories`);
  
  for (const repo of activeRepos) {
    try {
      await syncRepository(repo.id);
    } catch (error) {
      console.error(`[GitSync] Error syncing ${repo.fullName}:`, error);
    }
  }
  
  console.log(`[GitSync] Completed sync for all repositories`);
}

// Adiciona um novo repositório e faz sincronização inicial
export async function addRepository(fullName: string): Promise<any> {
  console.log(`[GitSync] Adding repository ${fullName}...`);
  
  const repoInfo = await githubFetch(`/repos/${fullName}`);
  
  const existing = await storage.getGitRepositoryByFullName(fullName);
  if (existing) {
    console.log(`[GitSync] Repository ${fullName} already exists`);
    return existing;
  }
  
  const repo = await storage.createGitRepository({
    githubId: repoInfo.id,
    name: repoInfo.name,
    fullName: repoInfo.full_name,
    owner: repoInfo.owner.login,
    defaultBranch: repoInfo.default_branch || 'main',
    isActive: true,
    syncEnabled: true,
  });
  
  await syncRepository(repo.id);
  
  return repo;
}
