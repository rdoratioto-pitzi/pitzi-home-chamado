#!/bin/bash
set -e

cd ~/Documentos/workspaces/renov.home.macmini/Renov.Home

echo "→ Build do frontend..."
npm run build

echo "→ Verificando integridade dos assets..."
# Extrai todos os hashes de assets referenciados no index.html
MISSING=0
for asset in $(grep -oP 'src="/assets/[^"]+"|href="/assets/[^"]+"' dist/public/index.html | grep -oP '/assets/[^"]+'); do
  if [ ! -f "dist/public${asset}" ]; then
    echo "  ERRO: ${asset} referenciado no index.html mas NÃO existe em dist/public/"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  echo "ABORTANDO: index.html referencia assets que não existem no build."
  echo "Rode 'npm run build' novamente ou verifique o Vite config."
  exit 1
fi
echo "  Todos os assets referenciados existem no build."

echo "→ Forçando upload do index.html..."
echo "<!-- deploy $(date) -->" >> dist/public/index.html

echo "→ Deploy Pages (frontend)..."
npx wrangler pages deploy dist/public --project-name renov-home --commit-dirty=true

echo "→ Deploy Worker (backend)..."
cd worker && npm install && npx wrangler deploy --env=""

echo "✓ Deploy completo."
