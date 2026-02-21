import { execSync } from 'child_process';
import { config } from '../config';
import { AgentState } from '../types/agent-state';

export async function giter(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🌿 Giter executando automação Git...\n');

  if (!state.qaAprovado) {
    console.log('❌ QA não aprovado - abortando commit\n');
    return { etapaAtual: 'concluido' };
  }

  try {
    const branch = execSync('git branch --show-current', {
      cwd: config.paths.renovHome,
      encoding: 'utf-8',
    }).trim();

    console.log(`  📍 Branch: ${branch}`);

    const arquivos = execSync('git status --porcelain', {
      cwd: config.paths.renovHome,
      encoding: 'utf-8',
    }).split('\n').filter(l => l.trim()).length;

    console.log(`  📝 ${arquivos} arquivos modificados`);

    if (arquivos === 0) {
      console.log('  ⚠️ Nada para commitar\n');
      return { etapaAtual: 'concluido' };
    }

    execSync('git add .', { cwd: config.paths.renovHome });
    console.log('  ✅ git add .');

    const msg = `feat: ${state.requisito}\n\nValidado por Turing ✅`;
    execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
      cwd: config.paths.renovHome,
    });
    console.log('  ✅ git commit');

    execSync(`git push origin ${branch}`, {
      cwd: config.paths.renovHome,
    });
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
