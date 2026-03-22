---
name: brainstorming
description: >
  Structured design dialogue that validates ideas before implementation begins.
  Use when starting any new feature, module, or significant change. Enforces a
  hard gate: no code until design is presented and approved. Trigger on: "vamos
  planejar", "nova feature", "quero criar", "brainstorm", "design session",
  "antes de codar". Works with prompt-renov: brainstorming plans, prompt-renov executes.
---

# Brainstorming — Design Before Code

## Anti-pattern

"Too simple to need design" — EVERYTHING gets a design review. Even a 5-line change
can have architectural implications. The cost of a 2-minute design check is always
lower than the cost of rework.

## Process

1. **Explore context** — understand the current state, constraints, and goals
2. **Clarifying questions** — one at a time, prefer multiple choice when possible
3. **Propose 2-3 approaches** — each with tradeoffs clearly stated
4. **Present design** — recommended approach with reasoning
5. **Get approval** — explicit user confirmation required
6. **Proceed to implementation** — only after approval

## Rules

- Questions are **one per message**, prefer multiple choice when possible
- Always present **recommended approach** with reasoning
- Design sections scaled to complexity:
  - Simple = 3 sentences
  - Medium = bullet list with tradeoffs
  - Complex = full spec with diagrams and data flow
- **Gate: NO code, NO scaffolding, NO file creation until user approves design**
- After approval: transition to implementation (or prompt-renov for execution prompt generation)
- Save design to `docs/` if significant

## Output Format

```
## Contexto
[O que existe hoje e por que estamos mudando]

## Abordagem A — [nome]
- Prós: ...
- Contras: ...

## Abordagem B — [nome]
- Prós: ...
- Contras: ...

## Recomendação
[Abordagem X] porque [razão concreta]

## Próximos passos (após aprovação)
1. ...
2. ...
```
