# Renov Home

## Overview

Renov Home is an internal web platform designed to centralize and streamline various operational aspects for Renov. Its primary purpose is to enhance efficiency across different departments by providing integrated tools for managing customer support tickets, projects, tasks, OKRs, logistics, and real-time pricing for smartphones.

The platform aims to improve internal communication, boost productivity through structured management and automation, provide data-driven insights, optimize logistics, and ensure a consistent brand identity. Key capabilities include comprehensive ticket management, project and task management with visual aids, meeting management, quarterly OKR tracking, a visual flowchart editor, freight simulation, reverse logistics, real-time pricing monitoring, and granular user/permission management.

## User Preferences

- Interface em português brasileiro
- Tema claro como padrão (com suporte a tema escuro)
- Design limpo e moderno seguindo identidade Renov

## System Architecture

Renov Home adopts a client-server architecture with a clear separation of concerns.

**UI/UX Decisions:**
- **Branding:** Adheres to Renov's brand guidelines (Renov Green, Black, White; Montserrat typography).
- **Design System:** Utilizes Shadcn/UI for a consistent and modern look.
- **Responsiveness:** Designed as a responsive web application.
- **Theming:** Supports both light (default) and dark themes.

**Technical Implementations & Feature Specifications:**

- **Frontend:** Developed with React 18 and TypeScript, styled with Tailwind CSS, uses Wouter for routing, TanStack Query for data management, and React Hook Form with Zod for validation. Includes reusable components like `RenovLogo` and `RichTextarea`.
- **Backend:** Built with Node.js and Express in TypeScript, using in-memory storage (MemStorage) for MVP. Exposes a RESTful API at `/api/...`.
- **Authentication & Data Isolation:** Server-side session management with `express-session`, `requireAuth` middleware, and data isolation per module based on user roles and ownership. Admin users have elevated access. Brand settings endpoints (logo_url_light, logo_url_dark, favicon_url) are publicly accessible.
- **Access Control by Module:**
    - **Chat IA:** 100% private per user (no admin bypass).
    - **Chamados (Tickets):** Public - all authenticated users see all tickets.
    - **Projects:** 3-way visibility (private/shared/public) with member management via `projectMembers` table. Private = owner only, Shared = owner + members, Public = all tenant users.
    - **Flowcharts:** Private by default, with optional shared visibility via `permissions` JSON field.
    - **Tags (formerly Task Areas):** Scoped by context (`scope` field: 'tasks' vs 'meetings'). Tasks scope supports only private/shared visibility. Meetings scope supports private/shared/public. Backend validates that tasks scope cannot have public visibility.
    - **Corporate Modules:** Visibility controlled by user `modulePermissions` JSON field.
    - **Dashboard:** Module cards filtered based on user permissions (`modulePermissions`).
- **Multi-tenant Architecture:** Designed with multi-tenancy in mind, incorporating a `tenantId` field in all data structures for future scalability.
- **Module-specific Features:**
    - **Tickets:** Auto-generated codes, categorization, Kanban view, Excel export, automatic assignment, SLA management.
    - **Tasks:** Kanban view, flexible sorting, Tags with private/shared visibility. Tasks appear only under their assigned tag and in "Todas as Tarefas" view.
    - **Meetings:** Standalone module, Tags with private/shared/public visibility, recurring meetings, multi-participant selection, email invitations. Meetings appear only under their assigned tag and in "Todas as Reuniões" view.
    - **Pricing:** Dashboard with KPIs, product analysis, historical graphing, price alerts, detailed product information.
    - **Logistics:** Freight simulation, reverse logistics request forms, tracking, label printing (ZPL format), Romaneios search, CEP validation.
    - **Correios Embalagens:** Packaging types matching official Correios documentation.
- **Email Notifications:** Implemented for key events in Ticket management using professional HTML templates.
- **User Management:** Granular permissions per module, user invitation system.
- **Configuration Management:** Dynamic field configuration and automatic assignment rules.
- **AI Chat Module (Chat IA):** Features a ChatGPT/Gemini-style assistant integrated with platform data. It uses a database for chat history, a backend with SSE for streaming responses, and a frontend with conversation history, markdown rendering, and a dynamic model picker. Includes slash commands, quick prompts, syntax highlighting, follow-up suggestions, and conversation export. Context from all modules, including aggregated statistics, is used to inform AI responses.

## External Dependencies

- **Correios Logística Reversa (SOAP Web Service):** Integration for reverse logistics operations.
- **RS Logística API (Dashboard Renov):** Used by the Logistics module for orders and logistics reports (`https://dash.renovsmart.com.br/api`).
- **RenovSmart API:** Used by the Pricing module to fetch smartphone/iPhone pricing data.
- **PostgreSQL Database:** Used for persistent storage in the Pricing module.
- **Shadcn/UI:** Component library for the frontend.
- **Tailwind CSS:** Utility-first CSS framework.
- **Recharts:** JavaScript charting library for data visualization.
- **xlsx:** Library for Excel file generation and export.
- **html2canvas:** Library for capturing screenshots.
- **date-fns-tz:** Library for timezone-aware date manipulation.
- **OpenRouter API:** Used by the AI Chat module for LLM-powered conversations and dynamic model fetching.
- **react-markdown:** Library for rendering markdown content in AI chat responses.
- **react-syntax-highlighter:** Library for syntax highlighting in AI chat responses.