# 🔧 RENOV - Technical Stack Deep Dive

## Project: Renov Home (Internal Operations Platform)

**Repository:** https://github.com/renov-tech/renov-home  
**Branch Strategy:** `develop` (base) → `main` (production)  
**Workspace:** `/Users/macbookm2/Documents/Workspaces/Renov-Home2/Renov.Home`

---

## Frontend Architecture

### Core Framework
```json
{
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "typescript": "5.6.3",
  "vite": "6.0.5"
}
```

### Routing & Navigation
- **react-router-dom:** v6.x
- **Layout:** App-wide sidebar navigation
- **Route Protection:** Authentication guards
- **Deep Linking:** Module-specific URLs

### UI Component Library: shadcn/ui

**Philosophy:** Copy-paste components (not npm package)  
**Location:** `client/src/components/ui/`  
**Base:** Radix UI primitives  
**Styling:** TailwindCSS + CVA (class-variance-authority)

**Key Components:**
```typescript
// Utility
cn() - className merger (clsx + tailwind-merge)

// Layout
Sidebar, SidebarMenu, SidebarMenuItem
Card, CardHeader, CardContent, CardFooter

// Forms
Input, Textarea, Select, Checkbox, Radio
Form (react-hook-form integration)
Label, FormField, FormMessage

// Feedback
Alert, AlertDialog, Dialog, Toast
Progress, Skeleton, Spinner

// Data Display
Table, DataTable (with sorting, filtering)
Badge, Avatar, Separator

// Navigation
Tabs, Accordion, Dropdown
Button, Link
```

**Pattern:**
```typescript
// All components use React.forwardRef
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
```

### Styling System

**TailwindCSS Configuration:**
```javascript
// tailwind.config.js
{
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { ... },
        secondary: { ... },
        // Full design system
      }
    }
  }
}
```

**CSS Variables:** `client/src/index.css`
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  /* ... dark mode overrides */
}
```

### State Management

**No Redux/Zustand - Using:**
- **React Context:** Global state (auth, theme)
- **useState/useReducer:** Local component state
- **React Query (future):** Server state caching

**Current Auth Context:**
```typescript
interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}
```

### Form Handling

**react-hook-form + Zod:**
```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { email: "", password: "" }
})
```

### Data Fetching

**Axios Instance:**
```typescript
// client/src/lib/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true
})

api.interceptors.request.use(/* auth token */)
api.interceptors.response.use(/* error handling */)
```

### Build & Development

**Vite Configuration:**
```typescript
// vite.config.ts
{
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
}
```

**Environment Variables:**
```bash
# .env.development
VITE_API_URL=http://localhost:3000
VITE_ENVIRONMENT=development

# .env.production
VITE_API_URL=https://api.renov.com
VITE_ENVIRONMENT=production
```

---

## Backend Architecture

### Core Framework
```json
{
  "node": "20.x LTS",
  "express": "^4.18.0",
  "typescript": "5.6.3"
}
```

### Project Structure
```
server/
├── src/
│   ├── index.ts           # Entry point
│   ├── routes/            # API routes
│   │   ├── auth.ts
│   │   ├── tickets.ts
│   │   ├── projects.ts
│   │   └── ...
│   ├── controllers/       # Business logic
│   ├── services/          # External integrations
│   ├── middleware/        # Auth, validation, logging
│   ├── utils/             # Helpers
│   └── types/             # TypeScript definitions
├── database/
│   ├── migrations/        # Drizzle migrations
│   ├── schema.ts          # Database schema
│   └── seeds/             # Test data
└── tests/                 # Unit & integration tests
```

### Database Layer: Drizzle ORM

**Why Drizzle:**
- TypeScript-first
- SQL-like query builder
- Type-safe migrations
- No reflection/decorators (lightweight)
- Works with Supabase & Replit DB

**Schema Definition:**
```typescript
// database/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow()
})

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(), // open, in_progress, closed
  priority: text('priority'), // low, medium, high
  assignedTo: integer('assigned_to').references(() => users.id),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})
```

**Querying:**
```typescript
import { db } from './database/db'
import { users, tickets } from './database/schema'
import { eq } from 'drizzle-orm'

// Select
const allUsers = await db.select().from(users)
const admin = await db.select().from(users).where(eq(users.isAdmin, true))

// Insert
await db.insert(users).values({
  email: 'new@user.com',
  password: hashedPassword
})

// Update
await db.update(tickets)
  .set({ status: 'closed' })
  .where(eq(tickets.id, ticketId))

// Join
const ticketsWithUsers = await db
  .select()
  .from(tickets)
  .leftJoin(users, eq(tickets.assignedTo, users.id))
```

**Migrations:**
```bash
# Generate migration
npm run db:generate

# Push to database
npm run db:push

# Studio (GUI)
npm run db:studio
```

### Authentication & Authorization

**Strategy:** Session-based (not JWT for now)
```typescript
// Middleware
async function requireAuth(req, res, next) {
  const sessionId = req.cookies.sessionId
  const session = await db.select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
  
  if (!session[0]) return res.status(401).json({ error: 'Unauthorized' })
  
  req.user = await db.select()
    .from(users)
    .where(eq(users.id, session[0].userId))
    .limit(1)
  
  next()
}

// Usage
router.get('/protected', requireAuth, async (req, res) => {
  res.json({ user: req.user })
})
```

### API Design Patterns

**RESTful Endpoints:**
```
GET    /api/tickets          # List all
GET    /api/tickets/:id      # Get one
POST   /api/tickets          # Create
PUT    /api/tickets/:id      # Update
DELETE /api/tickets/:id      # Delete
```

**Response Format:**
```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: "Error message",
  details: { field: "validation error" } // optional
}
```

### Validation: Zod
```typescript
import { z } from 'zod'

const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'])
})

router.post('/tickets', async (req, res) => {
  try {
    const validated = createTicketSchema.parse(req.body)
    // ... create ticket
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      })
    }
  }
})
```

### Environment Configuration

**Development (.env):**
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/renov_dev
PORT=3000
NODE_ENV=development
SESSION_SECRET=dev-secret-change-in-prod
OPENROUTER_API_KEY=sk-or-v1-...
```

**Production (Replit Secrets):**
```bash
DATABASE_URL=[Replit native DB connection]
PORT=3000
NODE_ENV=production
SESSION_SECRET=[generated secret]
```

---

## Database Schema (Current Modules)

### Core Tables

**Users & Auth:**
```sql
users (id, email, password, name, is_admin, created_at)
sessions (id, user_id, token, expires_at)
```

**Modules:**
```sql
-- Tickets
tickets (id, title, description, status, priority, assigned_to, created_by, created_at, updated_at)
ticket_comments (id, ticket_id, user_id, content, created_at)

-- Projects
projects (id, name, description, status, owner_id, created_at)
project_tasks (id, project_id, title, status, assignee_id, due_date)

-- Meetings
meetings (id, title, description, start_time, end_time, created_by)
meeting_participants (meeting_id, user_id)

-- Logistics
shipments (id, tracking_number, status, origin, destination, created_at)
inventory_items (id, sku, name, quantity, location)

-- Pricing
price_rules (id, product_id, min_price, max_price, active)
price_history (id, product_id, price, timestamp)

-- Knowledge Base
kb_articles (id, title, content, category, author_id, created_at, updated_at)
kb_categories (id, name, parent_id)

-- Business Intelligence
dashboards (id, name, config, user_id)
reports (id, name, query, schedule)
```

---

## Development Workflow

### Git Workflow

**Branches:**
```
main (production) - protected
  ↓
develop (base for all features) - protected
  ↓
feature/module-name (your work)
```

**Commit Convention:**
```
tipo(escopo): título

- Detalhe 1
- Detalhe 2

Tipos: feat, fix, docs, style, refactor, perf, test, build, ci, chore
```

**Example:**
```
feat(tickets): adiciona filtro por prioridade

- Novo dropdown de filtro no header
- Query Drizzle com where condicional
- Testes unitários para filtro

Relacionado: #123
```

### Code Review Process

1. Developer: Push to feature branch
2. Developer: Create PR to `develop`
3. **Marcelo: Review + Approve** (MANDATORY)
4. Developer: Merge após aprovação
5. CI: Tests run on `develop`
6. Deploy: Manual merge `develop` → `main`

### Testing Strategy

**Current:**
- Manual QA in staging
- Validation via TypeScript types

**Future (Recommended):**
```typescript
// Vitest + React Testing Library
describe('TicketForm', () => {
  it('validates required fields', async () => {
    render(<TicketForm />)
    fireEvent.click(screen.getByText('Submit'))
    expect(await screen.findByText('Title is required')).toBeInTheDocument()
  })
})
```

---

## External Integrations

### OpenRouter (Multi-LLM)
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'minimax/minimax-m2.5',
    messages: [{ role: 'user', content: prompt }]
  })
})
```

### Omie ERP (Future)
- Invoice generation
- Customer sync
- Inventory updates

---

## Performance & Optimization

### Frontend
- Code splitting via React.lazy()
- Image optimization (next-gen formats)
- Bundle size monitoring (vite-bundle-visualizer)

### Backend
- Database connection pooling
- Query optimization (indexes on foreign keys)
- Response caching (Redis - future)

### Monitoring (Future)
- Sentry (error tracking)
- LogRocket (session replay)
- Plausible Analytics (privacy-first)

---

This is our stack. Every tool chosen for pragmatism, every pattern battle-tested. 🚀
