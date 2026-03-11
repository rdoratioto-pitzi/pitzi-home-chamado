# Firecrawl MCP

> Web scraping avançado com suporte a JavaScript rendering, crawling e extração estruturada.

## Pacote
`firecrawl-mcp` (oficial Firecrawl)

## Casos de Uso neste Projeto
- Extrair documentação técnica de sites para contexto no Claude (ex: docs do Drizzle ORM)
- Scraping de APIs externas integradas ao projeto (Omie, Correios) para documentar endpoints
- Crawling de páginas com conteúdo dinâmico (React/Vue) que o fetch simples não consegue
- Extrair dados estruturados de páginas web para importação no sistema
- Ler changelogs e release notes de bibliotecas para avaliar atualizações

## Configuração no `.mcp.json`
```json
"firecrawl": {
  "command": "npx",
  "args": ["-y", "firecrawl-mcp"],
  "env": {
    "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
  }
}
```

## Variáveis de Ambiente
| Variável | Descrição | Status |
|---|---|---|
| `FIRECRAWL_API_KEY` | Chave da API Firecrawl | Necessário cadastro |

## Como Obter a API Key
1. Criar conta em [firecrawl.dev](https://www.firecrawl.dev/)
2. Acessar o dashboard em [app.firecrawl.dev](https://app.firecrawl.dev/)
3. Ir em **API Keys** no menu lateral
4. Clicar em **Generate New Key**
5. Adicionar ao `.env`: `FIRECRAWL_API_KEY=fc-...`

**Custo:** Plano gratuito disponível com limite de requisições mensais.

## Diferença vs Brave Search

| | Brave Search MCP | Firecrawl MCP |
|---|---|---|
| **Propósito** | Buscar URLs relevantes | Extrair conteúdo de URLs específicas |
| **Entrada** | Query de texto | URL de página |
| **Saída** | Lista de resultados | Conteúdo completo da página (markdown) |
| **JavaScript** | Não renderiza | Renderiza completamente |
| **Use quando** | "Encontre páginas sobre X" | "Extraia o conteúdo desta URL" |

## Exemplos de Uso
```
"Faça scraping da documentação do Drizzle ORM em orm.drizzle.team/docs/get-started"
"Extraia os endpoints disponíveis na documentação da API do Omie"
"Crawle o site de documentação do shadcn/ui e me explique os componentes disponíveis"
"Leia a página de changelog do TanStack Query e resume as mudanças da v5"
"Extraia os dados desta página de lista de preços para montar uma tabela comparativa"
```

## Notas
- Melhor que fetch simples para páginas com conteúdo renderizado por JavaScript
- Retorna conteúdo em formato Markdown — ideal para processar com o Claude
- Suporta crawling recursivo de sites inteiros (cuidado com limites de rate)
