# Plano de Implementação: CSAT (Avaliação de Satisfação)

## 1. Mudanças no Schema (SQL)

### 1.1 Adicionar campos na tabela `tickets`

```sql
-- Adicionar na tabela tickets
ALTER TABLE tickets ADD COLUMN satisfaction_rating INTEGER;
ALTER TABLE tickets ADD COLUMN satisfaction_comment TEXT;
ALTER TABLE tickets ADD COLUMN satisfaction_created_at TIMESTAMP;
```

### 1.2 Atualizar schema TypeScript (`/shared/schema.ts`)

```typescript
// No objeto tickets, adicionar:
satisfactionRating: integer("satisfaction_rating"), // 1-5
satisfactionComment: text("satisfaction_comment"),
satisfactionCreatedAt: timestamp("satisfaction_created_at"),
```

### 1.3 Atualizar insert schema

```typescript
// No insertTicketSchema, omitir os novos campos (não são obrigatórios na criação)
```

---

## 2. Backend (API Endpoints)

### 2.1 Novo endpoint: Enviar avaliação

```
PATCH /api/tickets/:id/satisfaction
Body: { rating: 1-5, comment?: string }
```

**Lógica:**
- Validar que ticket existe e está "closed" ou "resolved"
- Validar rating entre 1-5
- Atualizar campos no banco
- Criar notificação para o assignee (opcional)
- Retornar ticket atualizado

### 2.2 Buscar avaliação (GET ticket já retorna)

O endpoint GET `/api/tickets/:id` já retornará os campos novos se existirem.

### 2.3 Atualizar rota (`/server/routes/tickets.ts`)

```typescript
router.patch("/api/tickets/:id/satisfaction", requireAuth, async (req, res) => {
  // Implementação da lógica acima
});
```

---

## 3. Frontend (Componente de Rating)

### 3.1 Criar componente `<TicketSatisfaction />`

Local: `/client/src/pages/chamados/components/ticket-satisfaction.tsx`

**Características:**
- 5 estrelas clicáveis (ícones de star)
- Campo de texto opcional para comentário
- Botão "Enviar Avaliação"
- Animação de feedback ao enviar
- Se já avaliado, mostrar avaliação anterior (readonly)

### 3.2 Integrar no `<TicketDetailSheet />`

**Localização sugerida:**
- Na parte inferior do sheet, após comentários
- Ou em uma nova aba "Avaliação"

**Condições de exibição:**
- Mostrar APENAS quando ticket.status === "closed" OU "resolved"
- Se já avaliou, mostrar resumo (estrelas + comentário + data)
- Se não avaliou, mostrar formulário

### 3.3 Atualizar KPIs (opcional)

Adicionar card novo nos stats:
- "Avaliações Recebidas"
- "Nota Média" (1-5)
- "% de Avaliações Positivas" (4-5 estrelas)

---

## 4. Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO CSAT - Tickets                         │
└─────────────────────────────────────────────────────────────────┘

1. TICKET CRÍADO
   └─ status: "open"

2. TICKET EM ANDAMENTO
   └─ status: "in_progress"

3. TICKET RESOLVIDO
   └─ status: "resolved"
   └─ dataResolucao = NOW()

4. TICKET FECHADO (pelo solicitante ou automático)
   └─ status: "closed"
   └─ dataFechamento = NOW()

5. ENVIAR AVALIAÇÃO (pelo solicitante)
   │
   ├─► Usuário abre o ticket (status: closed/resolved)
   ├─► Sistema detecta que não há satisfaction_rating
   ├─► Exibe componente de avaliação (estrelas + comentário)
   ├─► Usuário clica nas estrelas (1-5)
   ├─► Opcional: escreve comentário
   ├─► Clica "Enviar"
   └─► POST /api/tickets/:id/satisfaction
       └─► Backend valida e salva
       └─► Retorna ticket atualizado
       └─► UI atualiza e mostra modo "readonly"

6. VISUALIZAÇÃO POSTERIOR
   └─ Qualquer acesso ao ticket mostra avaliação +data
```

---

## 5. Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| Quando avaliável | Apenas tickets com status "closed" ou "resolved" |
| Quem pode avaliar | Apenas o requester (solicitante) do ticket |
| Quantas vezes | Apenas 1 vez (após envio, campo é readonly) |
| Rating válido | Inteiro de 1 a 5 |
| Comentário | Opcional, até 500 caracteres |
| Prazo | Sem limite (pode avaliar meses depois) |

---

## 6. Estimativa de Esforço

| Tarefa | Complexidade | Tempo Est. |
|--------|--------------|------------|
| Schema SQL + TypeScript | Baixa | 15 min |
| API Endpoint | Baixa | 20 min |
| Componente de Rating | Média | 45 min |
| Integração no DetailSheet | Baixa | 15 min |
| Testes | Baixa | 15 min |
| **TOTAL** | — | **~1h30** |

---

## 7. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Usuário avaliar antes do ticket ser fechado | Validar status no backend |
| Outro usuário avaliar por engano | Validar que requesterId === currentUserId |
| Double-submit (enviar duas vezes) | UI bloqueia após envio, backend também valida |

---

## 8. Próximos Passos (após aprovação)

1. ✅ Executar migration SQL
2. ✅ Atualizar schema.ts
3. ✅ Criar endpoint PATCH `/api/tickets/:id/satisfaction`
4. ✅ Criar componente `<TicketSatisfaction />`
5. ✅ Integrar no `<TicketDetailSheet />`
6. ✅ Testar fluxo completo

---

**Aprovação:** ⬜ Pendente

**Implementação:** ⬜ Não iniciada