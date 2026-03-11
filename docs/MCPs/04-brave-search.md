# Brave Search MCP

> Busca web com foco em privacidade — sem rastreamento, sem bolha de filtros.

## Pacote
`@modelcontextprotocol/server-brave-search`

## Casos de Uso neste Projeto
- Pesquisar documentação de bibliotecas usadas (Drizzle ORM, shadcn/ui, TanStack Query v5)
- Buscar soluções para erros TypeScript/React específicos
- Verificar changelogs e breaking changes antes de atualizar dependências
- Encontrar exemplos de implementação para novas features
- Pesquisar APIs externas integradas ao projeto (Omie, Correios)

## Configuração no `.mcp.json`
```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "${BRAVE_API_KEY}"
  }
}
```

## Variáveis de Ambiente
| Variável | Descrição | Status |
|---|---|---|
| `BRAVE_API_KEY` | Chave da API Brave Search | Necessário cadastro |

## Como Obter a API Key
1. Acessar [brave.com/search/api](https://brave.com/search/api/)
2. Criar conta ou fazer login
3. Selecionar plano **Free** (2.000 req/mês — suficiente para dev)
4. Gerar API key no dashboard
5. Adicionar ao `.env`: `BRAVE_API_KEY=BSA...`

**Custo:** Gratuito até 2.000 req/mês. Planos pagos para volumes maiores.

## Exemplos de Uso
```
"Pesquise como usar Drizzle ORM com array fields no PostgreSQL"
"Busque exemplos de shadcn/ui DataTable com server-side pagination"
"Qual é a última versão estável do TanStack Query v5?"
"Pesquise soluções para erro 'Cannot read properties of undefined' no React 18"
"Busque documentação da API do Omie para módulo de clientes"
```

## Notas
- Diferente do WebSearch nativo do Claude, que usa o Google — o Brave Search preserva mais privacidade
- Ideal para pesquisas técnicas onde você quer resultados sem personalização
- O plano gratuito é mais que suficiente para o uso diário de desenvolvimento
