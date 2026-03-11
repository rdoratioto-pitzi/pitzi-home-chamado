# PostgreSQL MCP

> Acesso direto read-only ao banco de dados PostgreSQL para inspeção e diagnóstico.

## Pacote
`@modelcontextprotocol/server-postgres`

## ⚠️ Aviso de Segurança
Este pacote foi **depreciado** e possui vulnerabilidade de SQL injection conhecida.
**Uso exclusivamente em ambiente de desenvolvimento local.**

Para operações completas (leitura + escrita) em produção, usar o **[Supabase MCP](./06-supabase.md)**.

## Casos de Uso neste Projeto
- Inspecionar schema das tabelas (`tasks`, `users`, `tenants`, `task_templates`, etc.)
- Executar queries de diagnóstico sem abrir o Supabase Studio
- Verificar dados após rodar `npx drizzle-kit push`
- Debugar queries do `storage.ts` com dados reais
- Contar registros, verificar índices, analisar dados de produção (somente leitura)

## Configuração no `.mcp.json`
```json
"postgres": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
}
```

## Variáveis de Ambiente
| Variável | Descrição | Status |
|---|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL (já existe no `.env`) | Existente |

## Exemplos de Uso
```
"Liste todas as tabelas do banco de dados"
"Mostre a estrutura da tabela tasks com tipos e constraints"
"Quantos registros existem na tabela tasks por tenant?"
"Verifique os índices da tabela tasks"
"Quais colunas tem a tabela task_templates?"
"Mostre os últimos 5 registros criados na tabela tasks"
```

## Schema Principal (referência rápida)
```sql
-- Tabelas principais do projeto
tasks            -- tarefas e reuniões (type="meeting_note" para reuniões)
task_templates   -- templates de reuniões e tarefas
users            -- usuários do sistema
tenants          -- empresas/clientes (multi-tenant)
projects         -- módulo de projetos
```

## Alternativa: Supabase MCP
Para operações que precisam de escrita ou acesso ao Supabase Studio via MCP, usar o [06-supabase.md](./06-supabase.md).

## Notas
- O `DATABASE_URL` aponta para o banco Supabase (`qdjtwguxcghzonokihgv`) — é o mesmo banco de produção
- Só executa queries `SELECT` por design — sem risco de alterar dados acidentalmente
- Não atualizar para versões depreciadas; manter na versão atual enquanto for suficiente
