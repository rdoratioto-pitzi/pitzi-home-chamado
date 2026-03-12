# Renov Home - Project Guide

## Overview

**Renov Home** is a full-stack internal operational management platform built for the Brazilian company **Renov**. It centralizes multiple business functions into a single web application:

- **Tickets (Chamados):** Support ticket management with priorities, categories, and SLAs
- **Projects (Projetos):** Kanban-based project management
- **Tasks (Tarefas):** Task management with tags, areas, and templates
- **Meetings (Reuniões):** Meeting scheduling and tracking
- **OKRs & Metas:** Objective and key result tracking
- **Logistics (Logística):** Shipping management, Correios integration, reverse logistics
- **Pricing:** Real-time smartphone pricing intelligence
- **Macgyver AI (Chat IA):** AI assistant with internal data access tools
- **Knowledge Base (Biblioteca):** Document management and versioning
- **Git Analytics:** Developer productivity tracking (Claude Code usage, commits)
- **Flowcharts:** Visual process documentation using Excalidraw

The system follows a **"Vibe Coding"** philosophy: pragmatism over over-engineering, learning by doing, and delivering measurable results.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite (with `@replit/vite-plugin-runtime-error-modal` and Replit-specific plugins in dev)
- **Routing:** Wouter (lightweight alternative to React Router)
- **State Management:** TanStack React Query (server state); local React state for UI
- **UI Components:** shadcn/ui (New York style) + Radix UI primitives
- **Styling:** Tailwind CSS with CSS variables for theming (light/dark mode)
- **Fonts:** Montserrat (primary) + Roboto Mono
- **Drag & Drop:** @dnd-kit and @hello-pangea/dnd
- **Diagrams:** Excalidraw (@excalidraw/excalidraw)
- **Code splitting:** All pages are lazy-loaded via `React.lazy()` to minimize initial bundle size

**Path aliases:**
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

**Key frontend entry points:**
- `client/index.html` → `client/src/main.tsx` → `client/src/App.tsx`
- All pages live under `client/src/pages/`
- Shared components under `client/src/components/`

### Backend

- **Runtime:** Node.js with TypeScript (tsx for dev, esbuild for production)
- **Framework:** Express.js
- **Session Management:** express-session with memorystore (in-memory session store)
- **Authentication:** Custom session-based auth (username/password, bcrypt implied); `requireAuth` middleware protects all routes except public ones (`/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/me`)
- **Route Organization:** Modular routes registered via `server/routes/index.ts`
- **Storage Layer:** `server/storage.ts` — a centralized data access layer abstracting all DB operations
- **Email:** Nodemailer (SMTP configurable via env vars)
- **File Storage:** Google Cloud Storage (`@google-cloud/storage`)
- **Background Jobs:** Recurrence job (`server/jobs/recurrence.job`) and Git sync job (`server/jobs/git-sync.job`)

**Production build:**
- Vite builds the client to `dist/public/`
- esbuild bundles the server to `dist/index.cjs`
- Key deps (drizzle-orm, express, pg, etc.) are bundled into the server binary for faster cold starts

### Database

- **Database:** PostgreSQL (required via `DATABASE_URL` env var)
- **ORM:** Drizzle ORM (`drizzle-orm/node-postgres`)
- **Schema:** All table definitions in `shared/schema.ts` — shared between frontend and backend
- **Migrations:** Managed via `drizzle-kit` (config in `drizzle.config.ts`); migration files in `migrations/`
- **Schema push:** `npm run db:push`

**Key tables in `shared/schema.ts`:**
- `tenants` — Multi-tenant support
- `users` — Users with role-based permissions (modulePermissions JSON field)
- `tickets`, `ticket_comments`, `ticket_responsaveis` — Support ticket system
- `projects`, `kanban_columns`, `kanban_cards` — Project/Kanban management
- `tasks`, `task_tags`, `task_areas`, `task_attachments` — Task management
- `objectives`, `key_results`, `key_result_updates` — OKR tracking
- `shipments`, `collection_requests`, `logistica_reversa_pedidos` — Logistics
- `pricing_devices`, `pricing_price_history`, `pricing_alerts` — Pricing intelligence
- `knowledge_documents`, `knowledge_document_versions` — Knowledge base
- `ai_conversations`, `ai_messages`, `ai_spaces` — AI chat history
- `git_repositories`, `git_commits`, `git_branches` — Git analytics
- `claude_code_usage_reports` — AI token usage tracking
- `settings` — Key-value app configuration store
- `flowcharts`, `updates`, `ai_models`, `prompts_library` — Various features

### AI Integration Architecture

- **Primary AI Gateway:** OpenRouter API (`server/openrouter.ts`) — routes to multiple models
- **Supported Models:** Minimax M2.5 (default, cheapest), DeepSeek R1, Claude Sonnet 4, Gemini Flash 2
- **AI Tools System:** `server/ai-tools.ts` — defines tools the AI can call to query internal DB data on-demand (e.g., `search_tickets`)
- **External Data:** `server/external-data.ts` — real-time weather via Open-Meteo (no API key needed)
- **AI Dev Agents (`agents/`):** Separate LangGraph-based multi-agent system (Atlas planner, Turing QA, Giter) using Anthropic Claude — runs independently via `npm run agents` or `agents/src/qa-git.ts`
- **CLI Tool:** `cli/renov-dev.ts` — CLI for running AI development plans via Zeus agent

### Multi-Agent System (`agents/`)

Separate Node.js package with its own `package.json` and `tsconfig.json`:
- **Orchestrator:** LangGraph StateGraph (`agents/src/orchestrator.ts`)
- **Atlas:** Strategic planner agent
- **Turing:** QA validator agent  
- **Giter:** Git operations agent
- **Dependencies:** @langchain/anthropic, @langchain/langgraph, @octokit/rest

### Authentication & Authorization

- Session-based authentication stored server-side (memorystore)
- `SESSION_SECRET` env var required in production
- Users have `isAdmin` boolean and `modulePermissions` JSON field controlling access to each module
- `areaNegocio` (LAB, RH, COM, FIN, MKT, OPS, TI) and `perfilAcesso` (assistente, analista, gestor, diretor) for organizational structure
- Multi-tenant architecture via `tenantId` on most tables (though currently appears to be single-tenant in practice)

### Key Conventions

- **Shared types:** `shared/schema.ts` exports both Drizzle table definitions AND Zod insert schemas — used on both client and server
- **Storage pattern:** All DB access goes through `server/storage.ts` (not direct DB queries in routes)
- **Scripts:** Utility/migration scripts live in `scripts/` directory, run with `npx tsx scripts/name.ts`
- **Git branches:** Always branch from `develop`, never from `main`. Format: `type/description` (feat/, fix/, refactor/, docs/)

---

## External Dependencies

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `SESSION_SECRET` | Express session secret (required in production) |
| `OPENROUTER_API_KEY` | OpenRouter AI gateway |
| `ANTHROPIC_API_KEY` | Direct Anthropic Claude access (AI agents) |
| `GITHUB_TOKEN` | GitHub API for Git analytics and commit sync |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email notifications |
| `APP_URL` | Base URL for email links |
| `GOOGLE_CLOUD_STORAGE_*` | File/image uploads |
| `CLAUDE_USAGE_SECRET` | Secret for Claude token usage reporting endpoint |

### Third-Party Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **OpenRouter** | AI model routing (Minimax, DeepSeek, Gemini) | REST API |
| **Anthropic** | Claude Sonnet 4 direct access | SDK |
| **Google Cloud Storage** | File uploads, images, logos | `@google-cloud/storage` |
| **Correios** | Brazilian postal service — reverse logistics | SOAP XML API |
| **Omie** | ERP integration | REST API (`omie_config` table) |
| **GitHub** | Git analytics, commit sync | REST API via `@octokit/rest` |
| **Open-Meteo** | Free weather data for AI context | REST API (no key needed) |
| **Nodemailer/SMTP** | Email notifications for tickets, tasks | SMTP |
| **Neon** | PostgreSQL hosting (seen in test scripts) | `DATABASE_URL` |
| **Stripe** | Payments (listed in build allowlist) | SDK |

### Key NPM Packages

- `drizzle-orm` + `drizzle-kit` + `drizzle-zod` — ORM + migrations + schema validation
- `@tanstack/react-query` — Server state management
- `wouter` — Lightweight React router
- `shadcn/ui` components + `@radix-ui/*` — UI primitives
- `@dnd-kit/*` + `@hello-pangea/dnd` — Drag and drop
- `@excalidraw/excalidraw` — Flowchart/diagram editor
- `@langchain/langgraph` + `@langchain/anthropic` — AI agent orchestration (agents/ only)
- `express-session` + `memorystore` — Session management
- `nodemailer` — Email
- `xml2js` — Correios SOAP XML parsing
- `bwip-js` — Barcode generation (for shipping labels)
- `xlsx` — Excel export
- `nanoid` — ID generation
- `date-fns` + `date-fns-tz` — Date handling with timezone support