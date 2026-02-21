import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config';
import { renovHomeContext } from '../config/renov-context';
import { AgentState } from '../types/agent-state';
import fs from 'fs';
import path from 'path';

export async function neo(state: AgentState): Promise<Partial<AgentState>> {
  if (!state.planoAprovado) {
    console.log('\n⏸️  Neo aguardando aprovação do plano...\n');
    return {};
  }

  console.log('\n💻 Neo está gerando prompts para Kilo Code...\n');

  const llm = new ChatAnthropic({
    apiKey: config.anthropic.apiKey,
    modelName: config.anthropic.model,
    temperature: 0,
  });

  const arquivos = extrairArquivosDoPlano(state.planoDetalhado!);
  const prompts: Record<string, string> = {};

  for (const arquivo of arquivos) {
    console.log(`  📄 Processando: ${arquivo}`);
    
    let conteudoAtual = '';
    let statusArquivo = '➕ NOVO';
    
    try {
      const caminhoCompleto = path.join(config.paths.renovHome, arquivo);
      if (fs.existsSync(caminhoCompleto)) {
        conteudoAtual = fs.readFileSync(caminhoCompleto, 'utf-8');
        statusArquivo = '✏️ MODIFICAR';
      }
    } catch (err) {
      console.log(`    ℹ️  Arquivo não existe`);
    }

    const promptKilo = `
${renovHomeContext}

# Neo - Implementador de Código

## Plano Aprovado
${state.planoDetalhado}

## Arquivo: \`${arquivo}\`
Status: ${statusArquivo}

${conteudoAtual ? `\n### Código Atual\n\`\`\`typescript\n${conteudoAtual.slice(0, 2000)}\n\`\`\`` : ''}

## Gere Prompt para Kilo Code

Formato EXATO:

\`\`\`
===========================================
PROMPT PARA KILO CODE
===========================================

URL=http://localhost:5050
CREDENCIAIS: SELECT email,password FROM users WHERE isAdmin=true LIMIT 1

---

${statusArquivo === '➕ NOVO' ? 'Criar' : 'Modificar'} arquivo \`${arquivo}\`:

\`\`\`typescript
// CÓDIGO COMPLETO AQUI
\`\`\`

ANTES DE EXECUTAR:
✓ Verificar imports
✓ Tipos TypeScript OK
✓ Sintaxe válida
===========================================
\`\`\`

Requisitos:
- TypeScript strict
- Zod validação
- Comentários em português
- Drizzle helpers (não SQL raw)
`;

    const response = await llm.invoke(promptKilo);
    const promptGerado = typeof response.content === 'string'
      ? response.content
      : response.content.map(c => c.type === 'text' ? c.text : '').join('\n');

    prompts[arquivo] = promptGerado;
    console.log(`    ✅ Prompt gerado`);
  }

  console.log('\n✅ Neo finalizou!\n');

  return {
    prompts,
    arquivosGerados: arquivos,
    etapaAtual: 'implementacao',
  };
}

function extrairArquivosDoPlano(plano: string): string[] {
  const arquivos: string[] = [];
  const regex = /`([a-zA-Z0-9_\-\/\.]+\.(ts|tsx|js|jsx))`/g;
  
  let match;
  while ((match = regex.exec(plano)) !== null) {
    const arquivo = match[1];
    if (!arquivos.includes(arquivo) && !arquivo.includes('node_modules')) {
      arquivos.push(arquivo);
    }
  }
  
  return arquivos;
}
