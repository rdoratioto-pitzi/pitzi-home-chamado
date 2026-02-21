import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config';
import { renovHomeContext } from '../config/renov-context';
import { AgentState } from '../types/agent-state';

export async function atlas(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🗺️  Atlas está analisando seu requisito...\n');
  
  const llm = new ChatAnthropic({
    apiKey: config.anthropic.apiKey,
    modelName: config.anthropic.model,
    temperature: 0.3,
  });

  const prompt = `
${renovHomeContext}

# Seu Papel: Atlas - Arquiteto de Software da Renov

Você é o planejador estratégico. Transforma requisitos do CEO em planos técnicos detalhados.

## Requisito do CEO
${state.requisito}

${state.contextoAdicional ? `\n## Contexto Adicional\n${state.contextoAdicional}` : ''}

## Seu Plano Deve Incluir

### 1. 📊 Resumo Executivo
- Objetivo em 2-3 frases
- Complexidade: Baixa/Média/Alta
- Tempo estimado: X horas/dias

### 2. 🎯 Análise de Impacto
- Módulos afetados
- Tabelas do banco
- Integrações externas
- Dependências

### 3. 📁 Arquivos a Modificar/Criar
Para CADA arquivo:
- Caminho: \`shared/schema.ts\`
- Ação: ✏️ Modificar / ➕ Criar
- Mudanças detalhadas
- Dependências

### 4. 🔄 Fluxo de Dados
Frontend → Validação → API → Storage → Database → Response

### 5. ✅ Checklist de Validação
- [ ] Migration
- [ ] Zod schema
- [ ] Tipos TypeScript
- [ ] Permissões
- [ ] Componentes

### 6. ⚠️ Pontos de Atenção
- Incompatibilidades
- Edge cases
- Performance

### 7. 🧪 Testes Manuais
1. Testar com admin
2. Testar sem permissão
3. Testar inputs inválidos

Formato: Markdown estruturado com emojis.
`;

  const response = await llm.invoke(prompt);
  const plano = typeof response.content === 'string' 
    ? response.content 
    : response.content.map(c => c.type === 'text' ? c.text : '').join('\n');

  console.log('\n✅ Atlas finalizou o plano!\n');

  return {
    planoDetalhado: plano,
    etapaAtual: 'planejamento',
    aguardandoAprovacao: true,
  };
}
