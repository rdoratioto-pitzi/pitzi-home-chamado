#!/usr/bin/env bash
# Aplica SQL no banco Neon PROD. Exige confirmação textual.
#
# Uso:
#   ./scripts/db-apply-prod.sh "ALTER TABLE foo ADD COLUMN bar text;"
#   ./scripts/db-apply-prod.sh -f migrations/20260502-mentions.sql
#
# Connection string vem do Bitwarden (item: neon-prod-database-url).
# Override: BW_ITEM_PROD=outro-nome ./scripts/db-apply-prod.sh ...
set -euo pipefail

BW_ITEM="${BW_ITEM_PROD:-neon-prod-database-url}"

if ! command -v bw &> /dev/null; then
  echo "❌ Bitwarden CLI (bw) não encontrado. Install: npm i -g @bitwarden/cli"
  exit 1
fi

if ! bw status 2>/dev/null | grep -q '"status":"unlocked"'; then
  echo "❌ Bitwarden está locked. Roda: bw unlock e exporta BW_SESSION"
  exit 1
fi

if [ "${1:-}" == "-f" ]; then
  [ -z "${2:-}" ] && { echo "❌ Uso: -f <arquivo>"; exit 1; }
  [ ! -f "$2" ] && { echo "❌ Arquivo não encontrado: $2"; exit 1; }
elif [ -z "${1:-}" ]; then
  echo "❌ Uso: \"<SQL>\" ou -f <arquivo>"
  exit 1
fi

echo "⚠️  Você está prestes a aplicar SQL no banco PROD."
echo "    Isso afeta produção real."
echo "    Digite 'APLICAR EM PROD' para confirmar:"
read -r CONFIRM
[ "$CONFIRM" != "APLICAR EM PROD" ] && { echo "❌ Cancelado."; exit 1; }

DB_URL=$(bw get password "$BW_ITEM" 2>/dev/null) || {
  echo "❌ Item '$BW_ITEM' não encontrado no Bitwarden."
  echo "   Crie um item com password = connection string Neon prod."
  exit 1
}

if [ -z "$DB_URL" ]; then
  echo "❌ Item '$BW_ITEM' existe mas password está vazia."
  exit 1
fi

if [ "${1:-}" == "-f" ]; then
  echo "🟢 Aplicando $2 no banco PROD..."
  psql "$DB_URL" -f "$2"
else
  echo "🟢 Aplicando SQL inline no banco PROD..."
  psql "$DB_URL" -c "$1"
fi

echo "✅ Aplicado com sucesso no Neon PROD."
