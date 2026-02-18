# 📚 Documentação Completa - Renov Home

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Estrutura de Diretórios](#estrutura-de-diretórios)
4. [Tecnologias Utilizadas](#tecnologias-utilizadas)
5. [Banco de Dados](#banco-de-dados)
6. [Módulos da Aplicação](#módulos-da-aplicação)
7. [Autenticação e Autorização](#autenticação-e-autorização)
8. [Integrações Externas](#integrações-externas)
9. [Fluxo de Dados](#fluxo-de-dados)
10. [API REST](#api-rest)
11. [Configuração e Deploy](#configuração-e-deploy)
12. [Manutenção e Evolução](#manutenção-e-evolução)

---

## 🎯 Visão Geral

**Renov Home** é uma plataforma web interna projetada para centralizar e otimizar diversos aspectos operacionais da Renov. Seu objetivo principal é aumentar a eficiência entre diferentes departamentos, fornecendo ferramentas integradas para gestão de:

- Chamados de suporte ao cliente
- Projetos e tarefas
- OKRs e metas
- Logística e fretes
- Pricing em tempo real para smartphones
- Base de conhecimento
- Reuniões e calendário
- Fluxogramas e processos
- IA Assistida (Macgyver IA)

### Objetivos do Sistema

1. **Melhorar comunicação interna** - Centralizar informações e comunicação
2. **Aumentar produtividade** - Automação e gestão estruturada
3. **Insights baseados em dados** - Relatórios e dashboards
4. **Otimizar logística** - Integrações com Correios e operadores
5. **Identidade de marca consistente** - Design system Renov

---

## 🏗️ Arquitetura do Sistema

### Arquitetura Cliente-Servidor

```mermaid
flowchart TB
    subgraph Client["📱 Client (Frontend)"]
        direction TB
        React["React 18 + TypeScript"]
        Tailwind["Tailwind CSS"]
        Shadcn["Shadcn/UI"]
        TanStack["TanStack Query"]
        Wouter["Wouter (Routing)"]
    end

    subgraph Server["⚙️ Server (Backend)"]
        direction TB
        Express["Express.js"]
        Session["Express Session"]
        Routes["API Routes"]
        Services["Services Layer"]
    end

    subgraph Data["💾 Data Layer"]
        direction TB
        PostgreSQL[("PostgreSQL")]
        Drizzle["Drizzle ORM"]
        Schema["Shared Schema"]
    end

    subgraph External["🌐 Integrações Externas"]
        Correios["Correios API"]
        RSLogistica["RS Logística API"]
        OpenRouter["OpenRouter AI"]
        RenovSmart["RenovSmart API"]
    end

    Client <-->|"HTTP/REST"| Server
    Server <-->|"SQL"| Data
    Server <-->|"SOAP/REST"| External
```

### Padrão de Arquitetura

- **Frontend**: SPA (Single Page Application) com React
- **Backend**: REST API com Express.js
- **Banco de Dados**: PostgreSQL com Drizzle ORM
- **Autenticação**: Session-based com express-session
- **Comunicação**: HTTP/REST + Server-Sent Events (para IA)

---

## 📁 Estrutura de Diretórios

```
Renov.Home/
├── 📁 client/                    # Frontend React
│   ├── 📁 public/               # Arquivos estáticos
│   │   ├── favicon.ico
│   │   └── prompts.html
│   └── 📁 src/
│       ├── 📁 components/       # Componentes React
│       │   ├── 📁 ui/          # Componentes Shadcn/UI
│       │   ├── 📁 auth/        # Componentes de autenticação
│       │   ├── 📁 Chat/        # Componentes do chat IA
│       │   ├── app-sidebar.tsx
│       │   ├── notification-bell.tsx
│       │   ├── protected-route.tsx
│       │   └── ...
│       ├── 📁 hooks/           # Custom React hooks
│       │   ├── use-theme.tsx
│       │   ├── use-toast.ts
│       │   ├── use-logistics.ts
│       │   └── ...
│       ├── 📁 lib/             # Utilitários e helpers
│       │   ├── permissions.ts
│       │   ├── queryClient.ts
│       │   └── utils.ts
│       ├── 📁 pages/           # Páginas da aplicação
│       │   ├── 📁 chamados/
│       │   ├── 📁 projetos/
│       │   ├── 📁 tarefas/
│       │   ├── 📁 reunioes/
│       │   ├── 📁 okrs/
│       │   ├── 📁 metas/
│       │   ├── 📁 logistica/
│       │   ├── 📁 pricing/
│       │   ├── 📁 conhecimento/
│       │   ├── 📁 fluxogramas/
│       │   ├── 📁 macgyver-ia/
│       │   ├── 📁 configuracoes/
│       │   ├── 📁 apis/
│       │   ├── home.tsx
│       │   ├── login.tsx
│       │   └── not-found.tsx
│       ├── 📁 utils/
│       ├── App.tsx
│       ├── index.css
│       └── main.tsx
│
├── 📁 server/                    # Backend Express
│   ├── 📁 jobs/                 # Jobs agendados (cron)
│   │   ├── prompts-sync.job.ts
│   │   └── recurrence.job.ts
│   ├── 📁 replit_integrations/  # Integrações Replit
│   │   └── 📁 object_storage/
│   ├── 📁 services/             # Serviços de negócio
│   │   ├── prompts-sync.service.ts
│   │   └── translate-prompts.service.ts
│   ├── auth.ts                  # Configuração de autenticação
│   ├── correios-service.ts      # Integração Correios
│   ├── db.ts                    # Configuração do banco
│   ├── email-service.ts         # Serviço de email
│   ├── external-data.ts         # Dados externos para IA
│   ├── index.ts                 # Entry point do servidor
│   ├── openrouter.ts            # Integração OpenRouter AI
│   ├── routes.ts                # Definição de rotas API
│   ├── seed.ts                  # Dados iniciais
│   ├── static.ts                # Servir arquivos estáticos
│   ├── storage.ts               # Interface de storage
│   └── vite.ts                  # Configuração Vite dev
│
├── 📁 shared/                    # Código compartilhado
│   └── schema.ts                # Schema do banco (Drizzle)
│
├── 📁 migrations/                # Migrações do banco
├── 📁 docs/                      # Documentação
├── 📁 attached_assets/           # Assets anexados
├── 📁 scripts/                   # Scripts utilitários
├── package.json
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

---

## 🛠️ Tecnologias Utilizadas

### Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | 18.3.1 | UI Library |
| TypeScript | 5.6.3 | Tipagem estática |
| Tailwind CSS | 3.4.17 | Estilização |
| Shadcn/UI | - | Componentes UI |
| TanStack Query | 5.60.5 | Gerenciamento de estado server |
| Wouter | 3.3.5 | Roteamento |
| React Hook Form | 7.55.0 | Formulários |
| Zod | 3.24.2 | Validação |
| Recharts | 2.15.2 | Gráficos |
| Framer Motion | 11.18.2 | Animações |
| date-fns | 3.6.0 | Manipulação de datas |

### Backend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Express | 5.0.1 | Framework web |
| Drizzle ORM | 0.39.3 | ORM para PostgreSQL |
| PostgreSQL | - | Banco de dados |
| express-session | 1.19.0 | Gerenciamento de sessão |
| Passport | 0.7.0 | Autenticação |
| Nodemailer | 7.0.13 | Envio de emails |
| node-cron | 4.2.1 | Jobs agendados |
| xml2js | 0.6.2 | Parsing XML (Correios) |

### Integrações Externas

| Serviço | Tipo | Propósito |
|---------|------|-----------|
| Correios | SOAP | Logística reversa |
| RS Logística | REST | Gestão logística |
| RenovSmart | REST | Dados de pricing |
| OpenRouter | REST | LLM/IA |

---

## 🗄️ Banco de Dados

### Diagrama de Entidades

```mermaid
erDiagram
    USERS ||--o{ TICKETS : "cria"
    USERS ||--o{ PROJECTS : "gerencia"
    USERS ||--o{ TASKS : "atribuído"
    USERS ||--o{ OBJECTIVES : "possui"
    USERS ||--o{ AI_CONVERSATIONS : "inicia"
    USERS ||--o{ NOTIFICATIONS : "recebe"
    
    PROJECTS ||--o{ KANBAN_COLUMNS : "contém"
    PROJECTS ||--o{ PROJECT_MEMBERS : "tem"
    KANBAN_COLUMNS ||--o{ KANBAN_CARDS : "contém"
    
    OBJECTIVES ||--o{ KEY_RESULTS : "contém"
    KEY_RESULTS ||--o{ KEY_RESULT_UPDATES : "atualiza"
    
    TASK_TAGS ||--o{ TASKS : "categoriza"
    TASKS ||--o{ TASK_COMMENTS : "tem"
    TASKS ||--o{ TASK_ATTACHMENTS : "possui"
    
    KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_VERSIONS : "versiona"
    KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_FAVORITES : "favoritado"
    
    FLOWCHARTS ||--o{ FLOWCHART_VERSIONS : "versiona"
    FLOWCHARTS ||--o{ FLOWCHART_COMMENTS : "tem"
    
    AI_CONVERSATIONS ||--o{ AI_MESSAGES : "contém"
    AI_SPACES ||--o{ AI_SPACE_CONVERSATIONS : "organiza"
```

### Principais Tabelas

#### 1. Users (Usuários)
```typescript
- id: UUID (PK)
- tenantId: UUID (FK)
- name: string
- email: string (unique)
- password: string
- status: 'active' | 'inactive'
- authMethod: 'email' | 'google'
- isAdmin: boolean
- areaNegocio: 'LAB' | 'RH' | 'COM' | 'FIN' | 'MKT' | 'OPS' | 'TI'
- perfilAcesso: 'assistente' | 'analista' | 'gestor' | 'diretor'
- modulePermissions: JSON
- createdAt: timestamp
```

#### 2. Tickets (Chamados)
```typescript
- id: UUID (PK)
- code: string (ex: CHM-001)
- title: string
- description: text
- category: string
- type: 'bug' | 'melhoria' | 'negocio'
- location: 'RS' | 'RG' | 'Dash' | 'One' | 'Home' | 'Omie' | 'Outros'
- priority: 'low' | 'medium' | 'high' | 'critical'
- impact: 'baixo' | 'medio' | 'alto' | 'critico'
- status: 'open' | 'in_progress' | 'blocked' | 'resolved' | 'closed'
- requesterId: UUID (FK)
- assigneeId: UUID (FK)
- createdAt: timestamp
- dataAbertura: timestamp
- dataPrimeiraResposta: timestamp
- dataResolucao: timestamp
- dataFechamento: timestamp
```

#### 3. Projects (Projetos)
```typescript
- id: UUID (PK)
- code: string (ex: PRO-0001)
- name: string
- description: text
- status: 'active' | 'archived'
- visibility: 'private' | 'shared' | 'public'
- ownerId: UUID (FK)
- startDate: timestamp
- endDate: timestamp
- createdAt: timestamp
```

#### 4. Kanban Cards (Cards do Kanban)
```typescript
- id: UUID (PK)
- code: string
- columnId: UUID (FK)
- projectId: UUID (FK)
- title: string
- objectives: text
- development: text
- assigneeId: UUID (FK)
- reporterId: UUID (FK)
- priority: 'low' | 'normal' | 'high' | 'critical'
- tags: string[]
- dueDate: timestamp
- progress: integer (0-100)
- createdAt: timestamp
```

#### 5. Tasks (Tarefas)
```typescript
- id: UUID (PK)
- tagId: UUID (FK)
- title: string
- description: text
- type: 'task' | 'meeting'
- status: 'todo' | 'in_progress' | 'done' | 'cancelled'
- priority: 'low' | 'medium' | 'high' | 'critical'
- assigneeId: UUID (FK)
- assigneeIds: JSON (multi-assignee)
- dueDate: timestamp
- isRecurring: boolean
- recurrenceType: 'daily' | 'weekly'
- createdAt: timestamp
```

#### 6. Objectives (OKRs)
```typescript
- id: UUID (PK)
- title: string
- description: text
- ownerId: UUID (FK)
- level: 'company' | 'team' | 'individual'
- cycle: string
- status: 'on_track' | 'at_risk' | 'overdue'
- createdAt: timestamp
```

#### 7. Key Results
```typescript
- id: UUID (PK)
- objectiveId: UUID (FK)
- title: string
- measurementType: 'percentage' | 'absolute' | 'monetary' | 'temporal' | 'binary' | 'decreasing'
- startValue: decimal
- targetValue: decimal
- currentValue: decimal
- unit: string
- responsibleIds: JSON
- dueDate: timestamp
- deadlineStatus: 'on_track' | 'at_risk' | 'overdue'
- createdAt: timestamp
```

#### 8. LogisticaReversaPedidos
```typescript
- id: UUID (PK)
- numeroPedido: string
- numeroEtiqueta: string
- tipo: 'A' | 'C' | 'CA' (Autorização | Coleta | Coleta Simultânea)
- codigoServico: string
- status: 'solicitado' | 'autorizado' | 'coletado' | 'entregue'
- remetenteNome: string
- remetenteCep: string
- destinatarioNome: string
- destinatarioCep: string
- itensColeta: JSON
- tipoEmbalagem: string
- valorDeclarado: string
- createdAt: timestamp
```

#### 9. Knowledge Documents
```typescript
- id: UUID (PK)
- area: 'LAB' | 'RH' | 'COM' | 'FIN' | 'MKT' | 'OPS' | 'TI'
- tipo: 'politica' | 'pop' | 'fluxograma' | 'mapa_cargo' | 'template' | 'checklist' | 'faq'
- titulo: string
- versao: string (ex: V1)
- dataMesAno: string (YYYY-MM)
- nomeArquivo: string
- conteudo: text (rich text)
- tags: JSON
- status: 'rascunho' | 'em_analise' | 'aprovado' | 'arquivado'
- visibilidade: 'todos' | 'departamento' | 'funcoes'
- criadorId: UUID (FK)
- createdAt: timestamp
```

#### 10. AI Conversations
```typescript
- id: UUID (PK)
- userId: UUID (FK)
- title: string
- createdAt: timestamp
- updatedAt: timestamp
```

#### 11. AI Messages
```typescript
- id: UUID (PK)
- conversationId: UUID (FK)
- role: 'user' | 'assistant' | 'system'
- content: text
- createdAt: timestamp
```

#### 12. Notifications
```typescript
- id: UUID (PK)
- userId: UUID (FK)
- fromUserId: UUID (FK)
- title: string
- message: string
- module: string
- entityId: UUID
- linkUrl: string
- isRead: boolean
- createdAt: timestamp
```

---

## 📦 Módulos da Aplicação

### 1. 🎫 Chamados (Tickets)

**Descrição**: Sistema completo de gestão de chamados de suporte.

**Funcionalidades**:
- Criação de chamados com código automático (CHM-XXX)
- Categorização por tipo (bug, melhoria, negócio) e local
- Priorização e nível de impacto
- Atribuição automática baseada em regras
- SLA (Service Level Agreement) configurável
- Comentários com anexos
- Notificações por email
- Exportação para Excel
- Visualização em Kanban

**Visibilidade**: Pública - todos os usuários autenticados veem todos os tickets.

**Arquivos principais**:
- `client/src/pages/chamados/index.tsx`
- `client/src/pages/chamados/ticket-dialog.tsx`
- `client/src/pages/chamados/ticket-kanban.tsx`

---

### 2. 📋 Projetos

**Descrição**: Gestão de projetos com quadros Kanban.

**Funcionalidades**:
- Criação de projetos com código (PRO-XXXX)
- Visibilidade configurável: privada, compartilhada, pública
- Gestão de membros por projeto
- Quadros Kanban customizáveis
- Cards com checklists, prioridades e datas
- Comentários em cards
- Vinculação com tickets

**Visibilidade**: 3 níveis (private/shared/public) com gestão de membros via `projectMembers`.

**Arquivos principais**:
- `client/src/pages/projetos/index.tsx`
- `client/src/pages/projetos/kanban.tsx`
- `client/src/pages/projetos/card-dialog.tsx`

---

### 3. ✅ Tarefas

**Descrição**: Gestão de tarefas individuais e em equipe.

**Funcionalidades**:
- Criação de tarefas com tags/áreas
- Sistema de tags com visibilidade privada/compartilhada
- Kanban por tags
- Comentários e reações
- Anexos em tarefas
- Templates de tarefas
- Recorrência (diária/semanal)
- Multi-atribuição

**Visibilidade**: Tags com visibilidade privada/compartilhada. Tarefas aparecem apenas em sua tag ou em "Todas as Tarefas".

**Arquivos principais**:
- `client/src/pages/tarefas/index.tsx`
- `client/src/pages/tarefas/detail.tsx`

---

### 4. 📅 Reuniões

**Descrição**: Gestão de reuniões integrada ao calendário.

**Funcionalidades**:
- Agendamento de reuniões
- Tags com visibilidade pública
- Recorrência configurável
- Múltiplos participantes
- Envio de convites por email
- Vinculação com tarefas
- Notas de reunião

**Visibilidade**: Tags podem ser privadas, compartilhadas ou públicas (diferente de tarefas).

**Arquivos principais**:
- `client/src/pages/reunioes/index.tsx`
- `client/src/pages/reunioes/detail.tsx`

---

### 5. 🎯 OKRs

**Descrição**: Framework de Objectives and Key Results.

**Funcionalidades**:
- Objetivos hierárquicos (empresa, time, individual)
- Key Results com múltiplos tipos de medição
- Check-ins periódicos
- Múltiplos responsáveis
- Tracking de progresso
- Status de deadline

**Tipos de medição**:
- percentage: Porcentagem (0-100%)
- absolute: Valor absoluto
- monetary: Valor monetário (R$)
- temporal: Tempo (horas/dias)
- binary: Sim/Não
- decreasing: Quanto menor, melhor

**Arquivos principais**:
- `client/src/pages/okrs/index.tsx`
- `client/src/pages/okrs/key-result-dialog.tsx`

---

### 6. 🏆 Metas

**Descrição**: Gestão de metas mensais por área.

**Funcionalidades**:
- Metas por área de negócio
- Acompanhamento mensal
- Tipos de medição similares aos OKRs
- Check-ins de progresso
- Status: on_track, at_risk, overdue, completed

**Arquivos principais**:
- `client/src/pages/metas/index.tsx`
- `client/src/pages/metas/gestao.tsx`

---

### 7. 📊 Pricing

**Descrição**: Monitoramento de preços de smartphones em tempo real.

**Funcionalidades**:
- Dashboard com KPIs
- Análise de produtos
- Histórico de preços
- Gráficos de tendência
- Alertas de preço
- Indicadores de mercado
- Relatórios

**Integração**: RenovSmart API

**Arquivos principais**:
- `client/src/pages/pricing/index.tsx`
- `client/src/pages/pricing/dashboard.tsx`
- `client/src/pages/pricing/analise.tsx`

---

### 8. 🚚 Logística

**Descrição**: Gestão completa de operações logísticas.

**Funcionalidades**:
- Simulação de fretes
- Logística reversa (Correios)
- Coletas e entregas
- Impressão de etiquetas (ZPL)
- Romaneios
- Operadores logísticos
- Dashboard logístico
- CEP validation

**Integrações**:
- Correios Logística Reversa (SOAP)
- RS Logística API

**Arquivos principais**:
- `client/src/pages/logistica/index.tsx`
- `client/src/pages/logistica/logistica-reversa.tsx`
- `client/src/pages/logistica/simular-frete.tsx`
- `server/correios-service.ts`

---

### 9. 📚 Base de Conhecimento

**Descrição**: Repositório de documentação e processos.

**Funcionalidades**:
- Documentos com nomenclatura padronizada
- Versionamento de documentos
- Workflow de aprovação
- Controle de visibilidade
- Favoritos por usuário
- Auditoria completa
- Rich text editor
- Anexos

**Tipos de documento**:
- política (Políticas)
- pop (Procedimentos Operacionais)
- fluxograma
- mapa_cargo
- template
- checklist
- faq

**Arquivos principais**:
- `client/src/pages/conhecimento/index.tsx`
- `client/src/pages/conhecimento/documento.tsx`
- `client/src/pages/conhecimento/novo.tsx`

---

### 10. 🔄 Fluxogramas

**Descrição**: Editor visual de fluxogramas e processos.

**Funcionalidades**:
- Editor drag-and-drop
- Baseado em React Flow
- Nós e edges customizáveis
- Versionamento
- Comentários em nós
- Templates
- Compartilhamento
- Thumbnail automático

**Arquivos principais**:
- `client/src/pages/fluxogramas/index.tsx`
- `client/src/pages/fluxogramas/editor.tsx`

---

### 11. 🤖 Macgyver IA

**Descrição**: Assistente de IA integrado à plataforma.

**Funcionalidades**:
- Chat estilo ChatGPT/Gemini
- Streaming de respostas (SSE)
- Múltiplos modelos LLM
- Contexto de todos os módulos
- Conversas organizadas em espaços
- Histórico persistente
- Exportação de conversas
- Slash commands
- Syntax highlighting

**Integração**: OpenRouter API

**Arquivos principais**:
- `client/src/pages/macgyver-ia/index.tsx`
- `server/openrouter.ts`
- `server/external-data.ts`

---

### 12. 📚 Prompts

**Descrição**: Biblioteca de prompts para Claude Code.

**Funcionalidades**:
- Sincronização com GitHub
- Categorização (Equipe, Ferramentas, Linguagens, Database)
- Favoritos por usuário
- Tradução automática
- Uso de templates

**Integração**: GitHub API

**Arquivos principais**:
- `client/src/pages/conhecimento/prompts/index.tsx`
- `server/services/prompts-sync.service.ts`

---

### 13. ⚙️ Configurações

**Descrição**: Gestão de configurações do sistema.

**Funcionalidades**:
- Gestão de usuários
- Permissões por módulo
- Configurações de marca (logo, cores)
- Regras de atribuição automática
- Configurações de campos
- Responsáveis por categoria
- Notificações

**Arquivos principais**:
- `client/src/pages/configuracoes/index.tsx`
- `client/src/pages/configuracoes/users-settings.tsx`

---

## 🔐 Autenticação e Autorização

### Fluxo de Autenticação

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant A as Auth API
    participant S as Session Store
    participant D as Database

    U->>F: Informa email/senha
    F->>A: POST /api/auth/login
    A->>D: Busca usuário por email
    D-->>A: Retorna usuário
    A->>A: Valida senha
    A->>A: Verifica status ativo
    A->>S: Cria sessão
    S-->>A: Session ID
    A-->>F: Retorna sucesso + cookie
    F-->>U: Redireciona para home
```

### Níveis de Acesso

| Tipo | Descrição |
|------|-----------|
| **Admin** | Acesso total a todos os módulos e funcionalidades |
| **Usuário** | Acesso baseado em `modulePermissions` JSON |
| **Módulos Corporativos** | Controle adicional via `modulePermissions` |

### Permissões por Módulo

```typescript
interface ModulePermissions {
  chamados: boolean;
  projetos: boolean;
  tarefas: boolean;
  okrs: boolean;
  metas: boolean;
  fluxogramas: boolean;
  logistica: boolean;
  pricing: boolean;
  conhecimento: boolean;
  apis: boolean;
  configuracoes: boolean;
  updates: boolean;
}
```

### Regras de Visibilidade Específicas

| Módulo | Visibilidade | Observações |
|--------|--------------|-------------|
| Macgyver IA | 100% privado | Sem bypass de admin |
| Chamados | Público | Todos veem todos |
| Projetos | 3 níveis | Private/Shared/Public |
| Flowcharts | Privado default | Compartilhamento via permissions JSON |
| Tarefas | Privada/Compartilhada | Tags com visibilidade |
| Reuniões | 3 níveis | Private/Shared/Public |

---

## 🌐 Integrações Externas

### 1. Correios Logística Reversa

**Tipo**: SOAP Web Service

**Ambientes**:
- Homologação: `https://apphom.correios.com.br/logisticaReversaWS/...`
- Produção: `https://apps.correios.com.br/logisticaReversaWS/...`

**Operações**:
- Solicitar autorização de postagem
- Solicitar coleta
- Coleta simultânea
- Tracking de remessas
- Geração de etiquetas

**Configuração** (variáveis de ambiente):
```env
CORREIOS_USUARIO=
CORREIOS_SENHA=
CORREIOS_CARTAO_POSTAGEM=
CORREIOS_COD_ADMINISTRATIVO=
CORREIOS_TOKEN=
CORREIOS_HOMOLOGACAO=true|false
```

**Arquivo**: `server/correios-service.ts`

---

### 2. RS Logística API

**Tipo**: REST API

**Base URL**: `https://dash.renovsmart.com.br/api`

**Endpoints**:
- Dashboard de pedidos
- Relatórios logísticos
- Romaneios
- Tracking

**Arquivo**: `client/src/pages/apis/api-rs-logistica.tsx`

---

### 3. RenovSmart API (Pricing)

**Tipo**: REST API

**Propósito**: Dados de pricing de smartphones

**Funcionalidades**:
- Listagem de dispositivos
- Histórico de preços
- Alertas de variação

**Arquivo**: Módulo Pricing

---

### 4. OpenRouter AI

**Tipo**: REST API

**Base URL**: `https://openrouter.ai/api/v1`

**Funcionalidades**:
- Chat completions
- Listagem de modelos
- Streaming SSE

**Configuração**:
```env
OPENROUTER_API_KEY=
```

**Arquivo**: `server/openrouter.ts`

---

### 5. GitHub (Prompts Sync)

**Tipo**: REST API

**Repositório**: `davila7/claude-code-templates`

**Funcionalidades**:
- Sincronização de prompts
- Tradução automática
- Versionamento

**Arquivo**: `server/services/prompts-sync.service.ts`

---

## 🔄 Fluxo de Dados

### Fluxo de Criação de Ticket

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant A as API
    participant S as Storage
    participant D as Database
    participant E as Email Service

    U->>F: Preenche formulário de ticket
    F->>F: Valida com Zod
    F->>A: POST /api/tickets
    A->>A: Gera código (CHM-XXX)
    A->>A: Busca responsável automático
    A->>S: createTicket()
    S->>D: INSERT INTO tickets
    D-->>S: Retorna ticket criado
    S-->>A: Retorna ticket
    A->>E: Envia email de notificação
    A-->>F: Retorna ticket (201)
    F-->>U: Exibe ticket criado
```

### Fluxo de Chat IA

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant A as API
    participant O as OpenRouter
    participant D as Database

    U->>F: Envia mensagem
    F->>A: POST /api/ai/chat (SSE)
    A->>D: Busca contexto externo
    A->>D: Salva mensagem do usuário
    A->>O: POST /chat/completions
    O-->>A: Stream de resposta
    loop Streaming
        A-->>F: Chunk de resposta
        F-->>U: Exibe progressivamente
    end
    A->>D: Salva resposta completa
    A-->>F: Fim do stream
```

---

## 🔌 API REST

### Endpoints Principais

#### Autenticação
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/forgot-password
```

#### Usuários
```
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/users/me
```

#### Chamados
```
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
POST   /api/tickets/:id/comments
GET    /api/tickets/:id/comments
```

#### Projetos
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/columns
POST   /api/projects/:id/columns
GET    /api/projects/:id/cards
POST   /api/projects/:id/cards
```

#### Tarefas
```
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/task-tags
POST   /api/task-tags
```

#### OKRs
```
GET    /api/objectives
POST   /api/objectives
GET    /api/objectives/:id/key-results
POST   /api/key-results
POST   /api/key-results/:id/updates
```

#### Logística Reversa
```
GET    /api/logistica-reversa/pedidos
POST   /api/logistica-reversa/pedidos
GET    /api/logistica-reversa/pedidos/:id
POST   /api/logistica-reversa/simular-frete
POST   /api/logistica-reversa/gerar-etiqueta
```

#### IA
```
GET    /api/ai/models
POST   /api/ai/chat (SSE)
GET    /api/ai/conversations
POST   /api/ai/conversations
GET    /api/ai/conversations/:id/messages
DELETE /api/ai/conversations/:id
```

#### Base de Conhecimento
```
GET    /api/knowledge
POST   /api/knowledge
GET    /api/knowledge/:id
PUT    /api/knowledge/:id
POST   /api/knowledge/:id/versions
POST   /api/knowledge/:id/approve
POST   /api/knowledge/:id/reject
```

---

## ⚙️ Configuração e Deploy

### Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=postgresql://user:pass@host:port/db

# Sessão
SESSION_SECRET=sua-chave-secreta

# OpenRouter (IA)
OPENROUTER_API_KEY=sua-api-key

# Correios
CORREIOS_USUARIO=usuario
CORREIOS_SENHA=senha
CORREIOS_CARTAO_POSTAGEM=cartao
CORREIOS_COD_ADMINISTRATIVO=codigo
CORREIOS_TOKEN=token
CORREIOS_HOMOLOGACAO=true

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# RS Logística
RS_LOGISTICA_API_KEY=

# RenovSmart
RENOVSMART_API_KEY=
```

### Scripts NPM

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Type check
npm run check

# Database
npm run db:push
```

### Deploy

1. **Build da aplicação**:
   ```bash
   npm run build
   ```

2. **Migrações do banco**:
   ```bash
   npm run db:push
   ```

3. **Iniciar em produção**:
   ```bash
   NODE_ENV=production npm start
   ```

---

## 🔧 Manutenção e Evolução

### Jobs Agendados (Cron)

| Job | Frequência | Arquivo | Descrição |
|-----|------------|---------|-----------|
| Prompts Sync | Diário | `jobs/prompts-sync.job.ts` | Sincroniza prompts do GitHub |
| Recurrence | Diário | `jobs/recurrence.job.ts` | Cria instâncias de tarefas recorrentes |

### Padrões de Código

#### Nomenclatura
- **Arquivos**: kebab-case (ex: `ticket-dialog.tsx`)
- **Componentes**: PascalCase (ex: `TicketDialog`)
- **Funções**: camelCase (ex: `handleSubmit`)
- **Constantes**: UPPER_SNAKE_CASE (ex: `API_URL`)
- **Banco**: snake_case (ex: `created_at`)

#### Estrutura de Componentes
```typescript
// Imports
import { useState } from 'react';

// Types
interface Props {
  title: string;
}

// Componente
export function ComponentName({ title }: Props) {
  // Hooks
  const [state, setState] = useState();
  
  // Handlers
  const handleClick = () => {};
  
  // Render
  return <div>{title}</div>;
}
```

### Adicionando Novo Módulo

1. **Banco de Dados**:
   - Adicionar tabelas em `shared/schema.ts`
   - Exportar schemas de inserção

2. **Backend**:
   - Adicionar métodos em `server/storage.ts`
   - Criar rotas em `server/routes.ts`

3. **Frontend**:
   - Criar páginas em `client/src/pages/[modulo]/`
   - Adicionar rotas em `client/src/App.tsx`
   - Adicionar permissão em `client/src/lib/permissions.ts`

4. **Sidebar**:
   - Adicionar link em `client/src/components/app-sidebar.tsx`

### Boas Práticas

1. **Validação**: Sempre use Zod para validação de formulários
2. **Tipagem**: Mantenha tipos TypeScript rigorosos
3. **Error Handling**: Use try/catch e exiba mensagens apropriadas
4. **Loading States**: Sempre mostre estados de carregamento
5. **Otimização**: Use React Query para caching de dados
6. **Segurança**: Valide permissões no frontend e backend

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique os logs do servidor
2. Consulte a documentação dos módulos
3. Verifique as variáveis de ambiente
4. Analise os erros no console do navegador

---

**Documentação gerada em**: 17 de Fevereiro de 2026
**Versão da aplicação**: 1.0.0
**Última atualização**: 17/02/2026
