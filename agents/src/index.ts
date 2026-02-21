import readline from 'readline';
import { createOrchestrator } from './orchestrator';
import { AgentState, initialState } from './types/agent-state';
import { logDevice } from './utils/device-detector';
import { config } from './config';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function pergunta(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     🤖 RENOV AGENTS - Sistema Multi-Agentes   ║');
  console.log('║        Atlas · Neo · Ada · Linus              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  logDevice();
  console.log('');

  const requisito = await pergunta('📝 Descreva o que deseja desenvolver:\n> ');
  
  if (!requisito.trim()) {
    console.log('\n❌ Requisito não pode estar vazio!');
    rl.close();
    return;
  }

  const contextoExtra = await pergunta('\n📎 Contexto adicional (Enter para pular):\n> ');

  console.log('\n🚀 Iniciando orquestração dos agentes...\n');

  const state: AgentState = {
    ...initialState,
    requisito,
    contextoAdicional: contextoExtra || undefined,
  };

  const orchestrator = await createOrchestrator();

  // ETAPA 1: Atlas gera plano
  console.log('═══════════════════════════════════════════════');
  console.log('   ETAPA 1: ATLAS (Planejador)');
  console.log('═══════════════════════════════════════════════\n');

  let resultado = await orchestrator.invoke(state);

  if (resultado.planoDetalhado) {
    console.log('\n📋 PLANO GERADO POR ATLAS:\n');
    console.log('─'.repeat(50));
    console.log(resultado.planoDetalhado);
    console.log('─'.repeat(50));

    const aprovacao = await pergunta('\n✅ Aprovar plano? (s/n): ');
    
    if (aprovacao.toLowerCase() !== 's') {
      const feedback = await pergunta('💬 Feedback para refinar (Enter para cancelar): ');
      if (!feedback.trim()) {
        console.log('\n❌ Operação cancelada.');
        rl.close();
        return;
      }
      resultado.feedbackPlano = feedback;
      console.log('\n🔄 Refazendo plano com feedback...\n');
      resultado = await orchestrator.invoke({
        ...resultado,
        requisito: `${resultado.requisito}\n\nFeedback: ${feedback}`,
      });
    }

    resultado.planoAprovado = true;
  }

  // ETAPA 2: Neo gera prompts
  console.log('\n═══════════════════════════════════════════════');
  console.log('   ETAPA 2: NEO (Implementador)');
  console.log('═══════════════════════════════════════════════\n');

  resultado = await orchestrator.invoke(resultado);

  if (Object.keys(resultado.prompts).length > 0) {
    console.log('\n💻 PROMPTS GERADOS POR NEO:\n');
    
    for (const [arquivo, prompt] of Object.entries(resultado.prompts)) {
      console.log('\n╔════════════════════════════════════════════════╗');
      console.log(`║  📄 ${arquivo.padEnd(44)} ║`);
      console.log('╚════════════════════════════════════════════════╝\n');
      console.log(prompt);
      console.log('\n' + '─'.repeat(50));
      
      await pergunta('\n⏸️  Pressione Enter para próximo arquivo...');
    }

    console.log('\n📋 INSTRUÇÕES:');
    console.log('1. Copie cada prompt acima');
    console.log('2. Cole no Kilo Code (VS Code)');
    console.log('3. Execute e teste localmente');
    console.log('4. Volte aqui quando finalizar\n');

    await pergunta('✅ Pressione Enter quando tiver colado TODOS os prompts no Kilo Code...');
  }

  // ETAPA 3: Ada revisa
  console.log('\n═══════════════════════════════════════════════');
  console.log('   ETAPA 3: ADA (Revisora)');
  console.log('═══════════════════════════════════════════════\n');

  resultado = await orchestrator.invoke(resultado);

  if (resultado.relatorioValidacao) {
    console.log('\n🔍 RELATÓRIO DE VALIDAÇÃO DA ADA:\n');
    console.log('─'.repeat(50));
    console.log(resultado.relatorioValidacao);
    console.log('─'.repeat(50));

    if (!resultado.validacaoAprovada) {
      console.log('\n⚠️  Ada encontrou problemas! Revise o código antes de prosseguir.');
      const continuar = await pergunta('\n🔄 Continuar mesmo assim? (s/n): ');
      if (continuar.toLowerCase() !== 's') {
        console.log('\n❌ Operação cancelada para correções.');
        rl.close();
        return;
      }
    }
  }

  // ETAPA 4: Próximos passos
  console.log('\n═══════════════════════════════════════════════');
  console.log('   🎯 PRÓXIMOS PASSOS');
  console.log('═══════════════════════════════════════════════\n');

  console.log('✅ Código gerado pelos agentes!');
  console.log('✅ Revisão completa realizada!\n');

  console.log('📝 AGORA VOCÊ DEVE:');
  console.log('1. Testar localmente (npm run dev)');
  console.log('2. Verificar se tudo funciona');
  console.log('3. Commitar via GitHub Desktop com padrão:');
  console.log(`   feat(modulo): ${requisito.substring(0, 50)}`);
  console.log('4. Criar Pull Request\n');

  console.log('💡 Arquivos gerados:');
  resultado.arquivosGerados.forEach(arq => console.log(`   - ${arq}`));

  console.log('\n✨ Agentes finalizaram com sucesso!\n');
  rl.close();
}

main().catch((err) => {
  console.error('\n❌ Erro na execução:', err.message);
  rl.close();
  process.exit(1);
});
