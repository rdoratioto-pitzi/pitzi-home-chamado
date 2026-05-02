#!/usr/bin/env bash
# Aplica SQL no banco Neon DEV.
#
# Uso:
#   ./scripts/db-apply-dev.sh "ALTER TABLE foo ADD COLUMN bar text;"
#   ./scripts/db-apply-dev.sh -f migrations/20260502-mentions.sql
#
# Connection string vem do Bitwarden (item: neon-dev-database-url).
# Override: BW_ITEM_DEV=outro-nome ./scripts/db-apply-dev.sh ...
set -euo pipefail

BW_ITEM="${BW_ITEM_DEV:-neon-dev-database-url}"

if ! command -v bw &> /dev/null; then
  echo "❌ Bitwarden CLI (bw) não encontrado. Install: npm i -g @bitwarden/cli"
  exit 1
fi

if ! bw status 2>/dev/null | grep -q '"status":"unlocked"'; then
  echo "❌ Bitwarden está locked. Roda: bw unlock e exporta BW_SESSION"
  exit 1
fi

DB_URL=$(bw get password "$BW_ITEM" 2>/dev/null) || {
  echo "❌ Item '$BW_ITEM' não encontrado no Bitwarden."
  echo "   Crie um item com password = connection string Neon dev."
  exit 1
}

if [ -z "$DB_URL" ]; then
  echo "❌ Item '$BW_ITEM' existe mas password está vazia."
  exit 1
fi

if [ "${1:-}" == "-f" ]; then
  [ -z "${2:-}" ] && { echo "❌ Uso: -f <arquivo>"; exit 1; }
  [ ! -f "$2" ] && { echo "❌ Arquivo não encontrado: $2"; exit 1; }
  echo "🟢 Aplicando $2 no banco DEV..."
  psql "$DB_URL" -f "$2"
else
  [ -z "${1:-}" ] && { echo "❌ Uso: \"<SQL>\" ou -f <arquivo>"; exit 1; }
  echo "🟢 Aplicando SQL inline no banco DEV..."
  psql "$DB_URL" -c "$1"
fi

echo "✅ Aplicado com sucesso no Neon DEV."
