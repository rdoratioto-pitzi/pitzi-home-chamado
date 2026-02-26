# Renov Home - Arquitetura Técnica

**🔗 Repositório:** https://github.com/renov-tech/renov-home  
**📅 Última atualização:** Fevereiro 2026

---

## 📊 Visão Geral

O Renov Home é uma aplicação web **full-stack moderna** construída com arquitetura modular, permitindo escalabilidade horizontal e vertical.

### Arquitetura Alto Nível

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│              React 18 + TypeScript                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Tickets  │  │ Projects │  │ Meetings │  ...        │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
                         ↕ REST API
┌─────────────────────────────────────────────────────────┐
│                      BACKEND                            │
│              Express.js + Node.js                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Routes   │  │ Services │  │ Database │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                     DATABASE                            │
│                   PostgreSQL 15+                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend

### Stack Tecnológico

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **React** | 18.x | UI framework principal |
| **TypeScript** | 5.x | Type safety e developer experience |
| **Vite** | Latest | Build tool e dev server |
| **React Router** | v6 | Roteamento SPA |
| **Axios** | Latest | HTTP client |
| **shadcn/ui** | Latest | Componentes UI (se usado) |
| **TailwindCSS** | 3.x | Styling (se usado) |

### Estrutura de Pastas Frontend

```
client/
├── src/
│   ├── components/           # Componentes reutilizáveis
│   │   ├── common/          # Botões, inputs, modals
│   │   ├── layout/          # Header, sidebar, footer
│   │   └── forms/           # Form components
│   │
│   ├── pages/               # Páginas por módulo
│   │   ├── tickets/
│   │   ├── projects/
│   │   ├── meetings/
│   │   ├── macgyver/
│   │   └── ...
│   │
│   ├── modules/             # Lógica de negócio por módulo
│   │   ├── tickets/
│   │   │   ├── api.ts       # Chamadas API
│   │   │   ├── types.ts     # TypeScript types
│   │   │   └── utils.ts     # Utilitários
│   │   └── ...
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── ...
│   │
│   ├── services/            # Serviços compartilhados
│   │   ├── api.ts           # Configuração Axios
│   │   ├── auth.ts          # Autenticação
│   │   └── storage.ts       # LocalStorage wrapper
│   │
│   ├── utils/               # Utilitários gerais
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   │
│   ├── types/               # TypeScript types globais
│   │   └── global.d.ts
│   │
│   ├── styles/              # Estilos globais
│   │   └── globals.css
│   │
│   ├── App.tsx              # Componente raiz
│   └── main.tsx             # Entry point
│
├── public/                  # Assets estáticos
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Padrões Frontend

#### Nomenclatura
- **Componentes:** PascalCase (`UserProfile.tsx`)
- **Hooks:** camelCase com prefixo "use" (`useAuth.ts`)
- **Utilitários:** camelCase (`formatDate.ts`)
- **Constantes:** UPPER_SNAKE_CASE (`API_BASE_URL`)

#### Estrutura de Componente
```typescript
// Imports
import React from 'react';
import type { ComponentProps } from './types';

// Types/Interfaces
interface Props {
  title: string;
  onSubmit: () => void;
}

// Component
export function ComponentName({ title, onSubmit }: Props) {
  // Hooks
  const [state, setState] = React.useState();
  
  // Handlers
  const handleClick = () => {
    // ...
  };
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

#### State Management
- **Local state:** `useState` para estado de componente
- **Formulários:** React Hook Form (se usado)
- **Server state:** TanStack Query / React Query (se usado)
- **Global state:** Context API ou Zustand (definir)

---

## ⚙️ Backend

### Stack Tecnológico

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **Node.js** | 20.x LTS | Runtime JavaScript |
| **Express.js** | 4.x | Web framework |
| **PostgreSQL** | 15+ | Database |
| **Drizzle ORM** | Latest | ORM/Query builder (se usado) |
| **JWT** | Latest | Autenticação (se usado) |
| **Zod** | Latest | Validação de schemas (se usado) |

### Estrutura de Pastas Backend

```
server/
├── src/
│   ├── routes/              # Rotas da API
│   │   ├── index.ts         # Router principal
│   │   ├── auth.ts
│   │   ├── tickets.ts
│   │   ├── projects.ts
│   │   └── ...
│   │
│   ├── controllers/         # Lógica de controle
│   │   ├── ticketsController.ts
│   │   ├── projectsController.ts
│   │   └── ...
│   │
│   ├── services/            # Lógica de negócio
│   │   ├── ticketsService.ts
│   │   ├── projectsService.ts
│   │   └── ...
│   │
│   ├── models/              # Models de dados
│   │   ├── User.ts
│   │   ├── Ticket.ts
│   │   └── ...
│   │
│   ├── middleware/          # Middlewares Express
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── validator.ts
│   │   └── logger.ts
│   │
│   ├── config/              # Configurações
│   │   ├── database.ts
│   │   ├── env.ts
│   │   └── constants.ts
│   │
│   ├── utils/               # Utilitários
│   │   ├── logger.ts
│   │   ├── crypto.ts
│   │   └── validators.ts
│   │
│   └── index.ts             # Entry point
│
├── migrations/              # Database migrations
├── seeds/                   # Database seeds
├── tests/                   # Testes
└── package.json
```

### API REST Conventions

#### Estrutura de Rotas
```
/api/v1/tickets              # Lista tickets
/api/v1/tickets/:id          # Ticket específico
/api/v1/tickets/:id/comments # Sub-recursos

/api/v1/projects
/api/v1/projects/:id
/api/v1/projects/:id/tasks

/api/v1/meetings
/api/v1/meetings/:id
```

#### HTTP Methods
- **GET** - Buscar recursos
- **POST** - Criar recursos
- **PUT/PATCH** - Atualizar recursos
- **DELETE** - Deletar recursos

#### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso"
}

// Erro
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [ ... ]
  }
}
```

---

## 🗄️ Database

### PostgreSQL Schema

#### Convenções
- **Tabelas:** snake_case plural (`users`, `tickets`)
- **Colunas:** snake_case (`created_at`, `user_id`)
- **Primary Keys:** `id` (serial/uuid)
- **Foreign Keys:** `{table}_id` (`user_id`, `ticket_id`)
- **Timestamps:** `created_at`, `updated_at`

#### Schema Principal (Simplificado)

```sql
-- Usuários
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tickets
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  requester_id INTEGER REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- [Outros módulos seguem padrão similar]
```

**Documentação completa do schema:** Ver `/database/schema.sql` ou migrations

---

## 🔐 Autenticação e Autorização

### Estratégia Atual
- **Método:** [JWT / Session-based - definir]
- **Storage:** [LocalStorage / HttpOnly Cookie - definir]
- **Refresh tokens:** [Sim / Não - definir]

### Fluxo de Autenticação

```
1. User → Login (email/password)
2. Backend → Valida credenciais
3. Backend → Gera token/session
4. Backend → Retorna token + user data
5. Frontend → Armazena token
6. Frontend → Inclui token em requests (Authorization header)
7. Backend → Valida token em cada request (middleware)
```

### Níveis de Permissão
- **Admin:** Acesso total
- **Manager:** Acesso a módulos de gestão
- **User:** Acesso básico
- **Guest:** Read-only (se aplicável)

---

## 🔌 Integrações e APIs

### APIs Externas
- **OpenAI API** - Macgyver AI
- **OpenRouter** - Multi-model AI access
- **[Outras APIs]** - Listar conforme implementadas

### Webhooks
- **[Definir]** - Lista de webhooks implementados

**Detalhes:** Ver [04-APIS-INTEGRACAO.md](04-APIS-INTEGRACAO.md)

---

## 🚀 Deploy e Infraestrutura

### Ambientes

| Ambiente | Propósito | URL |
|----------|-----------|-----|
| **Development** | Local dev | localhost:3000 |
| **Staging** | Testes pre-prod | [definir] |
| **Production** | Usuários finais | [definir] |

### Stack de Infraestrutura

#### Histórico (até Fev 2026)
- **Replit:** 
  - 5 colaboradores
  - Core plan
  - Custo: ~$20/mês por dev

#### Atual/Planejado
- **GitHub Codespaces:**
  - 120h/mês grátis por dev
  - Economia: ~$100/mês vs Replit
  - Melhor integração com GitHub

#### Hospedagem
- **Opção 1:** [Vercel / Netlify] - Frontend
- **Opção 2:** [Railway / Render] - Backend + DB
- **Opção 3:** [VPS própria] - Controle total
- **Decisão:** [Definir após análise de custo/benefício]

### CI/CD

#### GitHub Actions (Atual/Planejado)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Install deps
      - Run tests
      - Run linter
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - Build
      - Deploy to [production]
```

---

## 📦 Dependências Principais

### Frontend (`package.json`)

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "axios": "^1.x",
    "typescript": "^5.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@types/react": "^18.x",
    "eslint": "^8.x",
    "prettier": "^3.x"
  }
}
```

### Backend (`package.json`)

```json
{
  "dependencies": {
    "express": "^4.x",
    "pg": "^8.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "nodemon": "^3.x",
    "typescript": "^5.x",
    "@types/express": "^4.x"
  }
}
```

---

## 🧪 Testes

### Estratégia de Testes

- **Unit Tests:** [Jest / Vitest - definir]
- **Integration Tests:** [Supertest - definir]
- **E2E Tests:** [Playwright / Cypress - definir]
- **Coverage mínimo:** [70% - definir]

### Estrutura de Testes

```
tests/
├── unit/
│   ├── services/
│   └── utils/
├── integration/
│   └── api/
└── e2e/
    └── flows/
```

---

## 📊 Monitoramento e Logs

### Logging
- **Biblioteca:** [Winston / Pino - definir]
- **Níveis:** error, warn, info, debug
- **Destino:** Console + File (produção)

### Monitoring (Planejado)
- **Performance:** [Definir ferramenta]
- **Errors:** [Sentry / Definir]
- **Analytics:** [Definir]

---

## 🔒 Segurança

### Práticas Implementadas
- ✅ Variáveis de ambiente para secrets
- ✅ HTTPS em produção (quando houver)
- ✅ Input validation
- ✅ SQL injection prevention (ORM)
- ✅ XSS prevention
- ✅ CORS configurado

### Práticas Planejadas
- 📋 Rate limiting
- 📋 Security headers (Helmet.js)
- 📋 Dependency scanning
- 📋 Regular security audits

---

## ⚡ Performance

### Otimizações Frontend
- Code splitting por rota
- Lazy loading de componentes
- Asset optimization
- Caching estratégico

### Otimizações Backend
- Database indexing
- Query optimization
- Response caching
- Connection pooling

---

## 📱 Responsividade

### Breakpoints
```css
/* Mobile first approach */
mobile: 0-640px
tablet: 641-1024px
desktop: 1025px+
```

### Suporte de Browsers
- Chrome/Edge: Últimas 2 versões
- Firefox: Últimas 2 versões
- Safari: Últimas 2 versões
- Mobile: iOS Safari, Chrome Mobile

---

## 🔄 Versionamento

### Semantic Versioning
- **MAJOR:** Mudanças breaking
- **MINOR:** Novas features (backward compatible)
- **PATCH:** Bug fixes

**Versão atual:** 2.x.x (Fevereiro 2026)

---

## 📚 Recursos Adicionais

- **Documentação completa:** [DOCUMENTACAO_COMPLETA.md](DOCUMENTACAO_COMPLETA.md)
- **Módulos específicos:** [/docs/modules/](modules/)
- **Governança:** [03-GOVERNANCA.md](03-GOVERNANCA.md)

---

**Dúvidas sobre arquitetura?**  
Consulte Marcelo (CTO) ou abra issue no GitHub.

*Última atualização: Fevereiro 2026*
