# MCPs do Projeto renov.home.imac

> Model Context Protocol servers ampliam as capacidades do Claude Code, conectando-o a ferramentas externas, bancos de dados e serviços.

## O que são MCPs?

MCPs (Model Context Protocol) são servidores que expõem ferramentas e recursos para o Claude Code usar durante as sessões. Com eles, o Claude pode acessar o GitHub, o banco de dados, fazer buscas na web, automatizar browsers e muito mais — sem precisar sair da conversa.

**Arquivo de configuração:** `.mcp.json` na raiz do projeto (versionado, sem secrets).

---

## Tabela de MCPs Configurados

| # | MCP | Pacote npm | Tipo | API Key | Status |
|---|-----|------------|------|---------|--------|
| 01 | [GitHub](./01-github.md) | `@modelcontextprotocol/server-github` | stdio | `GITHUB_TOKEN` (existente) | Pronto |
| 02 | [Filesystem](./02-filesystem.md) | `@modelcontextprotocol/server-filesystem` | stdio | — | Pronto |
| 03 | [Puppeteer](./03-puppeteer.md) | `@modelcontextprotocol/server-puppeteer` | stdio | — | Pronto |
| 04 | [Brave Search](./04-brave-search.md) | `@modelcontextprotocol/server-brave-search` | stdio | `BRAVE_API_KEY` | Requer cadastro |
| 05 | [PostgreSQL](./05-postgres.md) | `@modelcontextprotocol/server-postgres` | stdio | `DATABASE_URL` (existente) | Pronto |
| 06 | [Supabase](./06-supabase.md) | HTTP remoto `mcp.supabase.com` | http | OAuth via browser | Pronto |
| 07 | [Firecrawl](./07-firecrawl.md) | `firecrawl-mcp` | stdio | `FIRECRAWL_API_KEY` | Requer cadastro |
| 08 | [Memory](./08-memory.md) | `@modelcontextprotocol/server-memory` | stdio | — | Pronto |
| 09 | [Claude Context](./09-claude-context.md) | `@zilliz/claude-context-mcp` | stdio | `OPENAI_API_KEY` + Zilliz | Setup necessário |
| 10 | [Playwright](./10-playwright.md) | `@playwright/mcp` | stdio | — | Pronto* |
| 11 | [Sequential Thinking](./11-sequential-thinking.md) | `@modelcontextprotocol/server-sequential-thinking` | stdio | — | Pronto |
| 12 | [ReactBits](./12-reactbits.md) | `reactbits-dev-mcp-server` | stdio | — | Pronto |
| 13 | [PDF Reader](./13-pdf-reader.md) | `@sylphx/pdf-reader-mcp` | stdio | — | Pronto |

\* Playwright requer `npx playwright install chromium` na primeira execução.

---

## Variáveis de Ambiente

### Já existentes no `.env` (reaproveitadas)
| Variável | Usada por |
|---|---|
| `GITHUB_TOKEN` | GitHub MCP |
| `DATABASE_URL` | PostgreSQL MCP |

### Novas variáveis necessárias
| Variável | MCP | Como obter |
|---|---|---|
| `BRAVE_API_KEY` | Brave Search | [brave.com/search/api](https://brave.com/search/api/) — gratuito (2k req/mês) |
| `FIRECRAWL_API_KEY` | Firecrawl | [firecrawl.dev](https://www.firecrawl.dev/) — plano gratuito |
| `OPENAI_API_KEY` | Claude Context | [platform.openai.com](https://platform.openai.com/api-keys) |
| `MILVUS_ADDRESS` | Claude Context | [cloud.zilliz.com](https://cloud.zilliz.com/) — cluster gratuito |
| `MILVUS_TOKEN` | Claude Context | [cloud.zilliz.com](https://cloud.zilliz.com/) — API key |

---

## Ordem de Ativação Recomendada

### Fase 1 — Sem configuração adicional (ative agora)
1. `filesystem` — acesso a arquivos locais do projeto
2. `sequential-thinking` — raciocínio estruturado (oficial Anthropic)
3. `memory` — memória persistente entre sessões
4. `playwright` — testes E2E e automação web
5. `puppeteer` — screenshots para documentar bugs

### Fase 2 — Credenciais já no `.env` (ative agora)
6. `github` — gerenciamento de PRs, issues e branches
7. `postgres` — inspeção direta do banco de dados
8. `supabase` — autenticar via browser na primeira execução

### Fase 3 — Requer novos cadastros gratuitos
9. `brave-search` — busca web com privacidade
10. `firecrawl` — web scraping de documentação

### Fase 4 — Setup mais elaborado
11. `reactbits` — componentes React animados
12. `pdf-reader` — leitura de arquivos PDF
13. `claude-context` — busca semântica no codebase (requer Zilliz + OpenAI)

---

## Como Ativar

1. Preencher as variáveis de ambiente necessárias no `.env`
2. Reiniciar o Claude Code
3. Verificar: `claude mcp list`

---

## Notas Importantes

- O arquivo `.mcp.json` usa `${VAR_NAME}` para referenciar env vars — **nunca hardcode secrets**
- `.mcp-memory.json` está no `.gitignore` — não versionar estado de memória pessoal
- PostgreSQL MCP: uso exclusivo para dev local (pacote depreciado, read-only por design)
- Claude Context MCP: requer Node.js >= 20 e < 24 — projeto usa v22 (compatível)
- Next.js DevTools MCP foi **excluído** — projeto usa Vite, não Next.js
