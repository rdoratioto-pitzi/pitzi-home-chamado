import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pitziHomePath = path.resolve(__dirname, '../../../');

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
    pitziHome: pitziHomePath,
    shared: path.join(pitziHomePath, 'shared'),
    server: path.join(pitziHomePath, 'server'),
    client: path.join(pitziHomePath, 'client/src'),
    agentsLogs: path.join(__dirname, '../../logs'),
  },
};

console.log('🔧 Configuração dos Agentes:');
console.log(`   Projeto Pitzi Home: ${config.paths.pitziHome}`);
console.log(`   GitHub Repo: ${config.github.repo}`);

if (!config.anthropic.apiKey) {
  throw new Error('❌ ANTHROPIC_API_KEY não configurada');
}
if (!config.github.token) {
  throw new Error('❌ GITHUB_TOKEN não configurado');
}

console.log('✅ Configuração validada!\n');
