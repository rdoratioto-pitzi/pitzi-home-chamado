---
name: hook-development
description: >
  React hooks best practices and development patterns. Use when creating,
  reviewing, or refactoring React hooks. Trigger on: "criar hook", "custom hook",
  "useEffect", "hooks", "refatorar hook". Enforces less-is-more philosophy.
---

# Hook Development — React Hooks Best Practices

## Philosophy: Less is More

Remove unnecessary hooks before adding new ones. Every hook adds complexity,
re-render potential, and cognitive load.

## Core Rules

### Derived State
If it can be computed from existing state, **don't create a hook**.
```tsx
// ❌ Wrong
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// ✅ Right
const fullName = `${firstName} ${lastName}`
```

### useEffect — Side Effects Only
- Network requests, subscriptions, DOM manipulation = useEffect
- Computing derived values, transforming data = NOT useEffect

### Memoization
- `useMemo`/`useCallback` only when **measured** performance issue exists
- Don't memoize preventively — React is already fast

### Renov Patterns
- **Seletores reativos**: `const x = useStore(s => s.x)` — never destructure the whole store
- **sessionStorage persist**: use Zustand persist middleware
- **Query hooks**: wrap TanStack Query in domain hooks (`useDevices()`, `useBids()`)

## Hook Naming

`use[Domain][Action]` — descriptive, domain-scoped names:
- `useBidBroadcast` — broadcasting bid events
- `useTradeInStore` — trade-in state management
- `useDeviceFilters` — device filtering logic

## Composition

Prefer **multiple small hooks** over one large one:
```tsx
// ❌ useTradeIn() with 200 lines
// ✅ useTradeInForm() + useTradeInValidation() + useTradeInSubmit()
```

## Linter Compliance

- `react-hooks/exhaustive-deps` — always follow
- `react-hooks/rules-of-hooks` — never conditional hooks
- Fix warnings, don't suppress with eslint-disable

## Checklist Before Creating a Hook

- [ ] Can this be derived from existing state? (If yes, don't create hook)
- [ ] Is this truly a side effect? (If no, don't use useEffect)
- [ ] Does this hook do ONE thing? (If no, split it)
- [ ] Is the name `use[Domain][Action]`?
- [ ] Are deps exhaustive?
