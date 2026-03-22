---
name: ralph
description: >
  Autonomous AI agent loop that executes PRD items until all are complete.
  Use when a clear PRD/plan exists and tasks can be executed sequentially
  without human intervention between steps. Trigger on: "executa o plano",
  "roda o PRD", "modo autônomo", "ralph", "executa sem parar".
  Always works against develop branch with PR delivery.
---

# Ralph — Autonomous PRD Execution Agent

## Overview

Ralph reads a PRD file and executes items one by one until all are complete.
Each item follows the full git workflow automatically.

## Execution Loop

For each PRD item:
1. **Create branch** — `feat/REN-XXX-description` from `develop`
2. **Implement** — write code following Renov standards
3. **Test** — run tests, verify build passes
4. **Commit** — conventional commits format
5. **PR** — create PR against `develop` with reviewer `marcelo-maciel`
6. **Next item** — move to the next PRD item

## Stop Conditions

Ralph STOPS execution when:
- Build fails (`npm run build` errors)
- TypeScript errors (`npm run check` fails)
- Test failures
- Ambiguous requirement — needs human clarification
- All items complete

## PRD Format

Ralph expects a numbered list with clear acceptance criteria:

```markdown
## PRD: [Feature Name]

1. **[Item title]**
   - Acceptance: [clear, testable criteria]
   - Files: [expected files to touch]

2. **[Item title]**
   - Acceptance: [clear, testable criteria]
   - Files: [expected files to touch]
```

## Safety Rules

- **Always** base branch: `develop`
- **Always** deliver via PR (never direct push to main)
- **Always** follow Renov git conventions
- **Always** run `npm run check` before committing
- Report progress after each completed item

## Integration

- Uses `renov-git-workflow` for branch/commit/PR conventions
- Uses `renov-brand` for any UI work
- Repo reference: https://github.com/snarktank/ralph

## Progress Report Format

```
✅ Item 1: [title] — PR #XX
✅ Item 2: [title] — PR #XX
🔄 Item 3: [title] — em progresso
⏳ Item 4: [title] — pendente
```
