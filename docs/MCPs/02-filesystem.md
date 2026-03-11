# Filesystem MCP

> Acesso controlado ao sistema de arquivos local — leitura, escrita e navegação de arquivos.

## Pacote
`@modelcontextprotocol/server-filesystem`

## Casos de Uso neste Projeto
- Ler e editar arquivos do projeto sem copiar/colar manualmente no chat
- Navegar pela estrutura de pastas (`client/`, `server/`, `shared/`, `docs/`)
- Criar novos arquivos de componentes, rotas ou utilitários
- Ler arquivos de configuração (`package.json`, `tsconfig.json`, `drizzle.config.ts`)
- Inspecionar arquivos grandes como `shared/schema.ts` (72KB) sem sobrecarregar o contexto

## Configuração no `.mcp.json`
```json
"filesystem": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/Users/matheusmundstock/workspaces/renov.home.imac"
  ]
}
```

## Variáveis de Ambiente
Nenhuma necessária.

## Exemplos de Uso
```
"Liste todos os arquivos em server/routes/"
"Leia o conteúdo de shared/schema.ts"
"Crie o arquivo client/src/components/StatusBadge.tsx"
"Quais arquivos foram modificados recentemente em client/src/pages/?"
"Mostre a estrutura de pastas do diretório server/"
```

## Segurança
- O acesso é **restrito ao diretório do projeto** (`/Users/matheusmundstock/workspaces/renov.home.imac`)
- Para acessar outros diretórios (ex: Downloads), adicione como argumento extra no `.mcp.json`
- Arquivos sensíveis como `.env` ficam acessíveis — use com consciência

## Notas
- Este MCP é complementar às ferramentas nativas do Claude Code (Read, Edit, Write, Glob, Grep)
- Útil principalmente quando o Claude precisa de contexto mais amplo sobre a estrutura de arquivos
