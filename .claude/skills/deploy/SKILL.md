---
name: deploy
description: Deploy do Renov Home para produção via Cloudflare Pages — valida tokens, build e publica
---

# Skill: Deploy Renov Home

## Pré-checagem (NUNCA pular)

Execute cada verificação e pare imediatamente se falhar:

```bash
# 1. GitHub token — deve retornar 41
echo $GITHUB_TOKEN | wc -c

# 2. Cloudflare token — deve ser menor que 55
echo $CLOUDFLARE_API_TOKEN | wc -c

# 3. TypeScript — zero erros obrigatório
npx tsc --noEmit
```

**Se tokens corrompidos:** extrair valores limpos do `~/.bashrc` e `export` na sessão atual antes de prosseguir.

## Pipeline de Deploy

Execute em ordem. Parar na etapa que falhar e reportar causa exata.

### Etapa 4 — Criar PR para develop
```bash
gh pr create \
  --base develop \
  --reviewer marcelo-maciel \
  --title "[título descritivo]" \
  --body "$(cat <<'EOF'
## Resumo
- Descrever mudanças

## Test plan
- [ ] Verificar build local
- [ ] Validar em produção após deploy
EOF
)"
```

### Etapa 5 — Atualizar develop
```bash
git checkout develop
git pull origin develop
```

### Etapa 6 — Mergear develop → main
```bash
git checkout main
git merge develop
git push origin main
```

### Etapa 7 — Build
```bash
npm run build
```
Output esperado: pasta `dist/` gerada com o bundle de produção.

### Etapa 8 — Deploy Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name renov-home
```

### Etapa 9 — Confirmar produção
- Acessar o domínio de produção do Renov Home
- Verificar que a build está ativa (checar versão ou feature deployada)

## Em caso de falha

- Parar na etapa que falhou
- Reportar causa exata ao usuário
- Não avançar para próxima etapa
- Se token Cloudflare corrompido (U+2028): `export CLOUDFLARE_API_TOKEN=$(grep CLOUDFLARE_API_TOKEN ~/.bashrc | tail -1 | cut -d'=' -f2)`

## Referências

- **Projeto**: `renov-home` (Cloudflare Pages)
- **Build output**: `dist/`
- **Branch produção**: `main`
- **Branch dev**: `develop`
- **Reviewer padrão**: `marcelo-maciel`
- **Workspace**: `~/Documentos/workspaces/renov.home.macmini/Renov.Home`
