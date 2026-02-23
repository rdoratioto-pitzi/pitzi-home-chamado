# Feature: Sistema de Tags em Reuniões

Adicionar sistema de tags no módulo Reuniões IDÊNTICO ao de Tarefas.

REQUISITOS:
- Botão "Tags" no módulo Reuniões
- Comportamento igual ao de Tarefas (sidebar recolhe ao clicar)
- Tags INDEPENDENTES (reuniões ≠ tarefas)
- CRUD completo de tags para reuniões

## PROMPT 1: Backend - Criar Tabela meeting_tags

Arquivo: shared/schema.ts

Criar tabela meeting_tags IGUAL a task_tags mas para reuniões:
```typescript
export const meetingTags = pgTable("meeting_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  visibility: text("visibility").notNull().default("private"),
  scope: text("scope").notNull().default("meetings"),
  color: text("color").default("#00A137"),
  icon: text("icon").default("folder"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMeetingTagSchema = createInsertSchema(meetingTags).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeetingTag = z.infer<typeof insertMeetingTagSchema>;
export type MeetingTag = typeof meetingTags.$inferSelect;
```

IMPORTANTE:
- Usar //ARQUIVO: shared/schema.ts
- Adicionar APÓS a definição de taskTags
- Retornar arquivo COMPLETO

## PROMPT 2: Backend - Endpoints de Tags de Reuniões

Arquivo: server/routes.ts

Criar 4 endpoints para meeting_tags (copiar lógica de task_tags):

1. GET /api/meeting-tags - listar tags do usuário
2. POST /api/meeting-tags - criar tag
3. PUT /api/meeting-tags/:id - atualizar tag
4. DELETE /api/meeting-tags/:id - deletar tag

Validações:
- Zod para input
- Verificar ownership (ownerId = userId)
- Drizzle ORM para queries
- Session autenticada

IMPORTANTE:
- Usar //ARQUIVO: server/routes.ts
- Adicionar rotas APÓS as de task_tags
- Retornar arquivo COMPLETO

## PROMPT 3: Frontend - Componente TagsManager para Reuniões

Criar client/src/components/reunioes/tags-manager.tsx

COPIAR EXATAMENTE o comportamento de Tarefas:
- Dialog/Sheet com lista de tags
- CRUD inline (criar, editar, deletar)
- Color picker
- Icon picker
- Validação com Zod
- TanStack Query para state

Usar shadcn/ui:
- Sheet (sidebar)
- Button
- Input
- Label
- Dialog (confirmação delete)

IMPORTANTE:
- Arquivo NOVO (não existe)
- Usar //ARQUIVO: client/src/components/reunioes/tags-manager.tsx
- Endpoints: /api/meeting-tags

## PROMPT 4: Frontend - Adicionar Botão Tags em Reuniões

Arquivo: client/src/pages/reunioes/index.tsx

Adicionar botão "Tags" IGUAL ao de Tarefas:

1. Importar TagsManager
2. Adicionar botão na toolbar (mesmo local que em Tarefas)
3. State para abrir/fechar sheet
4. Ao clicar: abrir sheet E recolher sidebar

Exemplo de onde adicionar (procurar toolbar/header):
```tsx
<Button variant="outline" onClick={() => setTagsOpen(true)}>
  <Tag className="h-4 w-4 mr-2" />
  Tags
</Button>
```

State necessário:
```tsx
const [tagsOpen, setTagsOpen] = useState(false);
```

IMPORTANTE:
- Usar //ARQUIVO: client/src/pages/reunioes/index.tsx
- Retornar arquivo COMPLETO
- Recolher sidebar ao abrir tags (mesmo comportamento de Tarefas)

## PROMPT 5: Migrations - Criar Tabela no Banco

Criar arquivo de migration SQL para meeting_tags.

Arquivo: NOVO - migrations/create-meeting-tags.sql
```sql
CREATE TABLE IF NOT EXISTS meeting_tags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR,
  name TEXT NOT NULL,
  description TEXT,
  owner_id VARCHAR NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  scope TEXT NOT NULL DEFAULT 'meetings',
  color TEXT DEFAULT '#00A137',
  icon TEXT DEFAULT 'folder',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meeting_tags_owner ON meeting_tags(owner_id);
CREATE INDEX idx_meeting_tags_tenant ON meeting_tags(tenant_id);
```

IMPORTANTE:
- Arquivo NOVO
- Usar //ARQUIVO: migrations/create-meeting-tags.sql
