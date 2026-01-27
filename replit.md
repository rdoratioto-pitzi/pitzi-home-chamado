# Renov Home

Plataforma interna de gestão da Renov para gerenciamento de chamados, projetos, OKRs e logística.

## Visão Geral

O Renov Home é uma aplicação web interna que oferece:

- **Gestão de Chamados**: Sistema de suporte interno para TI, RH, operações, etc.
- **Projetos**: Gerenciamento de projetos com quadros Kanban
- **OKRs**: Objetivos e resultados-chave por trimestre
- **Logística**: Rastreamento e gerenciamento de envios
- **Configurações**: Gerenciamento de usuários, autenticação e marca

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
│       ├── okrs/
│       ├── logistica/
│       └── configuracoes/
server/
├── routes.ts          # Rotas da API
├── storage.ts         # Interface e implementação do storage
└── index.ts           # Entrada do servidor
shared/
└── schema.ts          # Schemas e tipos compartilhados
```

## APIs Disponíveis

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

### OKRs
- `GET /api/objectives` - Listar objetivos
- `POST /api/objectives` - Criar objetivo
- `GET /api/key-results` - Listar key results
- `POST /api/key-results` - Criar key result
- `PATCH /api/key-results/:id` - Atualizar progresso

### Logística
- `GET /api/shipments` - Listar envios
- `POST /api/shipments` - Registrar envio
- `PATCH /api/shipments/:id` - Atualizar status
- `GET /api/shipments/:id/events` - Histórico de eventos

### Usuários
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `PATCH /api/users/:id` - Atualizar usuário

### Configurações
- `GET /api/settings` - Listar configurações
- `GET /api/settings/:key` - Obter configuração específica
- `POST /api/settings` - Salvar configuração (key/value)

## Executando o Projeto

O workflow "Start application" executa `npm run dev` que inicia:
- Servidor Express na porta 5000
- Vite dev server para o frontend

## Preferências do Usuário

- Interface em português brasileiro
- Tema claro como padrão (com suporte a tema escuro)
- Design limpo e moderno seguindo identidade Renov
