# GitHub MCP

> Gerencia repositórios, PRs, issues e branches diretamente pelo Claude Code.

## Pacote
`@modelcontextprotocol/server-github`

## Casos de Uso neste Projeto
- Criar e revisar PRs para features (ex: `feat-projetos-status-card`, `feat-reunioes-templates`)
- Consultar e criar issues para bugs reportados
- Listar branches ativas e status do repositório
- Buscar commits, histórico e diffs de mudanças
- Verificar status de CI/CD e checks em PRs

## Configuração no `.mcp.json`
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

## Variáveis de Ambiente
| Variável | Descrição | Status |
|---|---|---|
| `GITHUB_TOKEN` | Token do GitHub (já existe no `.env`) | Existente |

O MCP espera a variável `GITHUB_PERSONAL_ACCESS_TOKEN`, mas aqui mapeamos o `GITHUB_TOKEN` existente — sem necessidade de criar nova variável.

**Permissões necessárias no token:**
- `repo` (read/write) — para PRs, issues, branches
- `pull_requests` — para criar e revisar PRs
- `issues` — para criar e comentar issues

## Exemplos de Uso
```
"Liste todos os PRs abertos no repositório"
"Crie uma issue para o bug de validação no modal de reuniões"
"Mostre o diff do PR #80"
"Quais branches foram criadas esta semana?"
"Qual é o status do último commit no main?"
```

## Notas
- O token `GITHUB_TOKEN` existente foi criado para o módulo Git Analytics — as permissões já devem ser suficientes
- Repositório principal: `Renov-BD/renov-home` (conforme histórico de PRs)
- Para operações de escrita (criar PR, comentar issue), o token precisa de escopo `repo` completo
