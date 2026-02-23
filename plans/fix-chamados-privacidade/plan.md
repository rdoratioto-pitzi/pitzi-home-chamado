# Fix: Chamados - Filtrar por Usuário (Privacidade)

Cada usuário deve ver apenas seus chamados criados. Admin vê todos.

## PROMPT 1: Backend - Filtrar Chamados por Usuário

Arquivo: server/routes.ts (ou server/routes/chamados.ts)

Modificar endpoint GET /api/chamados (ou /api/tickets):

Lógica:
- Se usuário é admin (isAdmin = true): retornar TODOS os chamados
- Se usuário NÃO é admin: retornar apenas WHERE requester_id = userId

Usar Drizzle ORM:
```typescript
const tickets = user.isAdmin
  ? await db.query.tickets.findMany()
  : await db.query.tickets.findMany({
      where: eq(tickets.requesterId, user.id)
    });
```

Validar:
- Session tem userId
- Permissão verificada
- Ordenação por created_at DESC mantida

## PROMPT 2: Testar Segurança

Adicionar validação extra no backend.

Arquivo: server/routes.ts

Garantir que:
- Usuário não-admin NÃO pode ver chamado de outro
- GET /api/chamados/:id valida ownership
- Retornar 403 se tentar acessar chamado alheio

Código:
```typescript
// Buscar chamado
const ticket = await db.query.tickets.findFirst({
  where: eq(tickets.id, ticketId)
});

// Validar acesso
if (!user.isAdmin && ticket.requesterId !== user.id) {
  return res.status(403).json({ error: 'Sem permissão' });
}
```

## PROMPT 3: Frontend - Ajustar UI (Opcional)

Arquivo: client/src/pages/chamados/index.tsx

Se necessário, ajustar interface:
- Remover filtro "Todos os usuários" para não-admin
- Mostrar indicador "Meus Chamados" no título
- Admin vê indicador "Todos os Chamados"

Usar shadcn/ui Badge para indicar modo de visualização.
