import { AgentState } from '../types/agent-state';
import { execSync } from 'child_process';
import { config } from '../config';
import { atlas } from './atlas';
import fs from 'fs';
import path from 'path';

export async function turing(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🧪 Turing validando código...\n');

  const errosCompletos = buscarTodosErrosTypeScript();
  const compilacao = errosCompletos === '';
  const eslint = verificarESLint();
  const aprovado = compilacao && eslint.erros === 0;

  if (!aprovado) {
    console.log('\n🤖 Chamando Atlas para analisar TODOS os erros...\n');
    
    const planoCorrecao = await atlas({
      requisito: `Corrigir TODOS os erros TypeScript encontrados:\n\n${errosCompletos.substring(0, 1500)}`,
      planoDetalhado: null,
      planoAprovado: false,
      etapaAtual: 'planejamento',
      aguardandoAprovacao: false,
      device: 'mac' as any,
    });
    
    console.log('\n📋 PLANO DE CORREÇÃO COMPLETO:\n');
    console.log('─'.repeat(60));
    console.log(planoCorrecao.planoDetalhado);
    console.log('─'.repeat(60));
    console.log('\n💡 Cole no Kilo Code para corrigir TUDO de uma vez\n');
  }

  const relatorio = gerarRelatorio(compilacao, eslint, errosCompletos);
  console.log(aprovado ? '\n✅ APROVADO!\n' : '\n❌ REPROVADO\n');

  return {
    relatorioQA: relatorio,
    qaAprovado: aprovado,
    etapaAtual: 'qa',
  };
}

function buscarTodosErrosTypeScript(): string {
  console.log('  📦 TypeScript (buscando TODOS os erros)...');
  try {
    // --pretty false: saída crua
    // Não usa --noEmit para não parar no primeiro erro
    execSync('npx tsc --pretty false --incremental false', {
      cwd: config.paths.renovHome,
      stdio: 'pipe',
    });
    console.log('    ✅ OK - Sem erros');
    return '';
  } catch (e: any) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    const linhas = output.split('\n').filter(l => l.includes('error TS'));
    
    console.log(`    ❌ ${linhas.length} erros encontrados`);
    
    // Limitar a 30 primeiros erros para não sobrecarregar Atlas
    const errosLimitados = linhas.slice(0, 30).join('\n');
    
    if (linhas.length > 30) {
      return errosLimitados + `\n\n... e mais ${linhas.length - 30} erros`;
    }
    
    return errosLimitados;
  }
}

function verificarCompilacao(): boolean {
  return buscarTodosErrosTypeScript() === '';
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

function gerarRelatorio(compilacao: boolean, eslint: { erros: number }, errosTS: string): string {
  let relatorio = `Compilação: ${compilacao ? '✅' : '❌'}\n`;
  relatorio += `ESLint: ${eslint.erros} erros\n`;
  
  if (!compilacao && errosTS) {
    const numErros = errosTS.split('\n').filter(l => l.includes('error TS')).length;
    relatorio += `TypeScript: ${numErros} erros encontrados\n`;
  }
  
  relatorio += `Status: ${compilacao && eslint.erros === 0 ? 'APROVADO' : 'REPROVADO'}`;
  
  return relatorio;
}
