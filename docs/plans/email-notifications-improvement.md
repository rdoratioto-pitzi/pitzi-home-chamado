# Plano: Melhoria de Notificações por E-mail — Chamados e Projetos

## Diagnóstico Atual

### Problemas Identificados

1. **Preferências de notificação são MOCK** — `storage.getNotificationPreferences()` retorna `{ emailNotificationsEnabled: true, pushNotificationsEnabled: true }` hardcoded. Nunca persiste no banco. A UI de configurações salva em `POST /api/settings` mas o email-service nunca consulta essas preferências antes de enviar.

2. **Módulo Projetos SEM e-mails** — Não existe nenhuma função de envio de e-mail para:
   - Mudança de status de cards Kanban (todo → doing → done)
   - Mudança de coluna de cards
   - Atribuição/reatribuição de cards (apenas notificação in-app)
   - Atualizações do projeto (status, membros adicionados)
   - Comentários em cards (exceto @mentions)

3. **Não há verificação de preferências** — O email-service envia emails incondicionalmente, ignorando se o usuário desabilitou aquele tipo de notificação nas configurações.

4. **Layout dos e-mails é básico** — Templates atuais têm:
   - Header verde simples sem logo
   - Sem identidade visual Renov (sem logo, sem tipografia Montserrat real via Google Fonts)
   - Footer minimalista sem links úteis
   - Sem informações contextuais ricas (quem mudou, quando, histórico)
   - Sem CTA (call-to-action) destacado
   - Status badges sem destaque visual forte

5. **Falhas silenciosas** — Erros de envio são apenas logados com `console.error`, sem retry nem fila.

---

## Plano de Implementação

### Fase 1: Corrigir a Base — Preferências de E-mail Funcionais

**1.1 — Criar tabela `notification_preferences` no schema**
- Arquivo: `shared/schema.ts`
- Campos: `id`, `userId` (unique), `emailEnabled` (boolean), `preferences` (JSON text com granularidade por tipo: `ticket_new`, `ticket_assigned`, `ticket_status`, `ticket_comment`, `mention`, `project_card_assigned`, `project_card_status`, `project_update`, `meeting_invite`, etc.)
- Migração: `npm run db:push`

**1.2 — Implementar storage real para preferências**
- Arquivo: `server/storage.ts`
- Substituir os métodos mocked `getNotificationPreferences` e `updateNotificationPreferences` por queries reais ao banco
- Adicionar método `shouldSendEmail(userId, notificationType)` que consulta preferências granulares

**1.3 — Integrar verificação de preferências no email-service**
- Arquivo: `server/email-service.ts`
- Cada função de envio deve chamar `shouldSendEmail()` antes de enviar
- Filtrar destinatários individualmente (ex: requester pode ter desabilitado mas assignee não)

**1.4 — Conectar UI de configurações ao backend real**
- Arquivo: `client/src/pages/configuracoes/notifications-settings.tsx`
- Carregar preferências do `GET /api/notifications/preferences` ao montar componente
- Salvar via `PUT /api/notifications/preferences` com preferências granulares
- Remover estado local hardcoded

---

### Fase 2: Adicionar E-mails para Módulo Projetos

**2.1 — Novas funções de e-mail para Projetos**
- Arquivo: `server/email-service.ts`
- `sendCardStatusChangedEmail(card, project, oldStatus, newStatus, changedBy, assignee, reporter)`
- `sendCardAssignedEmail(card, project, assignee, assignedBy)`
- `sendProjectMemberAddedEmail(project, member, addedBy)`
- `sendCardCommentEmail(card, project, comment, commenter, assignee, reporter)`

**2.2 — Integrar triggers nas rotas de Projetos**
- Arquivo: `server/routes/projects.ts`
- `PATCH /api/cards/:id` — detectar mudança de status/coluna e enviar e-mail
- `PATCH /api/cards/:id` — detectar mudança de assignee e enviar e-mail
- `POST /api/cards/:id/comments` — enviar e-mail a assignee/reporter (não apenas @mentions)
- `POST /api/projects/:id/members` — enviar e-mail ao novo membro

---

### Fase 3: Redesign do Layout dos E-mails

**3.1 — Criar sistema de template base**
- Arquivo: `server/email-templates.ts` (novo)
- Template HTML base reutilizável com:
  - **Header**: Logo Renov (via URL pública ou base64 inline), gradiente verde marca (#00A137), nome do sistema
  - **Google Fonts**: Montserrat via link externo
  - **Corpo**: Layout responsivo 600px, card estilizado com sombra sutil
  - **CTA Button**: Botão com destaque, bordas arredondadas, cor da marca
  - **Footer**: Links úteis (Ver no sistema, Gerenciar preferências), texto legal, logo pequeno
  - **Responsivo**: Media queries para mobile

**3.2 — Enriquecer conteúdo dos e-mails**
- Adicionar em cada tipo de e-mail:
  - **Quem** fez a ação (nome + avatar/iniciais)
  - **Quando** (data/hora formatada em PT-BR, timezone São Paulo)
  - **Contexto** adicional relevante:
    - Para status change: status anterior → novo com badges coloridos, SLA se aplicável
    - Para comments: preview do comentário + contagem total de comentários
    - Para assignment: prioridade e prazo do chamado/card
    - Para criação: resumo completo com todos os campos relevantes
  - **Breadcrumb**: módulo > entidade > ação (ex: "Chamados > CHA-0042 > Status alterado")
  - **Nota de rodapé** com link para desativar aquele tipo de notificação

**3.3 — Refatorar todas as funções existentes de e-mail**
- Migrar `sendTicketCreatedEmail`, `sendTicketStatusChangedEmail`, `sendTicketAssignedEmail`, `sendTicketCommentEmail`, `sendCSATReceivedEmail` para usar o novo sistema de template

---

### Fase 4: Melhorias de Confiabilidade

**4.1 — Logging estruturado de envio**
- Logar tentativa de envio, sucesso e falha com dados estruturados
- Incluir `userId`, `notificationType`, `recipientEmail`, `entityId` em cada log

**4.2 — Validação de e-mail do destinatário**
- Verificar se o usuário tem `email` válido antes de tentar enviar
- Verificar se o usuário está com `status: "active"`

---

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| `shared/schema.ts` | Adicionar tabela `notification_preferences` |
| `server/storage.ts` | Implementar CRUD real de preferências + `shouldSendEmail()` |
| `server/email-service.ts` | Integrar verificação de preferências, adicionar funções de Projetos |
| `server/email-templates.ts` | **NOVO** — Sistema de template base redesenhado |
| `server/routes/projects.ts` | Adicionar triggers de e-mail em status change, assignment, comments |
| `server/routes/tickets.ts` | Integrar verificação de preferências nos envios existentes |
| `server/routes/notifications.ts` | Atualizar endpoints de preferências para usar storage real |
| `client/src/pages/configuracoes/notifications-settings.tsx` | Conectar ao backend real |

## Ordem de Execução

1. Fase 1 (Base) → 2. Fase 3 (Layout) → 3. Fase 2 (Projetos) → 4. Fase 4 (Confiabilidade)

Fazendo layout antes de Projetos garante que os novos e-mails de Projetos já usem o template redesenhado.
