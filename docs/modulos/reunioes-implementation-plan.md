# Plano de Implementação - Módulo de Reuniões

**Data:** 16 de fevereiro de 2026  
**Projeto:** Renov.Home - Sistema de Gestão  
**Versão:** 1.0

---

## 📋 Visão Geral

Este documento detalha o plano de implementação das melhorias no módulo de Reuniões, incluindo correção do botão "Repetir" e funcionalidades inspiradas no Notion.so.

---

## ✅ Checkpoints de Implementação

### Legenda de Status
- ⏳ **Pendente** - Não iniciado
- 🔄 **Em Andamento** - Em desenvolvimento
- ✅ **Concluído** - Finalizado e testado
- 🐛 **Com Issues** - Precisa de correção

---

## 🎯 PRIORIDADE 1: Corrigir Botão "Repetir"

### Objetivo
Fazer com que o botão "Repetir" crie automaticamente instâncias de reuniões recorrentes, gerando novas reuniões automaticamente nas datas corretas.

### Análise Técnica Atual
- **Frontend:** Botão existe na UI com campos (isRecurring, recurrenceType, recurrenceWeekdays, recurrenceEndDate)
- **Backend:** Campos são salvos no banco mas **NÃO são processados** para gerar reuniões recorrentes
- **Schema:** Campos existem na tabela `tasks` (isRecurring, recurrenceType, recurrenceWeekdays, recurrenceEndDate)

### Tarefas

#### 1.1 ✅ Análise e Mapeamento
- [x] Identificar campos de recorrência no schema
- [x] Identificar endpoint de criação de tasks
- [x] Identificar onde salvar os dados de recorrência

#### 1.2 🔄 Implementar Cron Job para Processamento de Recorrências
**Descrição:** Criar um serviço que verifica reuniões recorrentes e cria novas instâncias

**Arquivo a criar:** `server/recurrence-cron.ts`

**Implementação:**
```typescript
// server/recurrence-cron.ts
import { storage } from './storage';
import { addDays, isBefore, parseISO, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export async function processRecurringMeetings() {
  const tasks = await storage.getTasks({ isRecurring: true });
  
  for (const task of tasks) {
    if (task.type !== 'meeting_note') continue;
    
    const lastInstance = await storage.getTasks({ parentTaskId: task.id });
    const lastDate = lastInstance.length > 0 
      ? new Date(Math.max(...lastInstance.map(t => new Date(t.dueDate || t.createdAt).getTime())))
      : new Date(task.dueDate || task.createdAt);
    
    const nextDate = calculateNextRecurrenceDate(task, lastDate);
    
    if (nextDate && (!task.recurrenceEndDate || isBefore(nextDate, new Date(task.recurrenceEndDate)))) {
      await createRecurrenceInstance(task, nextDate);
    }
  }
}

function calculateNextRecurrenceDate(task: any, fromDate: Date): Date | null {
  // Implementar lógica diária/semanal com timezone Brasília
}

async function createRecurrenceInstance(parentTask: any, nextDate: Date) {
  // Criar nova instância da reunião
}
```

**Checkpoint:** `[ ] 1.2 - Cron job criado`

#### 1.3 🔄 Integrar Cron Job ao Servidor
**Descrição:** Adicionar o cron job ao servidor principal

**Arquivo:** `server/index.ts` ou `server/routes.ts`

**Checkpoint:** `[ ] 1.3 - Cron job integrado`

#### 1.4 🔄 Enviar Notificações para Participantes
**Descrição:** Quando uma nova instância for criada, notificar os participantes

**Checkpoint:** `[ ] 1.4 - Notificações implementadas`

---

## 🎯 PRIORIDADE 2: Funcionalidades Notion.so

### Item 1: Sistema de Templates de Reunião

#### 2.1 🔄 Criar Schema para Templates
**Arquivo:** `shared/schema.ts`

**Descrição:** Adicionar tabela de templates de reunião

**Checkpoint:** `[ ] 2.1 - Schema de templates criado`

#### 2.2 🔄 Criar API de Templates
**Arquivo:** `server/routes.ts`

**Endpoints:**
- `GET /api/meeting-templates` - Listar templates
- `POST /api/meeting-templates` - Criar template
- `PUT /api/meeting-templates/:id` - Atualizar template
- `DELETE /api/meeting-templates/:id` - Deletar template

**Checkpoint:** `[ ] 2.2 - API de templates criada`

#### 2.3 🔄 Criar Componente de Template no Frontend
**Arquivo:** `client/src/pages/reunioes/index.tsx`

**Descrição:** Adicionar seletor de templates no formulário de criação de reunião

**Checkpoint:** `[ ] 2.3 - UI de templates implementada`

---

### Item 6: Edição Inline de Pauta

#### 2.4 🔄 Implementar Edição Inline
**Arquivo:** `client/src/pages/reunioes/detail.tsx`

**Descrição:** Permitir editar a pauta diretamente na visualização da reunião

**Checkpoint:** `[ ] 2.4 - Edição inline implementada`

---

### Item 7: Modo Apresentação (Opcional/Bônus)

#### 2.5 🔄 Criar Modo Apresentação
**Arquivo:** `client/src/pages/reunioes/detail.tsx`

**Descrição:** Visualização em tela cheia otimizada para apresentar em reuniões

**Checkpoint:** `[ ] 2.5 - Modo apresentação criado`

---

## 🎯 PRIORIDADE 3: Configuração de Timezone

### 3.1 🔄 Configurar Timezone Brasília
**Descrição:** Garantir que todas as operações de data usem America/Sao_Paulo

**Locais a verificar:**
- Frontend: Exibição de datas
- Backend: Processamento de recorrências
- Banco de dados: Salvamento de datas

**Checkpoint:** `[ ] 3.1 - Timezone configurado`

---

## 📅 Cronograma Sugerido

| Etapa | Descrição | Tempo Estimado |
|-------|-----------|----------------|
| 1.1 | Análise | Concluído |
| 1.2 | Cron Job | 2 horas |
| 1.3 | Integração | 1 hora |
| 1.4 | Notificações | 1 hora |
| 2.1 | Schema Templates | 30 min |
| 2.2 | API Templates | 1 hora |
| 2.3 | UI Templates | 2 horas |
| 2.4 | Edição Inline | 2 horas |
| 2.5 | Modo Apresentação | 1 hora |
| 3.1 | Timezone | 30 min |

**Total Estimado:** ~11 horas

---

## 🔧 Recursos Necessários

### Dependências
- `node-cron` ou `node-schedule` - Para cron jobs
- `date-fns` - Já instalado
- `date-fns-tz` - Já instalado

### Arquivos a Modificar/Criar
1. `server/recurrence-cron.ts` (novo)
2. `server/routes.ts` (modificar)
3. `shared/schema.ts` (modificar)
4. `client/src/pages/reunioes/index.tsx` (modificar)
5. `client/src/pages/reunioes/detail.tsx` (modificar)

---

## 📝 Notas

- O sistema de recorrência deve respeitar o fuso horário de Brasília (America/Sao_Paulo)
- O cron job deve rodar a cada hora para verificar novas reuniões a criar
- Templates devem permitir salvar: título, descrição padrão, pauta, participantes frequentes
- O modo apresentação deve ter atalho de teclado (F11 ou similar)

---

**Documento criado em:** 16/02/2026
**Última atualização:** 16/02/2026
