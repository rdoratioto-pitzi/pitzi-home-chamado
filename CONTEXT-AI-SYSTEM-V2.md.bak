# 📚 CONTEXTO COMPLETO - Sistema AI Dev V2

**Data:** 23/02/2024  
**Branch:** `feat-agents-v2`  
**Máquina:** Macbook  
**Status:** Pronto para implementação

---

## 🎯 CONTEXTO GERAL

Desenvolvimento de sistema **autônomo de agentes AI** para automatizar 90% do desenvolvimento de features no projeto Renov Home.

**CEO não-dev** que usa Kilo Code + OpenRouter (modelos flexíveis como Minimax M2.5 a $0.50/MM) busca automatizar workflow manual atual.

---

## 📊 SITUAÇÃO ATUAL

### **V1 Multi-Agentes (Concluído - PR Publicado)**
- ✅ Atlas V3 (planejador - 150 tokens)
- ✅ Turing V3 (QA modo baseline - 205 erros antigos)
- ✅ Giter V2 (commits estruturados)
- ❌ **Problemas:** Muito manual, Atlas com erro de sintaxe, sem automação real

**Commit V1:** `f07d57b5cfec3473eb3158365553a91c280a4cc3`

### **V2 AI Dev System (Em Desenvolvimento)**
- ✅ **Documentação completa aprovada**
- ✅ **Arquitetura definida**
- ⏳ **Implementação pendente**

**Branch atual:** `feat-agents-v2`

---

## 🏗️ ARQUITETURA V2 APROVADA

### **Workflow Completo:**
````
1. VOCÊ → Cria plano no Claude.ai
2. VOCÊ → Salva em plans/[nome]/plan.md
3. VOCÊ → Executa: renov-dev run plans/[nome]
4. VOCÊ → Escolhe modelo (Minimax/DeepSeek/Claude/etc)
5. SISTEMA → Executa TUDO automaticamente:
   - Orchestrator lê plan
   - Coder implementa cada prompt
   - Monitor valida em paralelo
   - Auto-corrige erros (max 3x)
   - Turing valida final
   - Giter commita + push
6. VOCÊ → Recebe email: "Feature pronta!"
7. VOCÊ → Testa e aprova PR
````

### **Agentes:**
````
┌─────────────────┐
│  Orchestrator   │ ← Coordena tudo
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼───┐  ┌──▼────┐
│ Coder │  │Monitor│ ← Trabalham em paralelo
└───┬───┘  └──┬────┘
    │         │
    └────┬────┘
         │ (loop até OK)
         ▼
    ┌────────┐
    │ Turing │ ← QA final
    └────┬───┘
         ▼
    ┌────────┐
    │ Giter  │ ← Commit + Push
    └────────┘
````

---

## 📁 ESTRUTURA DE ARQUIVOS
````
Renov.Home/
├── CLAUDE.md                      # ← NOVO: Padrões para agentes
│
├── plans/                         # ← NOVO: Plans por projeto
│   ├── git-analytics-v5/
│   │   ├── plan.md
│   │   ├── .metadata.json
│   │   └── logs/
│   └── README.md
│
├── server/
│   ├── ai/                        # ← NOVO: Sistema AI
│   │   ├── agents/
│   │   │   ├── orchestrator.ts
│   │   │   ├── coder.ts
│   │   │   ├── monitor.ts
│   │   │   ├── turing.ts
│   │   │   └── giter.ts
│   │   └── services/
│   │       ├── openrouter.service.ts
│   │       └── email.service.ts
│   │
│   └── routes.ts                  # Adicionar rotas AI
│
├── shared/
│   └── schema.ts                  # Adicionar tabelas AI
│
├── cli/
│   └── renov-dev.ts               # ← NOVO: CLI principal
│
└── docs/
    └── ai-system/                 # ← NOVO: Docs V2
        └── README.md
````

---

## 🗄️ BANCO DE DADOS

### **Tabelas Novas:**
````sql
-- Plans salvos
CREATE TABLE ai_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT REFERENCES users(id),
  titulo TEXT NOT NULL,
  requisito TEXT NOT NULL,
  arquivo_origem TEXT NOT NULL,           -- plans/nome/plan.md
  prompts JSONB NOT NULL,                  -- [{ordem, titulo, prompt}]
  modelo_id UUID REFERENCES ai_models(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  arquivos_modificados TEXT[],
  custo_total DECIMAL(10,4),
  tempo_total_segundos INT,
  erros_encontrados JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_ai_plans_status ON ai_plans(status);
CREATE INDEX idx_ai_plans_user ON ai_plans(user_id);

-- Execução de cada prompt
CREATE TABLE ai_prompt_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES ai_plans(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  titulo TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,              -- running, completed, failed
  tentativas INT DEFAULT 0,
  codigo_gerado TEXT,
  arquivos_criados TEXT[],
  erros_encontrados JSONB,
  tokens_input INT,
  tokens_output INT,
  custo DECIMAL(10,4),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_prompt_exec_plan ON ai_prompt_executions(plan_id);

-- Modelos disponíveis
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,         -- "Minimax M2.5"
  provider TEXT NOT NULL,            -- "openrouter"
  model_id TEXT NOT NULL,            -- "minimax/minimax-01"
  custo_input_por_mm DECIMAL(10,4), -- 0.50
  custo_output_por_mm DECIMAL(10,4),-- 0.50
  config JSONB,                      -- {temperature, max_tokens, ...}
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed inicial
INSERT INTO ai_models (nome, provider, model_id, custo_input_por_mm, custo_output_por_mm, config) VALUES
('Minimax M2.5', 'openrouter', 'minimax/minimax-01', 0.50, 0.50, '{"temperature": 0}'),
('DeepSeek R1', 'openrouter', 'deepseek/deepseek-r1', 0.55, 0.55, '{"temperature": 0}'),
('Claude Sonnet 4', 'anthropic', 'claude-sonnet-4-20250514', 3.00, 15.00, '{"temperature": 0}'),
('Gemini Flash 2', 'openrouter', 'google/gemini-flash-2.0', 0.075, 0.30, '{"temperature": 0}');
````

---

## 🎯 MELHORIAS IMEDIATAS (Aprovadas)

### **1. CLAUDE.md (Pattern Industry Standard)**

Arquivo na raiz com padrões do projeto que agentes leem automaticamente.

**Conteúdo:**
````markdown
# Renov Home - Padrões de Desenvolvimento

## Stack Obrigatório
- Frontend: React 18 + TypeScript + shadcn/ui
- Backend: Node.js + Express + Drizzle ORM
- Database: PostgreSQL (Supabase dev / Neon prod)
- Routing: Wouter (NÃO React Router)
- State: TanStack Query (NÃO Redux)
- UI: shadcn/ui (Radix + Tailwind)
- Icons: Lucide React

## Nunca Usar
- ❌ Material-UI, Ant Design, Chakra UI
- ❌ Prisma, TypeORM, Sequelize
- ❌ Redux, MobX, Zustand
- ❌ React Router (usar Wouter)

## Padrões de Código
- Arquivos: kebab-case
- Componentes: PascalCase
- Funções: camelCase
- Database: snake_case
- Validação: Sempre Zod
- Formulários: React Hook Form
- Componentes: SEMPRE shadcn/ui

## Estrutura de Pastas
client/src/
  pages/[modulo]/
  components/
  hooks/
  lib/

server/
  routes.ts
  storage.ts
  ai/

shared/
  schema.ts (fonte da verdade)

## Regras de Negócio
- Sempre validar permissões (frontend + backend)
- Macgyver IA é 100% privado por usuário
- Chamados são públicos para todos
- Projetos têm visibilidade controlada
````

### **2. ReAct Loop (Reason + Act)**

Coder raciocina antes de corrigir (não apenas regenera código).
````typescript
// Ao invés de:
if (erro) → gerar_codigo_novo()

// Fazer:
if (erro) {
  → raciocinar("Liste 5 causas possíveis para este erro")
  → entender_causa_raiz()
  → corrigir_baseado_em_raciocínio()
}
````

### **3. Metrics Tracking**

Salvar performance de cada execução para melhorar sistema.
````typescript
interface Metrics {
  success: boolean;
  cost: number;          // $0.012
  time: number;          // 105s
  tentativas: number;    // 2
  modelo: string;        // "minimax-m2.5"
  erros_corrigidos: number;
}
````

---

## 🖥️ CLI (renov-dev)

### **Comandos:**
````bash
# Executar plan
renov-dev run plans/git-analytics-v5

# Opções
renov-dev run plans/nome --model minimax-m2.5  # Escolher modelo
renov-dev run plans/nome --auto                 # Sem pausas
renov-dev run plans/nome --dry-run              # Simular

# Listar modelos
renov-dev models

# Adicionar modelo (interativo)
renov-dev models add

# Adicionar modelo (direto)
renov-dev models add \
  --name "Llama 3.3 70B" \
  --provider openrouter \
  --model-id "meta-llama/llama-3.3-70b-instruct" \
  --cost-in 0.35 \
  --cost-out 0.40

# Ativar/desativar modelo
renov-dev models toggle 3

# Listar plans executados
renov-dev plans
renov-dev plans --status completed
renov-dev plans --limit 10

# Ver logs de execução
renov-dev logs abc-123
````

---

## 📋 FORMATO DO PLAN

### **Estrutura:**
````markdown
# [Título da Feature]

Descrição opcional (será ignorada)

## PROMPT 1: [Título da Fase]
[Instruções completas para o modelo]

Arquivo: [caminho principal]
[Orientações específicas]

## PROMPT 2: [Título da Fase]
[Instruções completas]

## PROMPT 3: [Título da Fase]
[Instruções completas]
````

### **Exemplo Real:**
````markdown
# Git Analytics V5 - Filtros Avançados

Adicionar capacidade de filtrar commits por repo, desenvolvedor e período.

## PROMPT 1: Backend - API de Filtros

Criar endpoint GET /api/git-analytics/filter que aceita:
- repoId: string (opcional)
- devName: string (opcional)
- startDate: ISO string (opcional)
- endDate: ISO string (opcional)

Arquivo principal: server/routes/git-analytics.ts

Regras:
- Usar Drizzle ORM
- Validar params com Zod
- Retornar JSON: {commits: [...], total: number}
- Aplicar paginação (limit 100)

## PROMPT 2: Frontend - Componentes

Criar componente FilterBar.tsx em client/src/components/git-analytics/

Deve renderizar:
- Select de repositórios (usar hook useRepositories existente)
- Select de desenvolvedores (carregar de API)
- DateRangePicker do shadcn/ui

Props:
```typescript
interface FilterBarProps {
  onFilterChange: (filters: Filters) => void;
}
```

Usar TanStack Query para state management.

## PROMPT 3: Integração

Atualizar client/src/pages/git-analytics/index.tsx:
- Importar FilterBar
- Passar callback onFilterChange
- Atualizar hook useGitAnalytics para aceitar filtros
- Recarregar dados quando filtros mudarem

## PROMPT 4: Polish

- Adicionar skeleton loading nos Selects
- Mensagem "Nenhum resultado" quando filtros não retornam dados
- Validar datas (end >= start)
- Adicionar botão "Limpar filtros"
````

---

## ⚙️ CONFIGURAÇÕES

### **Variáveis de Ambiente (.env)**
````bash
# OpenRouter (já configurado)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Anthropic (já configurado)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Email (usar configs existentes)
# SMTP já configurado no projeto
````

### **Modelos Dinâmicos via API**
- Buscar modelos direto da API OpenRouter
- Salvar automaticamente no BD
- Usuário só escolhe na hora de executar

### **Notificação por Email**
- Usar tabela `users` existente
- SMTP já configurado
- Template HTML responsivo

---

## 🚧 PROBLEMAS CONHECIDOS (V1)

1. ❌ **Atlas V4** com erro de sintaxe (template strings em heredoc)
2. ❌ **index.ts** sem workflow de refinamento
3. ❌ **Heredocs/Python** não funcionam bem (escaping)
4. ❌ **Cache Node.js** causou problemas (resolver com rm -rf)
5. ⚠️ **iMac com Git travado** (usar Macbook)

**Solução:** Evitar heredocs longos, usar métodos mais simples.

---

## 💰 CUSTOS ESTIMADOS

### **Por Feature:**
| Modelo | Custo/Feature | Assertividade |
|--------|---------------|---------------|
| Minimax M2.5 | $0.50-1.00 | 85% |
| DeepSeek R1 | $0.55-1.10 | 87% |
| Claude Sonnet 4 | $3.00-5.00 | 95% |
| Gemini Flash 2 | $0.08-0.20 | 80% |

### **ROI:**
- Tempo economizado: 2.5h/feature
- Valor do tempo: $125/feature
- Custo médio: $1.00/feature
- **ROI: 12.400%**

### **Mensal (20 features):**
- Custo: $20/mês
- Economia: $2.500/mês
- **ROI: 12.400%**

---

## 🎯 PRÓXIMOS PASSOS

### **Fase 1: Setup Base (1 dia)**
1. ✅ Criar branch `feat-agents-v2`
2. ✅ Criar `CLAUDE.md`
3. ✅ Criar estrutura `/plans`
4. ✅ Criar `/server/ai/agents`
5. ✅ Criar migrations (tabelas novas)
6. ✅ Seed modelos iniciais

### **Fase 2: Serviços (meio dia)**
1. ✅ OpenRouter Service
2. ✅ Email Service (usar existente)
3. ✅ Parser de Plans (.md)

### **Fase 3: Agentes (2 dias)**
1. ✅ Orchestrator (coordenador)
2. ✅ Coder (com ReAct Loop + Metrics)
3. ✅ Monitor (validador paralelo)
4. ✅ Turing (migrar V3 + melhorias)
5. ✅ Giter (migrar V2 + melhorias)

### **Fase 4: CLI (meio dia)**
1. ✅ renov-dev básico
2. ✅ Comandos run, models, plans, logs
3. ✅ Interface interativa

### **Fase 5: Testes (1 dia)**
1. ✅ Plan simples (1 prompt)
2. ✅ Plan médio (3-4 prompts)
3. ✅ Teste com erro (correção automática)
4. ✅ Validar workflow completo
5. ✅ Teste com diferentes modelos

### **Fase 6: Documentação (meio dia)**
1. ✅ README completo
2. ✅ Exemplos de plans
3. ✅ Troubleshooting guide

**Total estimado: 5-6 dias**

---

## 📚 REFERÊNCIAS IMPORTANTES

### **Padrões Aplicados (Research Anterior):**
- ✅ **ReAct Loop** (Reason + Act) - Correções inteligentes
- ✅ **CLAUDE.md pattern** - Contexto automático para agentes
- ✅ **Multi-agent coordination** - Especialização + coordenação
- ✅ **Self-improving loops** - Sistema aprende com execuções
- ✅ **Tool use pattern** - Agentes decidem ferramentas
- ✅ **Debugging workflows** - Raciocinar antes de corrigir

### **Artigos de Referência:**
- Anthropic: Claude Code Best Practices
- Google Cloud: What is Agentic Coding
- Medium: Agentic Coding Workflows 10x Development
- ByteByteGo: Top AI Agentic Workflow Patterns

### **Documentação V1:**
- `docs/agents/STATUS.md` - Status V1
- `docs/agents/README.md` - Visão geral V1
- `docs/agents/GUIA-USO.md` - Como usar V1

---

## 🔧 AMBIENTE

- **Máquina:** Macbook (iMac com problema de Git)
- **Localização:** `~/Documents/Workspaces/Renov-Home2/Renov.Home`
- **Branch:** `feat-agents-v2`
- **Stack:** React 18, Node.js, Express, PostgreSQL, Drizzle ORM
- **Node:** v24.13.1
- **Package Manager:** npm

---

## ✅ STATUS ATUAL

- ✅ Arquitetura V2 100% aprovada
- ✅ Documentação completa e detalhada
- ✅ Melhorias definidas (CLAUDE.md, ReAct, Metrics)
- ✅ V1 commitado e PR publicado
- ✅ Branch `feat-agents-v2` criada
- ⏳ **PRONTO PARA IMPLEMENTAR V2**

---

## 🎯 PRIMEIRA AÇÃO

### **Começar por:**
1. Criar `CLAUDE.md` na raiz
2. Criar estrutura de pastas (`/plans`, `/server/ai`)
3. Migrations do BD (3 tabelas + seed)
4. OpenRouter Service básico
5. Testar conexão com OpenRouter

### **Comando Inicial:**
````bash
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home

# Verificar branch
git branch

# Deve mostrar: * feat-agents-v2
````

---

## 📞 SUPORTE

Este documento contém TODO o contexto necessário para implementação.

Em caso de dúvidas:
- Consultar documentação V1 em `docs/agents/`
- Revisar arquitetura acima
- Seguir padrões do `CLAUDE.md`

---

**FIM DO CONTEXTO - READY TO START! 🚀**
