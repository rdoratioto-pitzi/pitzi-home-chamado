# Backend Fixes Plan

This plan addresses three main issues identified in the backend implementation:
1. Inefficient in-memory filtering for tickets.
2. Missing authorization checks on user management routes.
3. Suboptimal error handling in `getSessionUser`.

## 1. Database-Level Ticket Filtering

### Current State
`GET /api/tickets` fetches all tickets from the database and filters them in the route handler based on the user's role and ID.

### Proposed Change
Modify `IStorage.getTickets` to accept optional filters and implement the filtering logic using Drizzle ORM in `DatabaseStorage`.

#### `server/storage.ts`
- Update `IStorage` interface:
  ```typescript
  getTickets(filters?: { requesterId?: string; assigneeId?: string }): Promise<Ticket[]>;
  ```
- Update `DatabaseStorage.getTickets`:
  ```typescript
  async getTickets(filters?: { requesterId?: string; assigneeId?: string }): Promise<Ticket[]> {
    if (!db) return [];
    try {
      let query = db.select().from(tickets);
      if (filters) {
        const conditions = [];
        if (filters.requesterId && filters.assigneeId) {
          conditions.push(or(eq(tickets.requesterId, filters.requesterId), eq(tickets.assigneeId, filters.assigneeId)));
        } else if (filters.requesterId) {
          conditions.push(eq(tickets.requesterId, filters.requesterId));
        } else if (filters.assigneeId) {
          conditions.push(eq(tickets.assigneeId, filters.assigneeId));
        }
        
        if (conditions.length > 0) {
          return await query.where(and(...conditions));
        }
      }
      return await query;
    } catch (e) {
      return [];
    }
  }
  ```

#### `server/routes.ts`
- Update `GET /api/tickets` to pass filters to `storage.getTickets`.

---

## 2. Authorization and Error Handling

### Current State
- `getSessionUser` throws a generic `Error`, leading to 500 responses.
- User management routes (`/api/users`) lack `isAdmin` checks.

### Proposed Change
1.  **Improve `getSessionUser`**: Change it to throw a specific error or return a result that can be handled with a 401 status.
2.  **Implement Middleware**: Create `requireAuth` and `requireAdmin` middlewares to centralize authorization logic.

#### `server/routes.ts`
- **New Middlewares**:
  ```typescript
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }
    if (req.session.isAdmin !== true) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  };
  ```

- **Update Routes**:
    - Apply `requireAdmin` to:
        - `GET /api/users`
        - `POST /api/users`
        - `PATCH /api/users/:id`
        - `POST /api/users/:id/reset-password` (already has a check, but can be cleaned up)
    - Update `getSessionUser` to be more robust or replace its usage with the middlewares where appropriate.

---

## Implementation Steps (for Code Mode)

1.  **Modify `server/storage.ts`**:
    - Update `IStorage` interface for `getTickets`.
    - Implement filtered query in `DatabaseStorage.getTickets`.
2.  **Modify `server/routes.ts`**:
    - Define `requireAuth` and `requireAdmin` middlewares.
    - Update `getSessionUser` to return 401-appropriate errors or refactor its usage.
    - Apply `requireAdmin` to all `/api/users` routes.
    - Update `GET /api/tickets` to use the new storage filters.
    - Verify other routes for similar authorization gaps.
