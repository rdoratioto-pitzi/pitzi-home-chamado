import { AgentState } from '../types/agent-state';
import { execSync } from 'child_process';
import { config } from '../config';
import { atlas } from './atlas';

export async function turing(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🧪 Turing validando código...\n');

  // Contar erros ANTES das suas mudanças
  const errosBaseline = getErrosBaseline();
  
  // Contar erros AGORA (com suas mudanças)
  const errosAtuais = contarErrosTypeScript();
  
  // Calcular NOVOS erros introduzidos
  const novosErros = Math.max(0, errosAtuais - errosBaseline);
  
  console.log(`📊 Baseline: ${errosBaseline} erros`);
  console.log(`📊 Atual: ${errosAtuais} erros`);
  console.log(`📊 Novos: ${novosErros} erros\n`);

  const eslint = verificarESLint();
  const aprovado = novosErros === 0 && eslint.erros === 0;

  if (novosErros > 0) {
    console.log('\n🤖 Você introduziu novos erros! Chamando Atlas...\n');
    
    const errosDetalhados = buscarErrosDetalhados();
    
    const planoCorrecao = await atlas({
      requisito: `Corrigir ${novosErros} NOVOS erros TypeScript:\n\n${errosDetalhados.substring(0, 1500)}`,
      planoDetalhado: null,
      planoAprovado: false,
      etapaAtual: 'planejamento',
      aguardandoAprovacao: false,
      device: 'mac' as any,
    });
    
    console.log('\n📋 PLANO DE CORREÇÃO:\n');
    console.log('─'.repeat(60));
    console.log(planoCorrecao.planoDetalhado);
    console.log('─'.repeat(60));
    console.log('\n💡 Cole no Kilo Code\n');
  } else if (errosAtuais > 0) {
    console.log(`✅ OK - ${errosAtuais} erros antigos (não aumentou)\n`);
  }

  const relatorio = gerarRelatorio(aprovado, eslint, errosBaseline, errosAtuais, novosErros);
  console.log(aprovado ? '\n✅ APROVADO!\n' : '\n❌ REPROVADO\n');

  // Atualizar baseline se aprovado
  if (aprovado && errosAtuais < errosBaseline) {
    salvarBaseline(errosAtuais);
    console.log(`📊 Baseline atualizado: ${errosBaseline} → ${errosAtuais}\n`);
  }

  return {
    relatorioQA: relatorio,
    qaAprovado: aprovado,
    etapaAtual: 'qa',
  };
}

function getErrosBaseline(): number {
  const fs = require('fs');
  const path = require('path');
  const baselinePath = path.join(__dirname, '../../.baseline-errors');
  
  try {
    if (fs.existsSync(baselinePath)) {
      const baseline = parseInt(fs.readFileSync(baselinePath, 'utf-8').trim(), 10);
      return isNaN(baseline) ? 205 : baseline;
    }
  } catch {}
  
  return 205; // Valor inicial conhecido
}

function salvarBaseline(erros: number): void {
  const fs = require('fs');
  const path = require('path');
  const baselinePath = path.join(__dirname, '../../.baseline-errors');
  
  try {
    fs.writeFileSync(baselinePath, erros.toString(), 'utf-8');
  } catch (error) {
    console.log('⚠️  Não foi possível salvar baseline');
  }
}

function contarErrosTypeScript(): number {
  console.log('  📦 TypeScript...');
  
  try {
    execSync('npx tsc --noEmit --pretty false', {
      cwd: config.paths.renovHome,
      stdio: 'pipe',
    });
    console.log('    ✅ OK - Sem erros');
    return 0;
  } catch (e: any) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    const erros = output.split('\n').filter(l => l.includes('error TS')).length;
    
    if (erros > 0) {
      console.log(`    ⚠️  ${erros} erro(s) no projeto`);
    }
    
    return erros;
  }
}

function buscarErrosDetalhados(): string {
  try {
    execSync('npx tsc --noEmit --pretty false', {
      cwd: config.paths.renovHome,
      stdio: 'pipe',
    });
    return '';
  } catch (e: any) {
    const output = e.stdout?.toString() || '';
    const linhas = output.split('\n').filter(l => l.includes('error TS'));
    return linhas.slice(0, 30).join('\n');
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
    console.log(`    ⚠️ ${erros} erro(s)`);
    return { erros };
  }
}

function gerarRelatorio(
  aprovado: boolean,
  eslint: { erros: number },
  baseline: number,
  atual: number,
  novos: number
): string {
  let relatorio = `Baseline: ${baseline} erros\n`;
  relatorio += `Atual: ${atual} erros\n`;
  relatorio += `Novos introduzidos: ${novos}\n`;
  relatorio += `ESLint: ${eslint.erros} erro(s)\n`;
  relatorio += `Status: ${aprovado ? 'APROVADO ✅' : 'REPROVADO ❌'}`;
  
  return relatorio;
}
