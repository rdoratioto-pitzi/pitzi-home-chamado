import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config';
import { AgentState } from '../types/agent-state';

export async function atlas(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🗺️  Atlas analisando...\n');
  
  const llm = new ChatAnthropic({
    apiKey: config.anthropic.apiKey,
    modelName: config.anthropic.model,
    temperature: 0,
    maxTokens: 300,
  });

  const prompt = `Planejador técnico minimalista.

Requisito: ${state.requisito}

Plano ENXUTO (150 tokens):

## Objetivo
[1 frase]

## Arquivos
- Backend: arquivo.ts - ação
- Frontend: arquivo.tsx - ação

## Fluxo
A → B → C

## Checklist
- [ ] Item 1
- [ ] Item 2

LIMITE: 150 tokens. Sempre sugira OpenRouter para APIs pagas.`;

  const response = await llm.invoke(prompt);
  const plano = typeof response.content === 'string' 
    ? response.content 
    : response.content.map(c => c.type === 'text' ? c.text : '').join('\n');

  console.log('\n✅ Atlas finalizou!\n');

  return {
    planoDetalhado: plano,
    etapaAtual: 'planejamento',
    aguardandoAprovacao: true,
  };
}
