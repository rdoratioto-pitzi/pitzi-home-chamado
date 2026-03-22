---
name: find-skills
description: >
  Discover and install skills from the open ecosystem. Use when user needs a
  capability not covered by existing skills. Trigger on: "find a skill",
  "existe skill para", "preciso de uma skill", "buscar skill".
---

# Find Skills — Discover and Install from Ecosystem

## Discovery

- **CLI**: `npx skills find [query]` — search the skills registry
- **Browse**: https://skills.sh/ — visual catalog of available skills
- **Add**: `npx skills add [package]` — install a skill
- **Check**: `npx skills check` — verify installed skills are up to date

## Quality Check

Before installing any skill, verify:
- Prefer **1K+ installs** for stability
- Prefer **known sources** (vercel-labs, anthropics, snarktank)
- Check last update date — stale skills may be incompatible
- Read the SKILL.md before installing to verify quality

## Presentation Format

When presenting options to the user:

```
| Skill           | Source       | Installs | Description              |
|-----------------|-------------|----------|--------------------------|
| skill-name      | author/repo | 2.3K     | One-line description      |
```

Include install command for each option.

## Categories

- **Web dev**: frontend, backend, API, database
- **Testing**: unit, integration, e2e, coverage
- **DevOps**: CI/CD, Docker, deployment
- **Docs**: documentation, coauthoring, specs
- **Code quality**: linting, review, refactoring
- **Design**: UI/UX, brand, components
- **Productivity**: automation, workflows, efficiency
