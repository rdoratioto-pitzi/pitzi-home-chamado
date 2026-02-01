# Renov Home

## Overview

Renov Home is an internal web platform designed to streamline and centralize various operational aspects for Renov. Its primary purpose is to enhance efficiency across different departments by providing integrated tools for managing customer support tickets, projects, tasks, OKRs (Objectives and Key Results), logistics, and pricing.

The platform aims to:
- **Improve internal communication and collaboration:** By centralizing different workflows into a single system.
- **Boost productivity:** Through structured project and task management, and automated processes.
- **Provide data-driven insights:** With features like OKR tracking and pricing analysis.
- **Optimize logistics operations:** Offering tools for freight simulation, tracking, and reverse logistics.
- **Ensure consistent brand identity:** Through a modern and clean UI/UX aligned with Renov's branding.

Key capabilities include:
- Comprehensive ticket management (internal support for IT, HR, operations).
- Project management with Kanban boards.
- Task management by area, supporting comments and reactions.
- Dedicated module for meeting management including agendas and minutes.
- Quarterly OKR tracking.
- Logistics functionalities: tracking, freight simulation, and reverse logistics.
- Real-time pricing monitoring for smartphones/iPhones via external API integration.
- Documentation of internal APIs (BI RS, Pricing) and integrations with external services like Correios.
- User and permission management with granular control per module.

## User Preferences

- Interface em português brasileiro
- Tema claro como padrão (com suporte a tema escuro)
- Design limpo e moderno seguindo identidade Renov

## System Architecture

Renov Home adopts a client-server architecture with a clear separation of concerns.

**UI/UX Decisions:**
- **Branding:** Adheres strictly to Renov's brand guidelines:
    - Primary Color: Renov Green (#00A137)
    - Secondary Colors: Black (#000000) and White (#FFFFFF)
    - Typography: Montserrat (Regular, Medium, Bold)
- **Design System:** Utilizes Shadcn/UI for components, ensuring a consistent and modern look and feel.
- **Responsiveness:** Designed to be a responsive web application.
- **Theming:** Supports both light (default) and dark themes.

**Technical Implementations & Feature Specifications:**

- **Frontend:**
    - Developed with React 18 and TypeScript.
    - Styled using Tailwind CSS for utility-first styling.
    - Wouter for client-side routing.
    - TanStack Query for efficient data fetching, caching, and state management.
    - React Hook Form with Zod for robust form validation.
    - **Reusable Components:**
        - `RenovLogo`: Customizable logo component with `variant` and `size` props.
        - `RichTextarea`: Advanced textarea supporting image uploads (selection, drag-and-drop, paste), image previews with removal, and character counting.
- **Backend:**
    - Built with Node.js and Express, written in TypeScript.
    - Uses in-memory storage (MemStorage) for MVP data persistence.
    - Exposes a RESTful API at `/api/...`.
- **Multi-tenant Architecture:**
    - Designed for multi-tenancy from the ground up, incorporating a `tenantId` field in all data structures.
    - Ensures data isolation per tenant, allowing for future support of multiple organizations.
- **Module-specific Features:**
    - **Tickets:** Sequential auto-generated codes (e.g., CHA-0001), categorization by Type (Bug, Improvement, Business) and Location, Kanban view with drag-and-drop, Excel export, automatic assignment rules (round-robin), responsible tracking, timestamp tracking (open, first response, resolution, close), SLA management with configurable rules and visual status indicators.
    - **Tasks:** Kanban view with drag-and-drop, flexible sorting (priority, date, manual), support for private and shared areas.
    - **Meetings:** Standalone module, supports shared areas, recurring meetings (daily/weekly), multi-participant selection (internal/external), email invitations with ICS attachments, formatted agendas.
    - **Pricing:** Dashboard with KPIs and charts, detailed product analysis and comparison, historical price graphing, deflation indicators, customizable price alerts, comprehensive product details.
    - **Logistics:** Freight simulation comparing multiple operators, reverse logistics request forms (individual and bulk via import), tracking and order management.
- **Email Notifications:** Implemented for key events in Ticket management (creation, assignment, status change, comments), utilizing professional HTML templates with Renov's branding.
- **User Management:** Granular permissions per module (Tickets, Projects, Tasks, OKRs, Logistics, Pricing, Integrations, Configurations), user invitation system with welcome emails.
- **Configuration Management:** Dynamic field configuration (categories, types, locations), automatic assignment rules for tickets.

## External Dependencies

- **Correios API (SOAP/XML Web Service):** Integrated for reverse logistics functionalities, including requesting reverse postage authorization, canceling orders, tracking orders, revalidating deadlines, requesting label ranges, and calculating verification digits.
- **RenovSmart API:** Used by the Pricing module to fetch smartphone/iPhone pricing data.
- **PostgreSQL Database:** Used for persistent storage in the Pricing module (pricingDevices, pricingPriceHistory, pricingAlerts).
- **Shadcn/UI:** Component library for the frontend.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **Recharts:** JavaScript charting library for data visualization (AreaChart, LineChart, BarChart, PieChart).
- **xlsx:** Library for Excel file generation and export.
- **html2canvas:** Library for capturing screenshots of web pages (used for graphic downloads).
- **date-fns-tz:** Library for timezone-aware date manipulation.
- **OpenRouter API:** Used by the AI Chat module for LLM-powered conversations (model: google/gemini-2.0-flash-001).
- **react-markdown:** Library for rendering markdown content in AI chat responses.

## AI Chat Module

The home page features a ChatGPT/Gemini-style AI assistant interface that integrates with all platform data:

**Architecture:**
- **Database:** `aiConversations` and `aiMessages` tables store chat history
- **Backend:** `/api/ai/chat` endpoint with Server-Sent Events (SSE) for streaming responses
- **Frontend:** Modern chat UI with sidebar for conversation history, markdown rendering for responses
- **Integration:** System prompt includes context from all modules (tickets, projects, tasks, metas, OKRs, pricing, logistics, knowledge base)

**Key Files:**
- `server/openrouter.ts` - OpenRouter API integration with context building
- `server/routes.ts` - AI chat API endpoints
- `client/src/pages/home.tsx` - Chat interface UI
- `shared/schema.ts` - AI conversation and message schemas

**Security:**
- Conversation ownership verification (userId must match)
- Zod validation for request bodies
- API key stored as environment secret (OPENROUTER_API_KEY)

**Note:** Platform data context is loaded globally for AI responses. For multi-tenant deployments, tenant-scoped queries would be needed in `getSystemPrompt()`.