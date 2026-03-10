# 📐 RENOV - Code Patterns & Best Practices

## Philosophy: "Vibe Coding" with Standards

We balance **pragmatism** with **quality**. Code should be:
- ✅ Readable by future developers
- ✅ Maintainable without constant refactoring
- ✅ Tested enough to sleep well at night
- ✅ Documented when complexity requires it

**NOT:**
- ❌ Over-engineered for theoretical scale
- ❌ Following patterns "because everyone does"
- ❌ Sacrificing shipping speed for perfection

---

## TypeScript Standards

### ✅ DO: Strict Mode Always
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### ✅ DO: Explicit Types for Public Interfaces
```typescript
// Good
interface TicketFormProps {
  ticketId?: number;
  onSubmit: (data: TicketData) => Promise<void>;
  initialValues?: Partial<TicketData>;
}

export function TicketForm({ ticketId, onSubmit, initialValues }: TicketFormProps) {
  // ...
}

// Bad
export function TicketForm({ ticketId, onSubmit, initialValues }: any) {
  // ...
}
```

### ✅ DO: Infer Internal Types When Obvious
```typescript
// Good - type inferred from schema
const form = useForm({
  resolver: zodResolver(ticketSchema)
})

// Bad - unnecessary explicit typing
const form: UseFormReturn<TicketFormData> = useForm({ ... })
```

### ❌ AVOID: `any` Type
```typescript
// Only acceptable when:
// 1. Interfacing with untyped third-party library
// 2. Temporary during migration
// 3. Truly dynamic data (with runtime validation)

// Example - acceptable use:
function parseUnknownJSON(data: any): Ticket {
  return ticketSchema.parse(data) // Zod validates at runtime
}
```

### ✅ DO: Use `unknown` Instead of `any`
```typescript
// Good
function processData(data: unknown) {
  if (typeof data === 'string') {
    return data.toUpperCase()
  }
  throw new Error('Expected string')
}

// Bad
function processData(data: any) {
  return data.toUpperCase() // No type safety
}
```

---

## React Component Patterns

### File Structure
```
ComponentName/
├── index.tsx              # Component export
├── ComponentName.tsx      # Main component
├── ComponentName.test.tsx # Tests (future)
└── types.ts               # Shared types (if complex)

OR (for simple components):

ComponentName.tsx          # Everything in one file
```

### Component Template
```typescript
// client/src/components/TicketCard.tsx

import React from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// 1. Types first
interface TicketCardProps {
  ticket: {
    id: number
    title: string
    status: 'open' | 'in_progress' | 'closed'
    priority?: 'low' | 'medium' | 'high'
  }
  onClick?: (id: number) => void
  className?: string
}

// 2. Component with explicit props type
export function TicketCard({ ticket, onClick, className }: TicketCardProps) {
  // 3. Event handlers as const
  const handleClick = () => {
    onClick?.(ticket.id)
  }

  // 4. Computed values before render
  const statusColor = {
    open: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    closed: 'bg-green-500'
  }[ticket.status]

  // 5. Return JSX
  return (
    <Card 
      className={cn('cursor-pointer hover:shadow-lg', className)}
      onClick={handleClick}
    >
      <CardHeader>
        <h3 className="font-semibold">{ticket.title}</h3>
      </CardHeader>
      <CardContent>
        <Badge className={statusColor}>
          {ticket.status}
        </Badge>
      </CardContent>
    </Card>
  )
}
```

### Hooks Pattern
```typescript
// Custom hook template
function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/tickets')
      setTickets(response.data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  return { tickets, loading, error, refetch: fetchTickets }
}
```

### Form Handling Pattern
```typescript
// With react-hook-form + Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const ticketSchema = z.object({
  title: z.string().min(1, 'Required').max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'])
})

type TicketFormData = z.infer<typeof ticketSchema>

export function TicketForm({ onSubmit }: { onSubmit: (data: TicketFormData) => Promise<void> }) {
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      priority: 'medium'
    }
  })

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data)
      form.reset()
    } catch (error) {
      form.setError('root', { 
        message: error instanceof Error ? error.message : 'Failed' 
      })
    }
  })

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

---

## Backend Patterns

### Route Structure
```typescript
// server/src/routes/tickets.ts
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import * as ticketController from '../controllers/tickets'
import { createTicketSchema, updateTicketSchema } from '../schemas/tickets'

const router = Router()

// List
router.get('/', 
  requireAuth, 
  ticketController.list
)

// Get one
router.get('/:id', 
  requireAuth, 
  ticketController.getById
)

// Create
router.post('/', 
  requireAuth, 
  validate(createTicketSchema), 
  ticketController.create
)

// Update
router.put('/:id', 
  requireAuth, 
  validate(updateTicketSchema), 
  ticketController.update
)

// Delete
router.delete('/:id', 
  requireAuth, 
  ticketController.remove
)

export default router
```

### Controller Pattern
```typescript
// server/src/controllers/tickets.ts
import { Request, Response } from 'express'
import { db } from '../database/db'
import { tickets } from '../database/schema'
import { eq } from 'drizzle-orm'

export async function list(req: Request, res: Response) {
  try {
    const userId = req.user!.id
    const allTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.createdBy, userId))

    res.json({ 
      success: true, 
      data: allTickets 
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tickets' 
    })
  }
}

export async function create(req: Request, res: Response) {
  try {
    const userId = req.user!.id
    const [newTicket] = await db
      .insert(tickets)
      .values({
        ...req.body,
        createdBy: userId
      })
      .returning()

    res.status(201).json({ 
      success: true, 
      data: newTicket 
    })
  } catch (error) {
    console.error('Error creating ticket:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create ticket' 
    })
  }
}
```

### Database Query Patterns
```typescript
// Good - Type-safe Drizzle queries
const openTickets = await db
  .select()
  .from(tickets)
  .where(eq(tickets.status, 'open'))

// Good - With joins
const ticketsWithAssignee = await db
  .select({
    id: tickets.id,
    title: tickets.title,
    assigneeName: users.name
  })
  .from(tickets)
  .leftJoin(users, eq(tickets.assignedTo, users.id))

// Avoid - Raw SQL (unless absolutely necessary)
await db.execute(sql`SELECT * FROM tickets WHERE status = 'open'`)
```

---

## Error Handling

### Frontend
```typescript
// Component-level
try {
  await api.post('/tickets', data)
  toast.success('Ticket created')
} catch (error) {
  if (axios.isAxiosError(error)) {
    toast.error(error.response?.data?.error || 'Request failed')
  } else {
    toast.error('Unexpected error')
  }
}

// Global error boundary (future)
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

### Backend
```typescript
// Middleware error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err)
  
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors
    })
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  })
})
```

---

## Security Patterns

### Input Validation
```typescript
// ALWAYS validate on backend
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100)
})

// Don't trust frontend validation alone
router.post('/users', validate(createUserSchema), async (req, res) => {
  // req.body is now validated
})
```

### SQL Injection Prevention
```typescript
// Good - Drizzle ORM prevents injection
await db.select().from(tickets).where(eq(tickets.id, userId))

// Bad - Never concatenate user input
await db.execute(`SELECT * FROM tickets WHERE user_id = ${userId}`)
```

### Authentication
```typescript
// Require auth middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies.sessionId
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const session = await getSession(sessionId)
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  req.user = session.user
  next()
}
```

### Secrets Management
```typescript
// Never commit secrets
// ❌ const API_KEY = 'sk-or-v1-abc123'

// ✅ Use environment variables
const API_KEY = process.env.OPENROUTER_API_KEY
if (!API_KEY) throw new Error('Missing OPENROUTER_API_KEY')
```

---

## Code Organization

### Import Order
```typescript
// 1. External libraries
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// 2. Internal utilities
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

// 3. Components
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// 4. Types
import type { Ticket } from '@/types'

// 5. Styles (if any)
import './styles.css'
```

### Naming Conventions
```typescript
// Components: PascalCase
export function TicketCard() {}

// Hooks: camelCase with 'use' prefix
export function useTickets() {}

// Utilities: camelCase
export function formatDate() {}

// Constants: UPPER_SNAKE_CASE
export const API_BASE_URL = 'https://api.renov.com'

// Types/Interfaces: PascalCase
export interface TicketFormProps {}
export type TicketStatus = 'open' | 'closed'
```

---

## Performance

### React Optimization
```typescript
// Memoization when expensive
const expensiveValue = useMemo(() => {
  return tickets.filter(/* complex logic */)
}, [tickets])

// Callback memoization for child components
const handleClick = useCallback((id: number) => {
  // ...
}, [])

// Don't over-optimize
// ❌ const name = useMemo(() => user.name, [user])
// ✅ const name = user.name
```

### Database Optimization
```typescript
// Good - Select only needed fields
await db.select({
  id: tickets.id,
  title: tickets.title
}).from(tickets)

// Avoid - Select all fields when only need few
await db.select().from(tickets)

// Add indexes on foreign keys
pgTable('tickets', {
  assignedTo: integer('assigned_to')
    .references(() => users.id)
    .index() // ← Index for faster joins
})
```

---

## Testing (Future Standards)
```typescript
// Unit test example (when implemented)
describe('TicketCard', () => {
  it('renders ticket title', () => {
    const ticket = { id: 1, title: 'Test', status: 'open' }
    render(<TicketCard ticket={ticket} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('calls onClick with ticket id', () => {
    const onClick = vi.fn()
    const ticket = { id: 1, title: 'Test', status: 'open' }
    render(<TicketCard ticket={ticket} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith(1)
  })
})
```

---

## Documentation

### When to Comment
```typescript
// ✅ DO comment complex business logic
// Calculate trade-in value with depreciation model:
// New devices: 80% of retail
// 6-12 months: 60% of retail  
// 12-24 months: 40% of retail
// > 24 months: 20% of retail
const value = calculateTradeInValue(device)

// ❌ DON'T comment obvious code
// Set the user name
setUserName(name)
```

### JSDoc for Public APIs
```typescript
/**
 * Fetches ticket details with related data
 * @param ticketId - The ticket ID to fetch
 * @param includeComments - Whether to include comments (default: false)
 * @returns Promise resolving to ticket with optional comments
 * @throws {NotFoundError} If ticket doesn't exist
 */
export async function getTicket(
  ticketId: number, 
  includeComments = false
): Promise<TicketWithComments> {
  // ...
}
```

---

## Git Commit Standards
```
tipo(escopo): título conciso (max 72 chars)

- Mudança específica 1
- Mudança específica 2
- Fix relacionado

Tipos:
- feat: nova feature
- fix: correção de bug
- docs: documentação
- style: formatação (não afeta código)
- refactor: refatoração sem mudar comportamento
- perf: melhoria de performance
- test: adicionar/corrigir testes
- build: mudanças no build system
- ci: mudanças no CI
- chore: outras mudanças (deps, etc)

Exemplo:
feat(tickets): adiciona filtro por status

- Novo dropdown no header da lista
- Query Drizzle com filtro condicional
- Estado local para seleção do filtro

Closes #42
```

---

## Code Review Checklist

**Marcelo reviews every PR for:**
- [ ] TypeScript: No `any` types
- [ ] Validation: Zod schemas on backend
- [ ] Security: No SQL injection, XSS prevention
- [ ] Errors: Proper try/catch and error responses
- [ ] Patterns: Follows established conventions
- [ ] Tests: (Future) Has relevant tests
- [ ] Commits: Follows convention

---

These patterns aren't rules to memorize - they're guidelines that emerged from building Renov. When in doubt, look at existing code and follow the pattern. When patterns don't serve you, question them. Pragmatism > dogma. 🚀
