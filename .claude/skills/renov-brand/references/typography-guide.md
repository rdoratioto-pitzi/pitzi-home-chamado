# Renov Typography Guide

## Font Import

### Via Google Fonts (HTML)

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">
```

### Via next/font (Next.js)

```typescript
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-family',
});
```

### Via CSS @import

```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700;800&display=swap');
```

---

## Type Hierarchy

### Display (Hero sections, landing pages)

```css
.type-display {
  font-family: var(--font-family);
  font-size: 72px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -1px;
  color: var(--l1);
}

@media (max-width: 768px) {
  .type-display {
    font-size: 28px;
    letter-spacing: -0.5px;
  }
}
```

### H1 (Page titles)

```css
.type-h1 {
  font-family: var(--font-family);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--l1);
}
```

### H2 (Section headers)

```css
.type-h2 {
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--l1);
}
```

### H3 (Sub-section headers)

```css
.type-h3 {
  font-family: var(--font-family);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--l2);
}
```

### KPI Value

```css
.type-kpi-value {
  font-family: var(--font-family);
  font-size: 28px;       /* NEVER smaller than 28px */
  font-weight: 700;      /* ALWAYS bold */
  line-height: 1.2;
  color: var(--l1);
}
```

### KPI Label

```css
.type-kpi-label {
  font-family: var(--font-family);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--l1);
  opacity: 0.6;
}
```

### Nav Items

```css
.type-nav {
  font-family: var(--font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--l2);
}
```

### Body Text

```css
.type-body {
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--l1);
}
```

### Labels (Table headers, form labels, chips)

```css
.type-label {
  font-family: var(--font-family);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.3px;
  color: var(--l3);
}
```

### Hints (Helper text, timestamps)

```css
.type-hint {
  font-family: var(--font-family);
  font-size: 11px;
  font-weight: 300;
  line-height: 1.5;
  color: var(--l3);
}

/* CRITICAL: weight 300 must never be used below 14px for readability.
   11px is the exception for hints — but only with --l3 color (low contrast by design).
   For any prominent text at weight 300, enforce min 14px. */
```

### Breadcrumb

```css
.type-breadcrumb {
  font-family: var(--font-family);
  font-size: 12px;
  font-weight: 400;
  color: var(--l3);
}

.type-breadcrumb .current {
  color: var(--l1);
  font-weight: 500;
}
```

---

## Rules

1. **Weight 300 below 14px** — Avoid. Exception: hints at 11px where low contrast is intentional.
2. **UPPERCASE always with letter-spacing** — Use `letter-spacing: 0.5px` to `1.3px` for any uppercase text.
3. **KPI values are always weight 700** — Never use a lighter weight for numbers in KPI cards.
4. **Max 3 weights per screen** — Pick 3 from the range (e.g., 400/600/700) and stick to them. Avoids visual noise.
5. **Stereo Funk is logo-only** — Never use for headings, body, or any other element.
6. **Subtitles use opacity, not --l3** — `color: var(--l1); opacity: 0.6` reads better than `color: var(--l3)`.
