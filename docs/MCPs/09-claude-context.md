# Claude Context MCP

> Busca semântica em todo o codebase — encontre código por significado, não por texto exato.

## Pacote
`@zilliz/claude-context-mcp`

## Por que usar?
Codebases grandes (como este projeto com arquivos de 2.300+ linhas) consomem muito do contexto do Claude. O Claude Context indexa o código em um banco vetorial e permite buscas semânticas — reduzindo ~40% o uso de tokens.

## Casos de Uso neste Projeto
- Encontrar onde um padrão é usado sem saber o nome exato: "onde são feitas queries com join?"
- Buscar por semântica: "onde são tratados erros de autenticação?"
- Navegar em `shared/schema.ts` (72KB) e `reunioes/index.tsx` (2.300 linhas) de forma focada
- Responder "como funciona X?" sem carregar todos os arquivos no contexto
- Encontrar todas as ocorrências de um conceito espalhadas pelo projeto

## Configuração no `.mcp.json`
```json
"claude-context": {
  "command": "npx",
  "args": ["@zilliz/claude-context-mcp@latest"],
  "env": {
    "OPENAI_API_KEY": "${OPENAI_API_KEY}",
    "MILVUS_ADDRESS": "${MILVUS_ADDRESS}",
    "MILVUS_TOKEN": "${MILVUS_TOKEN}"
  }
}
```

## Variáveis de Ambiente
| Variável | Descrição | Como obter |
|---|---|---|
| `OPENAI_API_KEY` | API key OpenAI para embeddings | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `MILVUS_ADDRESS` | Endpoint do cluster Zilliz Cloud | [cloud.zilliz.com](https://cloud.zilliz.com/) |
| `MILVUS_TOKEN` | API key do cluster Zilliz Cloud | [cloud.zilliz.com](https://cloud.zilliz.com/) |

## Setup Inicial (passo a passo)

### 1. Criar cluster Zilliz Cloud (gratuito)
1. Criar conta em [cloud.zilliz.com](https://cloud.zilliz.com/)
2. Criar novo cluster — selecionar **Serverless** (gratuito)
3. Copiar o **Public Endpoint** → `MILVUS_ADDRESS`
4. Gerar **API Key** no dashboard → `MILVUS_TOKEN`

### 2. Obter API key OpenAI
1. Acessar [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Criar nova key → `OPENAI_API_KEY`
3. Créditos mínimos necessários para indexação (~$0.50 para codebase médio)

### 3. Preencher `.env`
```bash
OPENAI_API_KEY=sk-...
MILVUS_ADDRESS=https://seu-cluster.zillizcloud.com
MILVUS_TOKEN=sua-api-key-zilliz
```

### 4. Indexar o codebase (uma vez)
```bash
npx @zilliz/claude-context-mcp@latest index /Users/matheusmundstock/workspaces/renov.home.imac
```

Reindexar quando houver grandes mudanças no código.

## Requisitos de Compatibilidade
- Node.js >= 20 e **< 24** — projeto usa v22.21.0 ✅
- **Não atualizar para Node 24** até nova release do pacote

## Exemplos de Uso
```
"Onde no codebase é feita a validação de tenantId?"
"Mostre todos os endpoints que retornam tarefas"
"Como o cron de recorrência funciona?"
"Onde são usados os custom hooks de autenticação?"
"Quais componentes usam o TanStack Query para buscar reuniões?"
```

## Notas
- Este é o MCP de setup mais complexo — deixar para depois dos outros
- O índice vetorial é mantido no Zilliz Cloud, não localmente
- Custo OpenAI: tiny (< $1 para indexar o projeto inteiro)
- Custo Zilliz: tier gratuito suficiente para este projeto
