import { db } from "../server/db";
import { updates } from "../shared/schema";
import { desc } from "drizzle-orm";

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
}

export async function parseCommits() {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    console.error('❌ GITHUB_TOKEN não configurado');
    throw new Error('GITHUB_TOKEN não está configurado');
  }

  console.log('✓ GITHUB_TOKEN presente, buscando commits...');

  try {
    // Busca últimos 50 commits da API do GitHub
    const response = await fetch(
      'https://api.github.com/repos/Renov-BD/Renov.Home/commits?per_page=50',
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Renov-Home-App'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da API GitHub:', response.status, errorText);
      throw new Error(`GitHub API retornou ${response.status}: ${errorText}`);
    }

    const commits: GitHubCommit[] = await response.json();
    console.log(`✓ ${commits.length} commits recuperados do GitHub`);

    // Busca commits já existentes no banco
    const existingUpdates = await db
      .select({ commitHash: updates.commitHash })
      .from(updates);
    
    const existingHashes = new Set(existingUpdates.map(u => u.commitHash));

    // Filtra apenas commits novos
    const newCommits = commits.filter(c => !existingHashes.has(c.sha));
    
    if (newCommits.length === 0) {
      console.log('✓ Nenhum commit novo para adicionar');
      return;
    }

    console.log(`✓ ${newCommits.length} commits novos para inserir`);

    // Insere commits novos no banco
    for (const commit of newCommits) {
      const message = commit.commit.message;
      const lines = message.split('\n').filter(l => l.trim());
      
      // Primeira linha = título
      const title = lines[0] || message;
      
      // Restante = descrição
      const description = lines.slice(1).join('\n').trim() || 
                         'Melhorias e ajustes no funcionamento geral';

      // Detecta tipo do commit
      let type: 'bug' | 'feature' | 'improvement' = 'improvement';
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.startsWith('fix') || lowerTitle.includes('corrige')) {
        type = 'bug';
      } else if (lowerTitle.startsWith('feat') || lowerTitle.includes('adiciona')) {
        type = 'feature';
      }

      await db.insert(updates).values({
        version: `v${new Date(commit.commit.author.date).toISOString().split('T')[0].replace(/-/g, '.')}`,
        title: title.replace(/^(fix|feat|chore|docs|style|refactor|perf|test)(\(.+?\))?:\s*/i, ''),
        content: description,
        category: type,
        source: 'Git',
        isPublished: true,
        commitHash: commit.sha,
        author: commit.commit.author.name,
        createdAt: new Date(commit.commit.author.date),
      });
    }

    console.log(`✓ ${newCommits.length} novos commits inseridos no banco`);
  } catch (error) {
    console.error('❌ Erro ao processar commits:', error);
    throw error;
  }
}

// ES Module compatible check for direct execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    parseCommits().catch(console.error);
}
