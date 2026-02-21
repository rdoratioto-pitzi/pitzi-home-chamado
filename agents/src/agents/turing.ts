import { AgentState } from '../types/agent-state';
import { execSync } from 'child_process';
import { config } from '../config';
import { atlas } from './atlas';

export async function turing(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🧪 Turing validando código...\n');

  const compilacao = verificarCompilacao();
  const eslint = verificarESLint();
  const aprovado = compilacao && eslint.erros === 0;

  if (!aprovado) {
    console.log('\n🤖 Chamando Atlas para analisar erros...\n');
    
    const errosTS = buscarErrosTypeScript();
    
    const planoCorrecao = await atlas({
      requisito: `Corrigir erros de TypeScript:\n\n${errosTS.substring(0, 500)}`,
      planoDetalhado: null,
      planoAprovado: false,
      etapaAtual: 'planejamento',
      aguardandoAprovacao: false,
      device: 'mac' as any,
    });
    
    console.log('\n📋 PLANO DE CORREÇÃO (gerado por Atlas):\n');
    console.log('─'.repeat(60));
    console.log(planoCorrecao.planoDetalhado);
    console.log('─'.repeat(60));
    console.log('\n💡 Cole este plano no Kilo Code para corrigir os erros\n');
  }

  const relatorio = gerarRelatorio(compilacao, eslint);

  console.log(aprovado ? '\n✅ APROVADO!\n' : '\n❌ REPROVADO\n');

  return {
    relatorioQA: relatorio,
    qaAprovado: aprovado,
    etapaAtual: 'qa',
  };
}

function verificarCompilacao(): boolean {
  console.log('  📦 TypeScript...');
  try {
    execSync('npx tsc --noEmit', {
      cwd: config.paths.renovHome,
      stdio: 'pipe',
    });
    console.log('    ✅ OK');
    return true;
  } catch {
    console.log('    ❌ Erros');
    return false;
  }
}

function buscarErrosTypeScript(): string {
  try {
    execSync('npx tsc --noEmit', {
      cwd: config.paths.renovHome,
      stdio: 'pipe',
    });
    return 'Nenhum erro';
  } catch (e: any) {
    return e.stdout?.toString() || e.stderr?.toString() || 'Erro desconhecido';
  }
}

function verificarESLint(): { erros: number } {
  console.log('  🔍 ESLint...');
  try {
    execSync('npx eslint . --ext .ts,.tsx --max-warnings 50', {
      cwd: config.paths.renovHome,
      stdio: 'pipe',
    });
    console.log('    ✅ OK');
    return { erros: 0 };
  } catch (e: any) {
    const output = e.stdout?.toString() || '';
    const erros = (output.match(/error/g) || []).length;
    console.log(`    ⚠️ ${erros} erros`);
    return { erros };
  }
}

function gerarRelatorio(compilacao: boolean, eslint: { erros: number }): string {
  return `Compilação: ${compilacao ? '✅' : '❌'}
ESLint: ${eslint.erros} erros
Status: ${compilacao && eslint.erros === 0 ? 'APROVADO' : 'REPROVADO'}`;
}
