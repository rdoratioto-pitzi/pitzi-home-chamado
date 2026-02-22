import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config';
import { renovHomeContext } from '../config/renov-context';
import { AgentState } from '../types/agent-state';

export async function ada(state: AgentState): Promise<Partial<AgentState>> {
  if (state.arquivosGerados.length === 0) {
    console.log('\n⏸️  Ada aguardando código...\n');
    return {};
  }

  console.log('\n🔍 Ada está revisando...\n');

  const llm = new ChatAnthropic({
    apiKey: config.anthropic.apiKey,
    modelName: config.anthropic.model,
    temperature: 0.2,
  });

  const prompt = `
${renovHomeContext}

# Ada - Revisora de Qualidade

## Plano Original
${state.planoDetalhado}

## Prompts Gerados
${Object.entries(state.prompts).map(([arq, p]) => `\n### ${arq}\n${p.slice(0, 1500)}`).join('\n')}

## Sua Revisão

### 1. ✅ Checklist Padrões
- [ ] Nomenclatura correta
- [ ] TypeScript strict
- [ ] Zod validação
- [ ] Imports organizados
- [ ] Error handling
- [ ] Drizzle ORM

### 2. 🔒 Segurança
- Inputs validados?
- Permissões OK?
- SQL injection prevenido?

### 3. ⚡ Performance
- Queries otimizadas?
- Loading states?

### 4. 🧪 Edge Cases
Liste cenários não cobertos

### 5. 📝 Testes Manuais
1. Testar com admin
2. Testar sem permissão
3. Testar inputs inválidos

### 6. 🐛 Problemas Críticos
Se houver, liste aqui

### 7. 📊 Veredicto
✅ APROVADO / ⚠️ APROVADO COM RESSALVAS / ❌ REPROVADO

Justificativa: [explicação]
`;

  const response = await llm.invoke(prompt);
  const relatorio = typeof response.content === 'string'
    ? response.content
    : response.content.map(c => c.type === 'text' ? c.text : '').join('\n');

  const aprovado = (relatorio.includes('✅ APROVADO') || relatorio.includes('⚠️ APROVADO')) 
    && !relatorio.includes('❌ REPROVADO');

  console.log(aprovado ? '\n✅ Ada aprovou!\n' : '\n⚠️ Ada encontrou problemas!\n');

  return {
    relatorioValidacao: relatorio,
    validacaoAprovada: aprovado,
    etapaAtual: 'revisao',
    aguardandoAprovacao: true,
  };
}
