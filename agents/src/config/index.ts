import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const renovHomePath = path.resolve(__dirname, '../../../');

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-5-20250929',
  },
  github: {
    token: process.env.GITHUB_TOKEN!,
    repo: process.env.GITHUB_REPO!,
    owner: process.env.GITHUB_REPO!.split('/')[0],
    name: process.env.GITHUB_REPO!.split('/')[1],
  },
  paths: {
    renovHome: renovHomePath,
    shared: path.join(renovHomePath, 'shared'),
    server: path.join(renovHomePath, 'server'),
    client: path.join(renovHomePath, 'client/src'),
    agentsLogs: path.join(__dirname, '../../logs'),
  },
};

console.log('🔧 Configuração dos Agentes:');
console.log(`   Projeto Pitzi Home: ${config.paths.renovHome}`);
console.log(`   GitHub Repo: ${config.github.repo}`);

if (!config.anthropic.apiKey) {
  throw new Error('❌ ANTHROPIC_API_KEY não configurada');
}
if (!config.github.token) {
  throw new Error('❌ GITHUB_TOKEN não configurado');
}

console.log('✅ Configuração validada!\n');
