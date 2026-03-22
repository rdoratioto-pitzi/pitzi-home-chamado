---
name: renov-brand
description: >
  Applies Renov's official brand identity, design system, and visual standards
  to any artifact — HTML pages, React components, dashboards, landing pages,
  presentations, sites, or any web interface for the Renov ecosystem
  (Renov Hub, Renov Home, Renov Smart).
  Use this skill whenever creating, styling, or reviewing any visual output
  related to Renov, trade-in interfaces, marketplace dashboards, or any
  page/component that should carry the Renov look-and-feel.
  Also trigger when the user mentions "Renov brand", "identidade visual Renov",
  "padrão Renov", "design system", "tokens Renov", "cores Renov", or asks to
  build anything for the Renov platform. Even if the user just says
  "cria uma página para o Hub" or "faz um dashboard", use this skill to ensure
  brand compliance.
  This skill takes priority over generic frontend-design choices whenever Renov
  is the context. Also use for mobile-first or responsive layouts targeting the
  Renov ecosystem.
---

# Renov Brand Identity & Design System

## Overview

This skill ensures every visual artifact produced for the Renov ecosystem
faithfully follows the official **Brand Guidelines 2026** and **Design System v1**.
It covers colors, typography, layout, components, dark/light modes, responsive
design, tone of voice, and prohibited vocabulary.

**Core principle:** Verde Bandeira (`#00A137`) is the sole chromatic accent.
Everything else is neutral — blacks, whites, and grays at controlled opacities.

---

## 1. Brand Context

**Renov** — Brazilian company pioneering trade-in of used devices since 2012.
Pivoting from transactional model to decentralized marketplace (Renov Hub).

- **Tagline:** "Renov. Sua Troca Inteligente."
- **Mission:** Utilizar tecnologia para ampliar o poder de compra das pessoas
  atraves de produtos usados

### Ecosystem

| Application   | Role                  | Color                      |
|---------------|-----------------------|----------------------------|
| **Renov Hub** | Marketplace frontend  | Verde Bandeira `#00A137`   |
| **Renov Home**| Internal backoffice   | Azul corporativo           |
| **Renov Smart**| Backend / API        | Cinza tecnico              |
| ~~Renov Go~~  | **DISCONTINUED**      | **Never use**              |

### Logo

Logo swap pattern (dark/light):

```css
.logo-dark  { display: block; }
.logo-light { display: none;  }

.app.light .logo-dark  { display: none;  }
.app.light .logo-light { display: block; }
```

**Rules:** Stereo Funk ONLY for logo. Never distort/rotate/stretch.
Green icon always `#00A137`.

---

## 2. Color System

### Primary Palette

```
Verde Bandeira    #00A137   — Primary action, buttons, links, accents
Verde Esmeralda   #048E33   — Hover states, Diamond chips
Verde Floresta    #068130   — Colored backgrounds (white text ONLY)
Verde Musgo       #066828   — Press states, deep accents
```

### Semantic Colors

```
Sucesso #00A137  ·  Alerta #C07A00  ·  Erro #C53030  ·  Info #3C78D8
```

### Label Colors (Apple HIG)

| Token  | Dark Mode                 | Light Mode               | Usage                        |
|--------|---------------------------|--------------------------|------------------------------|
| `--l1` | `rgba(255,255,255,0.93)`  | `rgba(0,0,0,0.88)`      | Values, titles, data         |
| `--l2` | `rgba(255,255,255,0.62)`  | `rgba(0,0,0,0.56)`      | Partner names, support       |
| `--l3` | `rgba(255,255,255,0.38)`  | `rgba(0,0,0,0.38)`      | Column headers, timestamps   |
| `--l4` | `rgba(255,255,255,0.18)`  | `rgba(0,0,0,0.18)`      | Separators, disabled         |

**Readability rule:** Subtitles and KPI labels use `color: var(--l1); opacity: 0.5-0.7`
not `var(--l3)`.

### Background Layers

| Token   | Dark      | Light     |
|---------|-----------|-----------|
| `--bg`  | `#0A0A0A` | `#FFFFFF` |
| `--bg1` | `#111113` | `#FFFFFF` |
| `--bg2` | `#161618` | `#FFFFFF` |
| `--bg3` | `#1C1C1F` | `#F5F5F5` |
| `--bg4` | `#222226` | `#EBEBEB` |

**Dark = deep black `#0A0A0A`** (NOT gray).
**Light = pure white `#FFFFFF`** (NEVER gray).

### Tier Colors

```
♦ Diamond  bg: rgba(0,161,55,0.10)  text: #048E33   NPS 90-100
★ Gold     bg: rgba(192,122,0,0.10) text: #C07A00   NPS 75-89
◆ Silver   bg: var(--bg3)           text: var(--l3)  NPS 60-74
  Bronze   bg: rgba(160,80,0,0.10)  text: #A05000   NPS 50-59
```

---

## 3. Dark / Light Mode — CRITICAL

### The `body` problem

`body` is PARENT of `.app`, not descendant. Set background on `.app` AND `.main-content`:

```css
.app { background: var(--bg); min-height: 100vh; }
.main-content { background: var(--bg); }

.app.light { background: #FFFFFF; }
.app.light .main-content { background: #FFFFFF; }
.app.light .sidebar { background: #FAFAFA; }
.app.light .topbar { background: #FAFAFA; }

.app.light .panel,
.app.light .kpi-card {
  background: #FFFFFF;
  border: 1px solid rgba(0,0,0,0.08);
}

.app.light .kpi-card.highlight {
  background: #068130;
}
```

Also toggle via JS:
```js
document.body.style.background = theme === 'light' ? '#FFFFFF' : '#0A0A0A';
```

**Rule:** ZERO dark backgrounds in light mode.

---

## 4. Typography

**Montserrat** everywhere. Weights: 200-800.
**Stereo Funk** — logo only.

| Element        | Weight | Size                        |
|----------------|--------|-----------------------------|
| Display/Hero   | 800    | 42-72px (28px mobile)       |
| Page Title     | 700    | 22px                        |
| KPI Value      | 700    | 28px (never smaller)        |
| KPI Label      | 600    | 10px UPPERCASE              |
| Section Header | 600    | 13px                        |
| Nav Items      | 500    | 12px                        |
| Body Text      | 400    | 12-13px                     |
| Labels         | 600    | 9-10px UPPERCASE, letter-spacing 0.5-1.3px |
| Hints          | 300    | 10-11px (min 14px for weight 300) |

---

## 5. Layout

- **Sidebar:** 224px expanded / 54px collapsed
- **Top Bar:** 46px (breadcrumb + notification + avatar ONLY)
- **Content padding:** 22px
- **Border radius:** 12px panels

---

## 6. Responsive — Mobile-First

- **Breakpoints:** 768px (tablet), 1024px (desktop)
- **Touch targets:** 44px minimum
- **KPI Strip:** 1col → 2col → 4col
- **Sidebar:** hidden below 768px

---

## 7. Vocabulary

**Never:** desconto, preco, discrepancia.
**Use:** Vantagem, Valor de troca, Referencia de mercado, Variacao.

---

## 8. Tokens CSS

Copy complete tokens from `references/tokens.css`.

Import Montserrat:
```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">
```

For detailed specs read:
- `references/components-reference.md`
- `references/typography-guide.md`
- `references/brand-vocabulary.md`
