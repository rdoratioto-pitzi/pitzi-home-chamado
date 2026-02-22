import { createQAGitWorkflow } from './orchestrator';
import { initialState } from './types/agent-state';
import readline from 'readline';

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
  console.log('\n🚀 Turing + Giter\n');

  const requisito = await pergunta('📝 Requisito: ');
  
  if (!requisito.trim()) {
    console.log('❌ Requisito vazio!');
    rl.close();
    return;
  }

  console.log('\n🧪 Validando...\n');

  const workflow = await createQAGitWorkflow();
  const resultado = await workflow.invoke({
    ...initialState,
    requisito,
  });

  if (resultado.qaAprovado) {
    console.log('\n🎉 SUCESSO!');
    console.log(`✅ Branch: ${resultado.branchName}\n`);
  } else {
    console.log('\n❌ REPROVADO\n');
    console.log(resultado.relatorioQA);
  }

  rl.close();
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  rl.close();
  process.exit(1);
});
