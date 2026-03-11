# Memory MCP

> Memória persistente entre sessões via knowledge graph local — o Claude lembra das sessões anteriores.

## Pacote
`@modelcontextprotocol/server-memory`

## Por que usar?
Sem memória, o Claude começa "do zero" em cada sessão — você precisa re-explicar o contexto do projeto. Com o Memory MCP, é possível salvar decisões, padrões e contexto que persistem entre conversas.

## Casos de Uso neste Projeto
- Lembrar decisões arquiteturais tomadas em sessões anteriores
- Armazenar contexto de features em desenvolvimento (ex: estado atual do módulo Projetos)
- Registrar padrões de código específicos acordados com o time
- Manter histórico de bugs conhecidos e suas soluções
- Salvar convenções de nomenclatura e estruturas de dados do projeto

## Configuração no `.mcp.json`
```json
"memory": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": {
    "MEMORY_FILE_PATH": "/Users/matheusmundstock/workspaces/renov.home.imac/.mcp-memory.json"
  }
}
```

## Variáveis de Ambiente
| Variável | Valor configurado |
|---|---|
| `MEMORY_FILE_PATH` | `.mcp-memory.json` na raiz do projeto |

## Arquivo de Memória
- **Localização:** `/Users/matheusmundstock/workspaces/renov.home.imac/.mcp-memory.json`
- **Formato:** Knowledge graph em JSON (entidades e relações)
- **Gitignore:** Sim — não versionado (`.gitignore` já inclui `.mcp-memory.json`)

## Exemplos de Uso
```
"Lembre que a coluna meetingData é um JSON serializado como TEXT no schema — não é JSONB"
"Salve que o tenant padrão de desenvolvimento tem ID 1"
"Lembre que o port do dev server é 5050, não 3000"
"Quais decisões arquiteturais foram salvas sobre o módulo de reuniões?"
"Salve que a branch principal de desenvolvimento é 'develop', não 'main'"
"O que você sabe sobre o projeto renov.home?"
```

## Notas
- A memória é **local ao desenvolvedor** — não é compartilhada com outros membros do time
- Para memória compartilhada de equipe, usar os arquivos em `docs/` (versionados no git)
- O knowledge graph usa entidades e relações — mais estruturado que simples texto
- Complementa (não substitui) o arquivo `MEMORY.md` do Claude Code (`~/.claude/projects/...`)
