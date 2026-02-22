import readline from 'readline';
import { createOrchestrator } from './orchestrator';
import { initialState } from './types/agent-state';
import { logDevice } from './utils/device-detector';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function pergunta(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   🤖 RENOV AGENTS v3.0                        ║');
  console.log('║   Atlas (Planejador) · Turing (QA) · Giter   ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const device = logDevice();
  console.log('');

  const requisito = await pergunta('📝 Requisito:\n> ');
  
  if (!requisito.trim()) {
    console.log('\n❌ Requisito vazio!');
    rl.close();
    return;
  }

  console.log('\n🚀 Processando...\n');

  const orchestrator = await createOrchestrator();
  const resultado = await orchestrator.invoke({
    ...initialState,
    requisito,
    device: device as any,
  });

  if (resultado.planoDetalhado) {
    console.log('─'.repeat(60));
    console.log(resultado.planoDetalhado);
    console.log('─'.repeat(60));

    const aprovacao = await pergunta('\n✅ Aprovar? (s/n): ');
    
    if (aprovacao.toLowerCase() === 's') {
      console.log('\n✅ Aprovado!');
      console.log('\n📋 Copie o plano e cole no Kilo Code\n');
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
