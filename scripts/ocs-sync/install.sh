#!/bin/bash
# Instala a sincronização do OCS na máquina do OCS (rodar lá, com sudo):
#   sudo bash install.sh "<segredo ASSET_SYNC_SECRET>"
# Detalhes: docs/ocs-equipamentos-setup.md
set -euo pipefail
SECRET="${1:?informe o segredo ASSET_SYNC_SECRET}"
API_URL="${CHAMADOS_API_URL:-https://pitzi-home-api.rodrigo-doratioto.workers.dev}"
DIR="$(cd "$(dirname "$0")" && pwd)"

install -d -m 755 /opt/ocs-sync
install -m 755 -o root -g root "$DIR/ocs_sync.py" /opt/ocs-sync/ocs_sync.py
umask 077
printf 'CHAMADOS_API_URL=%s\nASSET_SYNC_SECRET=%s\n' "$API_URL" "$SECRET" > /etc/ocs-sync.env
chmod 600 /etc/ocs-sync.env
printf '%s\n' "# Inventário do OCS → sistema de chamados (docs/ocs-equipamentos-setup.md)" \
  "15 * * * * root /usr/bin/python3 /opt/ocs-sync/ocs_sync.py >> /var/log/ocs-sync.log 2>&1" > /etc/cron.d/ocs-sync
chmod 644 /etc/cron.d/ocs-sync

python3 /opt/ocs-sync/ocs_sync.py --dry-run | tail -1
echo "Instalado. Primeiro envio: sudo python3 /opt/ocs-sync/ocs_sync.py"
