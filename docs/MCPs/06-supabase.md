# Supabase MCP (Oficial — Remote)

> Acesso completo ao projeto Supabase via HTTP — tabelas, migrations, logs, RLS e mais.

## Tipo
HTTP remoto — servidor oficial hospedado pela Supabase em `mcp.supabase.com`

## Casos de Uso neste Projeto
- Gerenciar tabelas e executar migrations SQL diretamente
- Executar queries completas (leitura + escrita) com permissões totais
- Visualizar logs de erros e slow queries do banco
- Criar e alterar políticas RLS (Row Level Security)
- Monitorar performance e uso do banco de dados
- Gerenciar storage buckets e edge functions

## Configuração no `.mcp.json`
```json
"supabase": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=qdjtwguxcghzonokihgv"
}
```

## Autenticação
Usa **OAuth2 via browser** — sem necessidade de token manual no `.env`.

Na primeira execução, o Claude Code abrirá o browser para autenticação com sua conta Supabase. O token é armazenado automaticamente e renovado conforme necessário.

## Project Reference
`qdjtwguxcghzonokihgv` (extraído do `DATABASE_URL` existente no `.env`)

O `project_ref` na URL **restringe o MCP a este projeto específico**, evitando acesso acidental a outros projetos Supabase da conta.

## Exemplos de Uso
```
"Liste todas as tabelas no projeto Supabase"
"Execute esta migration SQL: ALTER TABLE tasks ADD COLUMN..."
"Verifique os logs de erro das últimas 24 horas"
"Mostre as políticas RLS da tabela tasks"
"Qual é o uso atual de storage do bucket de uploads?"
"Mostre as queries mais lentas do banco"
```

## Comparação com PostgreSQL MCP

| | PostgreSQL MCP | Supabase MCP |
|---|---|---|
| **Tipo** | stdio (local) | HTTP (remoto) |
| **Operações** | Apenas SELECT (read-only) | CRUD completo |
| **Autenticação** | DATABASE_URL | OAuth via browser |
| **Acesso a logs** | Não | Sim |
| **Acesso a RLS** | Não | Sim |
| **Recomendado para** | Inspeção rápida | Gerenciamento completo |

## Notas
- MCP oficial mantido pela equipe Supabase — mais seguro que o PostgreSQL MCP depreciado
- Requer autenticação via browser apenas na primeira vez (ou ao expirar)
- URL de acesso ao Supabase Studio: [supabase.com/dashboard/project/qdjtwguxcghzonokihgv](https://supabase.com/dashboard/project/qdjtwguxcghzonokihgv)
