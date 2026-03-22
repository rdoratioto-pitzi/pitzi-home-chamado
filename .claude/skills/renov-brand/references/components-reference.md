# Renov Components Reference

Detailed CSS examples for every core component. All values reference `tokens.css`.

---

## 1. Sidebar Navigation

```css
.sidebar {
  width: var(--sidebar-expanded);
  background: var(--bg1);
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  padding: var(--sp-lg) 0;
  transition: width var(--transition-base);
  z-index: 100;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed);
}

.sidebar .group-label {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 1.3px;
  color: var(--l3);
  padding: var(--sp-xl) var(--sp-lg) var(--sp-sm);
}

.sidebar .nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  padding: var(--sp-sm) var(--sp-lg);
  font-size: var(--fs-nav);
  font-weight: var(--fw-medium);
  color: var(--l2);
  border-radius: var(--radius-button);
  margin: 0 var(--sp-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar .nav-item:hover {
  background: var(--bg3);
  color: var(--l1);
}

.sidebar .nav-item.active {
  background: rgba(0, 161, 55, 0.10);
  color: var(--verde-bandeira);
}

.sidebar .nav-item.disabled {
  opacity: 0.3;
  pointer-events: none;
}
```

---

## 2. Top Bar

```css
.topbar {
  height: var(--topbar-height);
  background: var(--bg1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--sp-xl);
  border-bottom: 1px solid var(--l4);
}

.topbar .breadcrumb {
  font-size: var(--fs-nav);
  font-weight: var(--fw-regular);
  color: var(--l3);
}

.topbar .breadcrumb .current {
  color: var(--l1);
  font-weight: var(--fw-medium);
}

.topbar .actions {
  display: flex;
  align-items: center;
  gap: var(--sp-md);
}

.topbar .notification-bell {
  position: relative;
  color: var(--l2);
  cursor: pointer;
}

.topbar .notification-bell .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cor-erro);
}

.topbar .avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg3);
}
```

---

## 3. Page Header

```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-xl) 0 var(--sp-lg);
}

.page-header h1 {
  font-size: var(--fs-title);
  font-weight: var(--fw-bold);
  color: var(--l1);
}

.page-header .subtitle {
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--l1);
  opacity: 0.6;
  margin-top: var(--sp-xs);
}

.page-header .actions {
  display: flex;
  gap: var(--sp-sm);
}
```

---

## 4. KPI Cards

```css
/* Standard KPI Card */
.kpi-card {
  background: var(--bg2);
  border-radius: var(--radius-panel);
  padding: var(--sp-lg);
  min-width: 200px;
}

.kpi-card .label {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--l1);
  opacity: 0.6;
  margin-bottom: var(--sp-sm);
}

.kpi-card .value {
  font-size: var(--fs-kpi-value);
  font-weight: var(--fw-bold);
  color: var(--l1);
}

/* Highlight KPI Card (Verde Floresta background) */
.kpi-card.highlight {
  background: var(--verde-floresta);
}

.kpi-card.highlight .label,
.kpi-card.highlight .value {
  color: #FFFFFF;
  opacity: 1;
}

/* Accent KPI Card (left green border) */
.kpi-card.accent {
  border-left: 3px solid var(--verde-bandeira);
}

/* KPI Strip responsive grid */
.kpi-strip {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sp-md);
}

@media (min-width: 768px) {
  .kpi-strip { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .kpi-strip { grid-template-columns: repeat(4, 1fr); }
}
```

---

## 5. Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--verde-bandeira);
  color: #FFFFFF;
  font-family: var(--font-family);
  font-size: var(--fs-body);
  font-weight: var(--fw-semibold);
  padding: var(--sp-sm) var(--sp-lg);
  border: none;
  border-radius: var(--radius-button);
  cursor: pointer;
  transition: background var(--transition-fast);
  min-height: 36px;
}

.btn-primary:hover {
  background: var(--verde-esmeralda);
}

.btn-primary:active {
  background: var(--verde-musgo);
}

/* Ghost Button */
.btn-ghost {
  background: var(--bg3);
  color: var(--l1);
  font-family: var(--font-family);
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  padding: var(--sp-sm) var(--sp-lg);
  border: none;
  border-radius: var(--radius-button);
  cursor: pointer;
  transition: background var(--transition-fast);
  min-height: 36px;
}

.btn-ghost:hover {
  background: var(--bg4);
}

/* Danger Button */
.btn-danger {
  background: var(--cor-erro);
  color: #FFFFFF;
  font-family: var(--font-family);
  font-size: var(--fs-body);
  font-weight: var(--fw-semibold);
  padding: var(--sp-sm) var(--sp-lg);
  border: none;
  border-radius: var(--radius-button);
  cursor: pointer;
  transition: background var(--transition-fast);
  min-height: 36px;
}

.btn-danger:hover {
  background: #B52828;
}
```

---

## 6. Tier Chips

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-xs);
  padding: 2px var(--sp-sm);
  border-radius: var(--radius-chip);
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chip.diamond {
  background: var(--tier-diamond-bg);
  color: var(--tier-diamond-text);
}

.chip.gold {
  background: var(--tier-gold-bg);
  color: var(--tier-gold-text);
}

.chip.silver {
  background: var(--tier-silver-bg);
  color: var(--tier-silver-text);
}

.chip.bronze {
  background: var(--tier-bronze-bg);
  color: var(--tier-bronze-text);
}
```

---

## 7. Tables

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead th {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--l3);
  text-align: left;
  padding: var(--sp-sm) var(--sp-md);
  border-bottom: 1px solid var(--l4);
}

.data-table tbody td {
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--l1);
  padding: var(--sp-sm) var(--sp-md);
  border-bottom: 1px solid var(--l4);
}

.data-table tbody tr:hover {
  background: var(--bg2);
}
```

---

## 8. Status Indicators

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.live    { background: var(--cor-sucesso); }
.status-dot.pending { background: var(--cor-alerta); }
.status-dot.error   { background: var(--cor-erro); }

.status-label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-sm);
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--l1);
}
```

---

## 9. Forms & Inputs

```css
.form-field {
  margin-bottom: var(--sp-lg);
}

.form-label {
  display: block;
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--l2);
  margin-bottom: var(--sp-xs);
}

.form-input {
  width: 100%;
  padding: var(--sp-sm) var(--sp-md);
  font-family: var(--font-family);
  font-size: var(--fs-body);
  font-weight: var(--fw-regular);
  color: var(--l1);
  background: var(--bg2);
  border: 1px solid var(--l4);
  border-radius: var(--radius-input);
  outline: none;
  transition: border-color var(--transition-fast);
}

.form-input:focus {
  border-color: var(--verde-bandeira);
  box-shadow: 0 0 0 2px rgba(0, 161, 55, 0.15);
}

.form-input::placeholder {
  color: var(--l3);
}
```

---

## 10. Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--sp-sm);
  border-radius: var(--radius-chip);
  font-size: 9px;
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.success {
  background: rgba(0, 161, 55, 0.10);
  color: var(--cor-sucesso);
}

.badge.warning {
  background: rgba(192, 122, 0, 0.10);
  color: var(--cor-alerta);
}

.badge.error {
  background: rgba(197, 48, 48, 0.10);
  color: var(--cor-erro);
}

.badge.info {
  background: rgba(60, 120, 216, 0.10);
  color: var(--cor-info);
}
```

---

## 11. Modals

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.60);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg1);
  border-radius: var(--radius-panel);
  padding: var(--sp-xl);
  max-width: 520px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-content .modal-title {
  font-size: var(--fs-title);
  font-weight: var(--fw-bold);
  color: var(--l1);
  margin-bottom: var(--sp-lg);
}

.app.light .modal-content {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
```
