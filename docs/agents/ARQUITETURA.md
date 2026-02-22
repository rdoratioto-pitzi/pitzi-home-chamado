# 🏗️ Arquitetura do Sistema

## 📊 Visão Geral
```
┌─────────────┐
│   USUÁRIO   │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
   ┌───▼───┐    ┌───▼────┐
   │ ATLAS │    │ TURING │
   │  V3   │    │   V2   │
   └───┬───┘    └───┬────┘
       │            │
       │        ┌───▼────┐
       │        │ GITER  │
       │        └────────┘
       │
   ┌───▼─────────┐
   │  KILO CODE  │
   └─────────────┘
```

## 🤖 Agentes

### Atlas V3 (Planejador)

**Arquivo:** `src/agents/atlas.ts`  
**Modelo:** Claude Sonnet 4  
**Parâmetros:**
- Temperature: 0
- MaxTokens: 300

**Entrada:**
- `requisito: string` - Descrição da feature

**Saída:**
- `planoDetalhado: string` - Plano técnico markdown (~150 tokens)

**Prompt:** Minimalista, foca em objetivo + arquivos + fluxo + checklist

**Exemplo Output:**
```markdown
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
```

---

### Turing V2 (Validador QA)

**Arquivo:** `src/agents/turing.ts`  
**Função:** Validação de código + Auto-correção

**Validações:**
1. TypeScript compilation (`npx tsc --noEmit`)
2. ESLint (`npx eslint . --ext .ts,.tsx`)

**Fluxo:**
```typescript
1. verificarCompilacao() → boolean
2. verificarESLint() → { erros: number }
3. SE erros:
   - buscarErrosTypeScript() → string
   - atlas({ requisito: "Corrigir erros..." })
   - Mostrar plano de correção
4. RETORNAR { qaAprovado: boolean }
```

**Saída:**
- `qaAprovado: true` → Giter executa
- `qaAprovado: false` → Bloqueia commit

---

### Giter (Automação Git)

**Arquivo:** `src/agents/giter.ts`  
**Função:** Commit + Push automático

**Pré-condição:**
```typescript
if (!state.qaAprovado) {
  console.log('QA não aprovado - abortando');
  return;
}
```

**Execução:**
```bash
1. git branch --show-current
2. git status --porcelain
3. git add .
4. git commit -m "feat: {requisito}\n\nValidado por Turing ✅"
5. git push origin {branch}
```

---

## 🔄 Orquestração (LangGraph)

**Arquivo:** `src/orchestrator.ts`

### Workflow 1: Atlas
```typescript
StateGraph → addNode('atlas') → setEntryPoint → END
```

### Workflow 2: Turing + Giter
```typescript
StateGraph
  → addNode('turing')
  → addNode('giter')
  → setEntryPoint('turing')
  → addConditionalEdges(
      'turing',
      (state) => state.qaAprovado ? 'giter' : 'fim'
    )
```

---

## 📁 Estado Compartilhado (AgentState)
```typescript
interface AgentState {
  requisito: string;
  planoDetalhado: string | null;
  planoAprovado: boolean;
  relatorioQA: string | null;
  qaAprovado: boolean;
  branchName: string | null;
  commits: Array<{ arquivo: string; mensagem: string }>;
  etapaAtual: string;
  device: 'mac' | 'pc' | 'unknown';
}
```

---

## 💾 Armazenamento de Planos

**Diretório:** `agents/.planos/`

**Estrutura:**
```
.planos/
├── plano-2024-02-21T14-30-00.md  # Histórico
├── plano-2024-02-21T15-45-00.md
└── ultimo-plano.md                # Referência atual
```

**Formato:**
```markdown
# Plano Aprovado

**Requisito:**
[requisito original + refinamentos]

**Plano:**
[plano gerado por Atlas]

**Data:** [timestamp]
```

---

## 🔧 Configuração

**Arquivo:** `src/config.ts`
```typescript
export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
  },
  paths: {
    renovHome: '/Users/macbookm2/.../Renov.Home',
  },
};
```

---

## 📊 Fluxo de Dados
```
┌─────────┐
│ USUÁRIO │
└────┬────┘
     │ requisito
     ▼
┌─────────────┐
│   ATLAS     │
│ temperature │ ← Anthropic API
│ maxTokens   │
└─────┬───────┘
      │ planoDetalhado
      ▼
┌─────────────┐
│ .planos/    │ (salvo)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ KILO CODE   │ (implementa)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│   TURING    │
│ tsc         │ ← execSync
│ eslint      │
└─────┬───────┘
      │ qaAprovado
      ▼
┌─────────────┐
│   GITER     │
│ git add     │ ← execSync
│ git commit  │
│ git push    │
└─────────────┘
```

---

## 🔐 Segurança

- ✅ API keys em `.env` (não commitado)
- ✅ `.planos/` em `.gitignore`
- ✅ Validação antes de push
- ✅ Sem bypass de QA
