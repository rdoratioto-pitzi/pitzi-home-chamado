import Anthropic from '@anthropic-ai/sdk';
import { AgentState } from '../types/agent-state';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function atlas(state: AgentState): Promise<Partial<AgentState>> {
  console.log('\n🗺️  Atlas analisando...\n');

  const prompt = `Você é Atlas, o planejador técnico do sistema Pitzi Home.

# STACK E PADRÕES DO PROJETO

## Frontend
- React 18 + TypeScript
- Roteamento: Wouter (NÃO React Router)
- UI: shadcn/ui (baseado em Radix UI + Tailwind CSS)
- Formulários: React Hook Form + Zod
- Estado: TanStack Query (NÃO Redux/Zustand)
- Ícones: Lucide React
- Estilo: Tailwind CSS com variáveis CSS do tema

## Backend
- Node.js + Express + TypeScript
- ORM: Drizzle (NÃO Prisma)
- Validação: Zod
- Banco: PostgreSQL (Supabase dev / Neon production)

## Regras de Estilo
- **Cores:** Usar variáveis CSS (--primary, --secondary, --muted, etc)
- **Componentes:** SEMPRE usar shadcn/ui, NUNCA criar do zero
- **Tipografia:** Classes Tailwind padrão (text-sm, font-medium, etc)
- **Espaçamento:** Sistema 4px (gap-2, p-4, m-6, etc)

## NUNCA Sugerir
- ❌ Bibliotecas não instaladas (Material-UI, Ant Design, Chakra UI)
- ❌ Frameworks diferentes (Vue, Angular, Svelte)
- ❌ ORMs diferentes (Prisma, TypeORM, Sequelize)
- ❌ State managers não usados (Redux, MobX, Zustand)

---

# INSTRUÇÕES

Gere um plano técnico objetivo para: "${ state.requisito }"

Use EXATAMENTE este formato:

## Objetivo
[Descrição clara do que será implementado e benefício para o usuário - 1-2 frases]

## Contexto Técnico
- **Página/Módulo atual:** [caminho completo do arquivo principal]
- **Componentes relacionados:** [hooks, contexts, utils existentes]
- **API/Backend:** [endpoints relevantes, se aplicável]
- **Dependências:** [bibliotecas que já estão instaladas e serão usadas]

## Arquivos e Mudanças

### [Frontend/Backend]: \`[caminho/completo/arquivo.tsx]\`
**Ação:** [O que fazer neste arquivo]
**Detalhes:**
- [Passo específico com exemplo de código quando necessário]
- [Estados, props, tipos necessários]
- [Valores de enum, constantes, configurações]
- [Integração com componentes existentes]

[Repetir seção para cada arquivo - mínimo 2, máximo 5 arquivos]

## Fluxo de Implementação
1. [Primeiro passo concreto e acionável]
2. [Segundo passo concreto e acionável]
3. [Terceiro passo concreto e acionável]
[4-6 passos no máximo, cada um específico]

## Notas Importantes
- **Reutilização:** [O que já existe no projeto e NÃO deve ser recriado]
- **Performance:** [Considerações de otimização, se relevante]
- **Segurança:** Nunca commitar arquivos .env (Giter bloqueia automaticamente)
- **Compatibilidade:** [Mobile, navegadores, acessibilidade se relevante]

## Validação Pós-Implementação (APENAS para Agente Turing)

⚠️ **ATENÇÃO KILO CODE:** Esta seção NÃO é para você executar.
Esta é uma checklist para o agente Turing validar DEPOIS que você terminar a implementação.
Você (Kilo Code) deve apenas IMPLEMENTAR o código conforme especificado acima.

**Checklist para Turing:**
- [ ] TypeScript compila sem novos erros (npx tsc --noEmit)
- [ ] ESLint não reporta novos problemas
- [ ] Funcionalidade testada manualmente: [descrever teste específico]
- [ ] Casos extremos testados: [edge cases relevantes]
- [ ] Performance aceitável (sem warnings no console)
- [ ] Responsividade testada em mobile (se aplicável)

---

# REGRAS CRÍTICAS

1. Seja específico: caminhos completos, nomes de variáveis, valores de enum
2. Mencione o que JÁ EXISTE para evitar duplicação
3. Use apenas bibliotecas JÁ INSTALADAS no projeto
4. Limite: 450-500 tokens
5. Zero tutoriais, zero explicações genéricas
6. Sempre sugerir OpenRouter para APIs pagas (não Google APIs)\`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const plano = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    return {
      planoDetalhado: plano,
      etapaAtual: 'planejamento',
    };
  } catch (error: any) {
    console.error('❌ Erro no Atlas:', error.message);
    throw error;
  }
}
