import { execFileSync } from 'child_process';
import { config } from '../config';
import { AgentState } from '../types/agent-state';
import { resolverDentroDoRepo } from '../utils/safe-path';

// Git sem shell: argumentos vão direto para o processo, então requisito, nomes de arquivo
// e branch (todos vindos de entrada externa ou do plano da IA) não viram comandos.
function git(args: string[]): string {
  return execFileSync('git', args, { cwd: config.paths.renovHome, encoding: 'utf-8' });
}

export async function giter(state: AgentState & { qaAprovado?: boolean }): Promise<Partial<AgentState>> {
  console.log('\n🌿 Giter executando automação Git...\n');

  if (!state.qaAprovado) {
    console.log('❌ QA não aprovado - abortando commit\n');
    return { etapaAtual: 'concluido' };
  }

  try {
    const branch = git(['branch', '--show-current']).trim();
    git(['check-ref-format', '--branch', branch]);
    console.log(`  📍 Branch: ${branch}`);

    // Só os arquivos que os agentes geraram, e só dentro do repositório (nunca `git add .`).
    const arquivos = state.arquivosGerados.filter((a) => resolverDentroDoRepo(config.paths.renovHome, a));
    if (arquivos.length === 0) {
      console.log('  ⚠️ Nada para commitar\n');
      return { etapaAtual: 'concluido' };
    }

    git(['add', '--', ...arquivos]);
    console.log(`  ✅ git add (${arquivos.length} arquivos)`);

    git(['commit', '-m', `feat: ${state.requisito}\n\nValidado por Turing ✅`]);
    console.log('  ✅ git commit');

    git(['push', 'origin', `HEAD:refs/heads/${branch}`]);
    console.log('  ✅ git push\n');

    console.log('✅ Giter concluído!\n');

    return {
      branchName: branch,
      etapaAtual: 'concluido',
    };
  } catch (error: any) {
    console.error('❌ Erro no Giter:', error.message);
    throw error;
  }
}
