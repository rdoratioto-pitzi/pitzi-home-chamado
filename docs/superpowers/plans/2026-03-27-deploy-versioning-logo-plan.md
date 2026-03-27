# Deploy, Versionamento e Logo Fix — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir deploys automáticos, versão visível no front+back, e logo persistente após reload.

**Architecture:** Workflows sem filtro de paths; versão injetada via env vars nos workflows; badge discreto na sidebar mostrando versão front e back; logo fix via prepend de API_BASE na URL.

**Tech Stack:** GitHub Actions, Cloudflare Workers (Hono), Cloudflare Pages (Vite), React, TanStack Query

---

### Task 1: Remover filtro de paths dos workflows

**Files:**
- Modify: `.github/workflows/deploy-worker.yml:8-11`
- Modify: `.github/workflows/deploy-pages.yml:8-13`

- [ ] **Step 1: Remover paths do deploy-worker.yml**

Remover linhas 8-11 do arquivo `.github/workflows/deploy-worker.yml`:

```yaml
# REMOVER estas linhas:
    paths:
      - 'worker/**'
      - 'shared/**'
      - 'server/storage.ts'
```

O bloco `on:` deve ficar:

```yaml
on:
  push:
    branches:
      - main
      - develop

  workflow_dispatch:
```

- [ ] **Step 2: Remover paths do deploy-pages.yml**

Remover linhas 8-13 do arquivo `.github/workflows/deploy-pages.yml`:

```yaml
# REMOVER estas linhas:
    paths:
      - 'client/**'
      - 'shared/**'
      - 'vite.config.ts'
      - 'package.json'
      - 'tsconfig.json'
```

O bloco `on:` deve ficar:

```yaml
on:
  push:
    branches:
      - main
      - develop

  workflow_dispatch:
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-worker.yml .github/workflows/deploy-pages.yml
git commit -m "fix(ci): remover filtro de paths dos workflows de deploy"
```

---

### Task 2: Injetar versão no deploy do Worker

**Files:**
- Modify: `.github/workflows/deploy-worker.yml:39-45`
- Modify: `worker/src/index.ts:33` (type Bindings)

- [ ] **Step 1: Adicionar APP_VERSION ao type Bindings**

Em `worker/src/index.ts`, adicionar ao type `Bindings` (após `GITHUB_WEBHOOK_SECRET`):

```typescript
  APP_VERSION: string;
```

- [ ] **Step 2: Adicionar geração de versão e injeção no workflow**

Em `.github/workflows/deploy-worker.yml`, antes do step "Deploy Worker", adicionar um step para gerar a versão. E no step "Deploy Worker", passar a var:

Adicionar step antes do deploy:

```yaml
      - name: Generate version
        id: version
        run: echo "APP_VERSION=$(date -u +%Y.%m.%d)-$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
```

Alterar o command do step "Deploy Worker" para incluir `--var`:

```yaml
          command: deploy ${{ github.ref == 'refs/heads/develop' && '-e dev' || '' }} --var APP_VERSION:${{ steps.version.outputs.APP_VERSION }}
```

- [ ] **Step 3: Adicionar endpoint GET /api/version no Worker**

Em `worker/src/index.ts`, após o health check (linha 108), adicionar:

```typescript
// Version endpoint
app.get("/api/version", (c) => {
  const version = c.env.APP_VERSION || "dev";
  const parts = version.split("-");
  const commit = parts.length > 1 ? parts[parts.length - 1] : "local";
  const buildDate = parts.length > 1 ? parts.slice(0, -1).join("-") : "local";
  const env = c.env.CORS_ORIGIN?.includes("-dev") ? "development" : "production";
  return c.json({ version, commit, buildDate, environment: env });
});
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts .github/workflows/deploy-worker.yml
git commit -m "feat(worker): adicionar endpoint /api/version com build info"
```

---

### Task 3: Injetar versão no build do Frontend

**Files:**
- Modify: `.github/workflows/deploy-pages.yml:38-41`

- [ ] **Step 1: Adicionar geração de versão no workflow do Pages**

Em `.github/workflows/deploy-pages.yml`, antes do step "Build frontend", adicionar:

```yaml
      - name: Generate version
        id: version
        run: echo "APP_VERSION=$(date -u +%Y.%m.%d)-$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
```

- [ ] **Step 2: Injetar VITE_APP_VERSION no build**

No step "Build frontend", adicionar a env var `VITE_APP_VERSION`:

```yaml
      - name: Build frontend
        run: npx vite build --config vite.config.ts
        env:
          VITE_API_BASE_URL: ${{ github.ref == 'refs/heads/main' && vars.VITE_API_URL || vars.VITE_API_URL_DEV }}
          VITE_APP_VERSION: ${{ steps.version.outputs.APP_VERSION }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "feat(ci): injetar VITE_APP_VERSION no build do frontend"
```

---

### Task 4: Criar componente VersionBadge

**Files:**
- Create: `client/src/components/version-badge.tsx`

- [ ] **Step 1: Criar o componente**

Criar `client/src/components/version-badge.tsx`:

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

interface BackendVersion {
  version: string;
  commit: string;
  buildDate: string;
  environment: string;
}

export function VersionBadge() {
  const [expanded, setExpanded] = useState(false);

  const frontVersion = import.meta.env.VITE_APP_VERSION || "dev";

  const { data: backVersion, isError } = useQuery<BackendVersion>({
    queryKey: ["/api/version"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/version");
      if (!res.ok) throw new Error("Failed to fetch version");
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return (
    <div
      className="px-3 py-2 cursor-pointer select-none"
      onClick={() => setExpanded(!expanded)}
      title="Clique para ver detalhes da versão"
    >
      {expanded ? (
        <div className="space-y-1 text-[10px] font-mono text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Front: {frontVersion}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                isError ? "bg-red-500" : "bg-green-500"
              }`}
            />
            <span>
              Back: {isError ? "offline" : (backVersion?.version ?? "...")}
            </span>
          </div>
        </div>
      ) : (
        <span className="text-[10px] font-mono text-muted-foreground/40">
          v{frontVersion}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/version-badge.tsx
git commit -m "feat(ui): criar componente VersionBadge com versão front e back"
```

---

### Task 5: Adicionar VersionBadge na sidebar

**Files:**
- Modify: `client/src/components/app-sidebar.tsx:6,65,703-704`

- [ ] **Step 1: Importar VersionBadge**

Em `client/src/components/app-sidebar.tsx`, adicionar import após a linha do `RenovLogo`:

```typescript
import { VersionBadge } from "./version-badge";
```

- [ ] **Step 2: Inserir no SidebarFooter**

Substituir o fechamento do componente. Antes da linha `</Sidebar>` (linha 704), adicionar:

```typescript
      <SidebarFooter className="p-0 border-t border-border/40">
        <VersionBadge />
      </SidebarFooter>
```

O trecho final deve ficar:

```typescript
      </SidebarContent>
      <SidebarFooter className="p-0 border-t border-border/40">
        <VersionBadge />
      </SidebarFooter>
    </Sidebar>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/app-sidebar.tsx
git commit -m "feat(ui): adicionar VersionBadge no rodapé da sidebar"
```

---

### Task 6: Fix logo — prepender API_BASE na URL

**Files:**
- Modify: `client/src/components/renov-logo.tsx:1,19-23,33-34,43-44,73-76`
- Modify: `client/src/pages/configuracoes/brand-settings.tsx:9,11-15,119,158-172,213-214,249-250,295-296`

- [ ] **Step 1: Corrigir renov-logo.tsx — adicionar API_BASE ao normalizeObjectPath**

Em `client/src/components/renov-logo.tsx`, substituir a função `normalizeObjectPath` (linhas 19-23):

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function normalizeObjectPath(path: string): string {
  if (!path) return "";
  const normalized = path.startsWith("/objects/")
    ? path
    : `/objects/${path.replace(/^\/objects\/?/, "").replace(/^\//, "")}`;
  return `${API_BASE}${normalized}`;
}
```

- [ ] **Step 2: Corrigir brand-settings.tsx — adicionar API_BASE ao normalizeObjectPath**

Em `client/src/pages/configuracoes/brand-settings.tsx`, substituir a função `normalizeObjectPath` (linhas 11-15):

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function normalizeObjectPath(path: string): string {
  if (!path) return "";
  const normalized = path.startsWith("/objects/")
    ? path
    : `/objects/${path.replace(/^\/objects\/?/, "").replace(/^\//, "")}`;
  return `${API_BASE}${normalized}`;
}
```

- [ ] **Step 3: Corrigir brand-settings.tsx — fetch das settings com credenciais**

Em `brand-settings.tsx`, as queries (linhas 28, 38, 48) usam `fetch("/api/settings/...")` sem credenciais. Substituir por `fetchWithAuth`:

Adicionar import:

```typescript
import { apiRequest, queryClient, fetchWithAuth } from "@/lib/queryClient";
```

Atualizar as 3 queryFn para usar `fetchWithAuth`:

```typescript
// favicon (linha 28)
queryFn: async () => {
  const res = await fetchWithAuth("/api/settings/favicon_url");
  if (!res.ok) return { value: "" };
  return res.json();
},

// light (linha 38)
queryFn: async () => {
  const res = await fetchWithAuth("/api/settings/logo_url_light");
  if (!res.ok) return { value: "" };
  return res.json();
},

// dark (linha 48)
queryFn: async () => {
  const res = await fetchWithAuth("/api/settings/logo_url_dark");
  if (!res.ok) return { value: "" };
  return res.json();
},
```

- [ ] **Step 4: Corrigir renov-logo.tsx — fetch das settings com credenciais**

Em `renov-logo.tsx`, as queries (linhas 33, 43) usam `fetch("/api/settings/...")` sem credenciais. Substituir:

Adicionar import:

```typescript
import { fetchWithAuth } from "@/lib/queryClient";
```

Atualizar as 2 queryFn:

```typescript
// light (linha 33)
queryFn: async () => {
  const res = await fetchWithAuth("/api/settings/logo_url_light");
  if (!res.ok) return { value: "" };
  return res.json();
},

// dark (linha 43)
queryFn: async () => {
  const res = await fetchWithAuth("/api/settings/logo_url_dark");
  if (!res.ok) return { value: "" };
  return res.json();
},
```

- [ ] **Step 5: Corrigir brand-settings.tsx — upload request com credenciais**

Em `brand-settings.tsx`, a chamada de `request-url` (linha 91) usa `fetch` sem credenciais. Substituir:

```typescript
const requestRes = await fetchWithAuth("/api/uploads/request-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: file.name,
    size: file.size,
    contentType: file.type
  })
});
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/renov-logo.tsx client/src/pages/configuracoes/brand-settings.tsx
git commit -m "fix(logo): prepender API_BASE na URL do logo e usar fetchWithAuth"
```

---

### Task 7: Build local e verificação

- [ ] **Step 1: Rodar type check**

```bash
npm run check
```

Esperado: sem erros de TypeScript.

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Esperado: build completa sem erros.

- [ ] **Step 3: Commit final se necessário**

Se houver ajustes de tipo, commitar:

```bash
git add -A
git commit -m "fix: ajustes de tipo pós-build"
```

---

### Task 8: Revisão contra a spec

- [ ] **Step 1: Usar agent code-reviewer para validar contra a spec**

Verificar que todos os itens da spec `docs/superpowers/specs/2026-03-27-deploy-versioning-logo-design.md` foram implementados:

1. Filtro de paths removido dos dois workflows
2. Endpoint `/api/version` retorna `{ version, commit, buildDate, environment }`
3. `VITE_APP_VERSION` injetado no build do Pages
4. `VersionBadge` na sidebar mostrando front e back, sem cache
5. Logo fix: `API_BASE` prepended na URL

---

### Task 9: Testes com Playwright

- [ ] **Step 1: Iniciar servidor local**

```bash
npm run dev
```

- [ ] **Step 2: Testar VersionBadge**

Navegar para `/workspace`, verificar que o badge aparece no rodapé da sidebar com texto `vdev` (local). Clicar para expandir e verificar que mostra "Front: dev" e "Back: ..." ou "Back: offline".

- [ ] **Step 3: Testar logo upload**

Navegar para `/configuracoes`, tab de brand. Upload de um logo PNG. Verificar que após confirmar e recarregar a página, o logo persiste.

- [ ] **Step 4: Testar endpoint /api/version**

Abrir `http://localhost:5050/api/version` (via proxy) e verificar resposta JSON.
