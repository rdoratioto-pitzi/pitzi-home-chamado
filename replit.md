# Renov Home

Plataforma interna de gestão da Renov para gerenciamento de chamados, projetos, OKRs, tarefas e logística.

## Visão Geral

O Renov Home é uma aplicação web interna que oferece:

- **Gestão de Chamados**: Sistema de suporte interno para TI, RH, operações, etc.
- **Projetos**: Gerenciamento de projetos com quadros Kanban
- **Tarefas**: Gerenciamento de tarefas por áreas com comentários e reações
- **OKRs**: Objetivos e resultados-chave por trimestre
- **Logística**: Rastreamento, simulação de frete e logística reversa
- **APIs Log**: Documentação de integrações (Correios, APIs internas, operadores)
- **Configurações**: Gerenciamento de usuários com permissões por módulo

## Identidade Visual

Seguindo as diretrizes de marca da Renov:
- **Cor primária**: Verde Renov (#00A137)
- **Cores secundárias**: Preto (#000000) e Branco (#FFFFFF)
- **Tipografia**: Montserrat (Regular, Medium, Bold)

## Stack Técnica

### Frontend
- React 18 com TypeScript
- Tailwind CSS para estilização
- Shadcn/UI como biblioteca de componentes
- Wouter para roteamento
- TanStack Query para gerenciamento de estado/dados
- React Hook Form + Zod para formulários

### Backend
- Node.js com Express
- TypeScript
- Armazenamento em memória (MemStorage)
- API REST em `/api/...`

## Arquitetura Multi-tenant

O sistema está preparado para multi-tenant com:
- Campo `tenantId` em todas as tabelas
- Isolamento de dados por tenant
- Preparação para N organizações

## Estrutura do Projeto

```
client/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   │   ├── ui/        # Componentes Shadcn
│   │   ├── app-sidebar.tsx
│   │   ├── page-header.tsx
│   │   ├── renov-logo.tsx
│   │   └── theme-toggle.tsx
│   ├── hooks/         # Hooks customizados
│   ├── lib/           # Utilitários
│   └── pages/         # Páginas por módulo
│       ├── chamados/
│       ├── projetos/
│       ├── tarefas/
│       ├── okrs/
│       ├── logistica/
│       │   ├── simular-frete.tsx
│       │   └── logistica-reversa.tsx
│       ├── apis/
│       └── configuracoes/
server/
├── routes.ts          # Rotas da API
├── storage.ts         # Interface e implementação do storage
└── index.ts           # Entrada do servidor
shared/
└── schema.ts          # Schemas e tipos compartilhados
```

## APIs Disponíveis

### Autenticação
- `POST /api/auth/login` - Login com email/senha

### Chamados
- `GET /api/tickets` - Listar chamados
- `POST /api/tickets` - Criar chamado
- `PATCH /api/tickets/:id` - Atualizar chamado
- `GET /api/tickets/:id/comments` - Listar comentários
- `POST /api/tickets/:id/comments` - Adicionar comentário

### Projetos
- `GET /api/projects` - Listar projetos
- `POST /api/projects` - Criar projeto
- `GET /api/projects/:id/columns` - Listar colunas Kanban
- `GET /api/projects/:id/cards` - Listar cards
- `POST /api/columns` - Criar coluna
- `POST /api/cards` - Criar card
- `PATCH /api/cards/:id` - Mover/atualizar card

### Tarefas
- `GET /api/task-areas` - Listar áreas
- `POST /api/task-areas` - Criar área
- `GET /api/tasks` - Listar tarefas
- `POST /api/tasks` - Criar tarefa
- `PATCH /api/tasks/:id` - Atualizar tarefa

### OKRs
- `GET /api/objectives` - Listar objetivos
- `POST /api/objectives` - Criar objetivo
- `GET /api/key-results` - Listar key results
- `POST /api/key-results` - Criar key result
- `PATCH /api/key-results/:id` - Atualizar progresso

### Logística
- `GET /api/logistics/dashboard` - Estatísticas do dashboard
- `GET /api/logistics/operators` - Listar operadores
- `POST /api/logistics/requests` - Criar solicitação de frete
- `GET /api/logistics/logistica-reversa` - Listar pedidos de logística reversa
- `POST /api/logistics/logistica-reversa/solicitar` - Solicitar coleta reversa

### Usuários
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário (com permissões por módulo)
- `PATCH /api/users/:id` - Atualizar usuário

### Configurações
- `GET /api/settings` - Listar configurações
- `GET /api/settings/:key` - Obter configuração específica
- `POST /api/settings` - Salvar configuração (key/value)

## Módulos de Permissões

Os usuários têm permissões granulares por módulo:
- Chamados
- Projetos
- Tarefas
- OKRs
- Logística
- APIs Log
- Configurações

## Funcionalidades de Logística

### Simular Frete
- Comparação de preços entre operadores (Correios, Jadlog, Azul Cargo)
- Cálculo de prazos de entrega
- Seleção da melhor opção

### Logística Reversa
- **Solicitar Coleta**: Formulário completo com dados do remetente, itens a coletar (com IMEI), embalagem, adicional ANAC
- **Coleta em Massa**: Importação de arquivo para múltiplas coletas
- **Acompanhamento**: Visualização e filtros de pedidos
- **Consultas**: Rastreamento de etiquetas e pedidos

## Notas de Segurança (MVP)

> **IMPORTANTE**: A autenticação atual é simplificada para MVP. Em produção, implementar:
> - Hash de senhas com bcrypt/argon2
> - JWT com HttpOnly cookies
> - Middleware de autenticação no backend
> - Rate limiting e proteção contra brute force

## Executando o Projeto

O workflow "Start application" executa `npm run dev` que inicia:
- Servidor Express na porta 5000
- Vite dev server para o frontend

## Funcionalidades Recentes

### Chamados (Tickets)
- **Código automático sequencial**: Cada chamado recebe um código único no formato CHA-0001, CHA-0002, etc.
- **Campos de classificação**: Tipo (Bug, Melhoria, Negócio) e Local (RS, RG, Dash, One, Home, Omie, Outros)
- **Status bloqueado**: Novo status para tickets que estão aguardando terceiros
- **Visualização Kanban**: Toggle entre Grid/Lista/Kanban com drag-and-drop
- **Exportar Excel**: Download de todos os chamados em formato CSV

### Tarefas
- **Visualização Kanban**: Colunas A Fazer, Em Andamento, Concluído, Arquivado
- **Drag-and-drop**: Arraste tarefas entre colunas para atualizar status

### Login
- **Layout Metronic Classic**: Tela dividida com branding à esquerda e formulário à direita
- **Credenciais de teste**: admin@renov.com.br / admin123

### Configurações
- **Gerenciamento de Campos**: Configurar Categorias, Tipos e Locais dinâmicos

## Componentes Reutilizáveis

### RenovLogo
- **Props**: `variant` (light/dark/white), `size` (sm/md/lg/xl)
- **Uso**: `<RenovLogo size="lg" variant="white" />`

## Preferências do Usuário

- Interface em português brasileiro
- Tema claro como padrão (com suporte a tema escuro)
- Design limpo e moderno seguindo identidade Renov
