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

// Sincroniza commits de um repositório
async function syncCommits(repositoryId: string, fullName: string, since?: Date): Promise<number> {
  console.log(`[GitSync] Syncing commits for ${fullName}...`);
  
  let endpoint = `/repos/${fullName}/commits?per_page=100`;
  if (since) {
    endpoint += `&since=${since.toISOString()}`;
  }
  
  try {
    const commits = await githubFetch(endpoint);
    console.log(`[GitSync] Found ${commits.length} commits`);
    
    if (commits.length === 0) return 0;
    
    const commitData = commits.map((commit: any) => ({
      repositoryId,
      sha: commit.sha,
      message: commit.commit.message.split('\n')[0].substring(0, 500),
      fullMessage: commit.commit.message,
      authorName: commit.commit.author?.name || commit.author?.login || 'Unknown',
      authorEmail: commit.commit.author?.email || null,
      authorAvatarUrl: commit.author?.avatar_url || null,
      commitType: detectCommitType(commit.commit.message),
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      committedAt: new Date(commit.commit.author?.date || commit.commit.committer?.date),
    }));
    
    const inserted = await storage.createGitCommitsBatch(commitData);
    console.log(`[GitSync] Inserted ${inserted} new commits`);
    
    return inserted;
  } catch (error) {
    console.error(`[GitSync] Error syncing commits:`, error);
    return 0;
  }
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
  
  const since = repo.lastSyncAt || undefined;
  
  await Promise.all([
    syncCommits(repositoryId, repo.fullName, since),
    syncPullRequests(repositoryId, repo.fullName),
    syncSecurityAlerts(repositoryId, repo.fullName),
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
