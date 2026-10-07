# Equipamentos (OCS Inventory → chamados)

O inventário do OCS aparece em **Equipamentos** (menu dos técnicos). Cada chamado novo recebe
a máquina de quem abriu, e o técnico pode trocar o equipamento na gaveta ou na página do chamado.
Na ficha do equipamento aparecem os chamados dele.

## Como funciona

- `scripts/ocs-sync/ocs_sync.py` roda na máquina do OCS (cron de hora em hora), lê o MySQL do
  OCS (senha do próprio `dbconfig.inc.php`) e envia a lista completa para
  `POST /api/v1/assets/sync`, com o header `X-Asset-Sync-Secret`.
- O OCS não fica exposto: a conexão sai da rede interna para o Worker.
- Máquina que some do OCS fica **inativa** (os chamados continuam apontando para ela).
- A pessoa é ligada pelo campo "usuário" do OCS: nome completo, login do e-mail
  (`julia.granato`) ou primeiro + último nome (`shared/assets.ts`). Quem ainda não entrou no
  sistema passa a aparecer ligado depois do primeiro login.

## Instalação

1. Segredo no Worker (o mesmo valor vai para a máquina do OCS):
   ```bash
   cd worker; set -a; . ~/.cloudflare-token; set +a
   npx wrangler secret put ASSET_SYNC_SECRET < ~/.ocs-sync-secret
   ```
2. Na máquina do OCS:
   - `/opt/ocs-sync/ocs_sync.py` (este script);
   - `/etc/ocs-sync.env` (chmod 600, root):
     ```
     CHAMADOS_API_URL=https://pitzi-home-api.rodrigo-doratioto.workers.dev
     ASSET_SYNC_SECRET=<segredo>
     ```
   - `/etc/cron.d/ocs-sync`:
     ```
     15 * * * * root /usr/bin/python3 /opt/ocs-sync/ocs_sync.py >> /var/log/ocs-sync.log 2>&1
     ```
3. Teste: `sudo python3 /opt/ocs-sync/ocs_sync.py --dry-run` (só mostra) e
   `sudo python3 /opt/ocs-sync/ocs_sync.py` (envia; responde `created/updated/deactivated`).
