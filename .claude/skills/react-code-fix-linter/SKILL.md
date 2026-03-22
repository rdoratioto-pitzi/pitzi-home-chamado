---
name: react-code-fix-linter
description: >
  Identifies and fixes React code issues: anti-patterns, incorrect hook usage,
  performance problems, linting violations. Use when reviewing, fixing, or
  cleaning React code. Trigger on: "limpar código", "lint", "anti-pattern",
  "performance React", "code review", "fix React".
---

# React Code Fix & Linter

## Common Anti-patterns

### Unnecessary Re-renders
- Components re-rendering without prop/state changes
- Missing `key` prop on list items (or using index as key for dynamic lists)
- Inline function/object creation in render path
- Not using selectors with Zustand (`useStore(s => s.field)`)

### Incorrect Hook Usage
- `useEffect` for derived state (compute inline instead)
- Missing or incorrect dependency arrays
- Conditional hook calls (violates rules-of-hooks)
- `useState` + `useEffect` when `useMemo` suffices

### Prop Drilling
- Passing props through 3+ levels — use context or store
- Spreading entire objects as props when only 1-2 fields needed

## Performance Checklist

- [ ] `React.memo` — only when measured, not preventive
- [ ] Virtualization for lists > 100 items (`react-window`, `@tanstack/virtual`)
- [ ] Lazy loading for route-level code splitting
- [ ] Image optimization (lazy load, proper sizing)
- [ ] Debounce search/filter inputs

## State Management (Renov)

- **Zustand** with reactive selectors: `const x = useStore(s => s.x)`
- **Never** destructure entire store: `const { x, y } = useStore()` — causes re-render on ANY change
- **sessionStorage persist** via Zustand persist middleware
- **Colocate state** — lift only when multiple components need it

## TypeScript

- Props: `interface [Component]Props { ... }`
- Events: `React.ChangeEvent<HTMLInputElement>`, not `any`
- Refs: `useRef<HTMLDivElement>(null)`
- Generics for reusable components

## Fix Workflow

1. Run `npm run check` — fix TypeScript errors first
2. Identify anti-patterns in changed files
3. Fix one category at a time (hooks → state → performance → types)
4. Verify no regressions after each fix
5. Run build to confirm
