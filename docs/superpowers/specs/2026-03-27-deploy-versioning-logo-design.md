# Deploy Automático, Versionamento e Logo Fix

**Data:** 2026-03-27
**Status:** Aprovado
**Autor:** Claude Code + Marcelo

## Contexto

Três problemas identificados no Renov Home:

1. Deploy não dispara automaticamente ao fazer merge em `main`/`develop`
2. Sem versionamento visível — impossível saber qual código está em produção
3. Upload de logo do tenant não persiste após reload da página

## Problema 1: Deploy Automático

### Causa Raiz

Os workflows `.github/workflows/deploy-worker.yml` e `deploy-pages.yml` têm filtro `paths:` que restringe o trigger a certos diretórios. Mudanças em arquivos fora desses paths (ex: `server/routes/`) não disparam deploy.

### Solução: Remover filtro de paths

- **deploy-worker.yml:** Remover bloco `paths:` — qualquer push em `main`/`develop` dispara deploy do Worker + migrations
- **deploy-pages.yml:** Remover bloco `paths:` — qualquer push em `main`/`develop` dispara build + deploy do frontend
- Ambos mantêm `workflow_dispatch` para trigger manual

### Trade-off

Deploys desnecessários ao mudar docs/workflows, mas custo baixo (Worker ~10s, Pages ~1min) vs. risco alto de código não deployado.

## Problema 2: Versionamento

### Formato

`YYYY.MM.DD-<commit-hash-7>` — ex: `2026.03.27-abc1234`

### Backend: Endpoint `/api/version`

- Novo endpoint no Worker: `GET /api/version`
- Resposta:
  ```json
  {
    "version": "2026.03.27-abc1234",
    "commit": "abc1234",
    "buildDate": "2026-03-27",
    "environment": "production"
  }
  ```
- Versão injetada via `--var APP_VERSION:2026.03.27-abc1234` no `wrangler deploy` dentro do workflow
- O Worker lê de `env.APP_VERSION` (binding do wrangler)

### Frontend: `VITE_APP_VERSION`

- Workflow do Pages injeta `VITE_APP_VERSION=2026.03.27-def5678` como env var antes do `vite build`
- Acessível via `import.meta.env.VITE_APP_VERSION`

### Badge no Frontend

- Componente `VersionBadge` posicionado no canto inferior esquerdo da sidebar
- Estado colapsado: texto minimalista
- Estado expandido (hover/click): mostra ambas versões:
  ```
  Front: 2026.03.27-abc1234
  Back:  2026.03.27-def5678
  ```
- Versão do back buscada via `GET /api/version` com `staleTime: 0`, `gcTime: 0` (sem cache, busca fresh a cada mount/refocus)
- Se `/api/version` falhar, mostra "Back: offline" em vermelho

## Problema 3: Logo Upload Não Persiste

### Causa Raiz

O upload salva `objectPath` como `/objects/tenantId/uploads/uuid-file` nas settings. O `RenovLogo` renderiza `<img src={value}>` com path relativo. O frontend está em `home.renovsmart.com.br` mas o R2 serve via Worker em `homeapi.renovsmart.com.br`. A URL relativa resolve para o domínio errado do frontend.

### Solução: Frontend prepende API_BASE

No componente `RenovLogo`, ao montar a URL da imagem, prepende `VITE_API_BASE_URL`:

```typescript
const logoUrl = customLogoPath
  ? `${API_BASE}${customLogoPath}`
  : fallbackSvg;
```

### Arquivos afetados

- `client/src/components/renov-logo.tsx` — construção da URL do `<img>`
- `client/src/pages/configuracoes/brand-settings.tsx` — preview após salvar (se aplicável)

### O que NÃO muda

- Upload continua salvando path relativo (`/objects/...`) nas settings
- R2 continua servindo via Worker
- Apenas a construção da URL no frontend é ajustada

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `.github/workflows/deploy-worker.yml` | Remover `paths:`, injetar `APP_VERSION` no deploy |
| `.github/workflows/deploy-pages.yml` | Remover `paths:`, injetar `VITE_APP_VERSION` no build |
| `worker/src/index.ts` | Adicionar endpoint `GET /api/version` |
| `client/src/components/renov-logo.tsx` | Prepender `API_BASE` na URL do logo |
| `client/src/pages/configuracoes/brand-settings.tsx` | Prepender `API_BASE` na preview (se necessário) |
| `client/src/components/VersionBadge.tsx` | Novo componente — badge de versão |
| `client/src/components/app-sidebar.tsx` | Incluir `VersionBadge` na sidebar |
