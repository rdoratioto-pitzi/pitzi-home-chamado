# Renov Home

Plataforma interna de gestão da Renov para gerenciamento de chamados, projetos, OKRs, tarefas e logística.

## Visão Geral

O Renov Home é uma aplicação web interna que oferece:

- **Gestão de Chamados**: Sistema de suporte interno para TI, RH, operações, etc.
- **Projetos**: Gerenciamento de projetos com quadros Kanban
- **Tarefas**: Gerenciamento de tarefas por áreas com comentários e reações
- **Reuniões**: Módulo independente para gestão de reuniões com pauta, participantes e atas
- **OKRs**: Objetivos e resultados-chave por trimestre
- **Logística**: Rastreamento, simulação de frete e logística reversa
- **Integrações**: Documentação de APIs internas (BI RS, Pricing), Correios e operadores logísticos
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
│       ├── reunioes/
│       │   ├── index.tsx      # Lista de reuniões
│       │   └── detail.tsx     # Detalhes da reunião
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
- Integrações
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

## Seed Automático

Na inicialização, o servidor executa `server/seed.ts` que:
- Cria usuário admin (admin@renov.com.br / admin123) se não existir
- Cria áreas de tarefas padrão (TI, RH, Operações) se não existirem
- Funciona tanto em desenvolvimento quanto em produção

## Funcionalidades Recentes

### Chamados (Tickets)
- **Código automático sequencial**: Cada chamado recebe um código único no formato CHA-0001, CHA-0002, etc.
- **Campos de classificação**: Tipo (Bug, Melhoria, Negócio) e Local (RS, RG, Dash, One, Home, Omie, Outros)
- **Status bloqueado**: Novo status para tickets que estão aguardando terceiros
- **Visualização Kanban**: Toggle entre Grid/Lista/Kanban com drag-and-drop
- **Exportar Excel**: Download de todos os chamados em formato XLSX
- **Atribuição automática**: Sistema de atribuição baseado em categoria+tipo com balanceamento round-robin
- **Coluna Responsável**: Exibição do responsável na listagem de chamados
- **Seleção manual de responsável**: Campo opcional no formulário de criação
- **Timestamp tracking**: Campos dataAbertura, dataPrimeiraResposta, dataResolucao, dataFechamento
- **Timeline do Chamado**: Visualização completa do ciclo de vida com cálculo de duração
- **Coluna TEMPO ABERTO**: Indicador colorido (verde <24h, amarelo 24-72h, vermelho >72h)
- **Auto-preenchimento de timestamps**: Resolução/fechamento preenchidos ao mudar status, primeira resposta ao comentar

### Notificações por Email
- **Novo chamado criado**: Email enviado ao solicitante com detalhes do ticket
- **Chamado atribuído**: Email enviado ao responsável quando um ticket é atribuído
- **Status alterado**: Email enviado ao solicitante quando o status muda
- **Comentário adicionado**: Email enviado aos envolvidos quando há novo comentário
- **Templates HTML profissionais**: Design responsivo com identidade visual Renov

### Tarefas
- **Visualização Kanban**: Colunas A Fazer, Em Andamento, Concluído, Arquivado
- **Drag-and-drop**: Arraste tarefas entre colunas para atualizar status
- **Ordenação flexível**: Por prioridade (com data como critério secundário), por data (com prioridade como secundário), ou ordem manual personalizada
- **Áreas compartilhadas**: Áreas podem ser privadas ou compartilhadas com membros
- **Módulo independente**: Tarefas são gerenciadas separadamente de reuniões

### Reuniões
- **Módulo independente**: Reuniões agora são gerenciadas em um módulo separado (/reunioes)
- **Áreas compartilhadas**: Utiliza a mesma infraestrutura de áreas do módulo de Tarefas
- **Reuniões recorrentes**: Toggle "Repetir" com opções diária ou semanal (seleção de dias da semana), data de término opcional
- **Participantes múltiplos**: Multi-select para usuários do sistema com busca, suporte a participantes externos via email
- **Convites por email**: Ao criar reunião, envia email com arquivo ICS (calendário) anexado para todos os participantes
- **Pauta com formatação**: Campo de pauta aceita quebras de linha para melhor organização
- **Página de detalhes**: Visualização completa da reunião com todas as informações
- **Limitações ICS (MVP)**: 
  - Convites são enviados apenas na criação (editar/cancelar reuniões não atualiza calendários dos participantes)
  - Conversão de timezone usa date-fns-tz com America/Sao_Paulo (DST-aware)

### Login
- **Layout Metronic Classic**: Tela dividida com branding à esquerda e formulário à direita
- **Credenciais de teste**: admin@renov.com.br / admin123

### Configurações
- **Gerenciamento de Campos**: Configurar Categorias, Tipos e Locais dinâmicos
- **Responsáveis por Chamados**: Definir regras de atribuição automática por categoria+tipo
- **Gerenciamento de Usuários**: Convidar usuários com email automático de boas-vindas

## Componentes Reutilizáveis

### RenovLogo
- **Props**: `variant` (light/dark/white), `size` (sm/md/lg/xl)
- **Uso**: `<RenovLogo size="lg" variant="white" />`

### RichTextarea
- **Componente**: `client/src/components/rich-textarea.tsx`
- **Funcionalidades**:
  - Upload de imagens via seleção de arquivo, drag-and-drop, ou colagem (Ctrl+V)
  - Limite máximo de 5MB por imagem
  - Preview de imagens em grid com opção de remoção
  - Contador de caracteres integrado
- **Props**:
  - `value`, `onChange`: Controle do texto
  - `images`, `onImagesChange`: Controle das imagens anexadas
  - `maxLength`: Limite de caracteres
  - `rows`, `placeholder`: Configuração visual

## Preferências do Usuário

- Interface em português brasileiro
- Tema claro como padrão (com suporte a tema escuro)
- Design limpo e moderno seguindo identidade Renov
