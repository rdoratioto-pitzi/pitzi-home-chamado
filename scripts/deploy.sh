#!/bin/bash
set -e

cd ~/Documentos/workspaces/renov.home.macmini/Renov.Home

echo "→ Build do frontend..."
npm run build

echo "→ Forçando upload do index.html..."
echo "<!-- deploy $(date) -->" >> dist/public/index.html

echo "→ Deploy Pages (frontend)..."
npx wrangler pages deploy dist/public --project-name renov-home --commit-dirty=true

echo "→ Deploy Worker (backend)..."
cd worker && npm install && npx wrangler deploy --env=""

echo "✓ Deploy completo."
