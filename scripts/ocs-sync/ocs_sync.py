#!/usr/bin/env python3
"""Envia o inventário do OCS Inventory para o sistema de chamados (tela Equipamentos).

Roda na máquina do OCS (cron de hora em hora). Lê o MySQL do OCS com a senha do próprio
dbconfig.inc.php e faz POST em /api/v1/assets/sync com o header X-Asset-Sync-Secret.

Configuração em /etc/ocs-sync.env (chmod 600):
  CHAMADOS_API_URL=https://pitzi-home-api.rodrigo-doratioto.workers.dev
  ASSET_SYNC_SECRET=<mesmo valor do segredo ASSET_SYNC_SECRET no Worker>

Uso: python3 ocs_sync.py [--dry-run]   (--dry-run só mostra o que seria enviado)
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime

DBCONFIG = "/usr/share/ocsinventory-reports/ocsreports/dbconfig.inc.php"
ENV_FILE = "/etc/ocs-sync.env"

# Uma linha JSON por máquina. Datas do OCS ficam no fuso do servidor (convertidas abaixo).
QUERY = """
SELECT JSON_OBJECT(
  'externalId', h.ID,
  'name', h.NAME,
  'userLabel', NULLIF(h.USERID, ''),
  'osName', NULLIF(h.OSNAME, ''),
  'cpu', NULLIF(h.PROCESSORT, ''),
  'memoryMb', h.MEMORY,
  'ipAddress', NULLIF(h.IPADDR, ''),
  'lastDate', DATE_FORMAT(h.LASTDATE, '%Y-%m-%dT%H:%i:%s'),
  'serial', NULLIF(b.SSN, ''),
  'manufacturer', NULLIF(b.SMANUFACTURER, ''),
  'model', NULLIF(b.SMODEL, ''),
  'disks', (SELECT JSON_ARRAYAGG(JSON_OBJECT('name', NULLIF(s.NAME, ''), 'type', NULLIF(s.TYPE, ''), 'sizeMb', s.DISKSIZE))
            FROM storages s WHERE s.HARDWARE_ID = h.ID AND s.DISKSIZE > 0),
  'monitors', (SELECT JSON_ARRAYAGG(JSON_OBJECT('manufacturer', NULLIF(m.MANUFACTURER, ''),
                                                'model', NULLIF(COALESCE(NULLIF(m.CAPTION, ''), m.DESCRIPTION), ''),
                                                'serial', NULLIF(m.SERIAL, '')))
               FROM monitors m WHERE m.HARDWARE_ID = h.ID)
)
FROM hardware h
LEFT JOIN bios b ON b.HARDWARE_ID = h.ID
WHERE h.DEVICEID <> '_SYSTEMGROUP_' AND h.DEVICEID <> '_DOWNLOADGROUP_'
"""


def read_env(path):
    values = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def db_settings():
    text = open(DBCONFIG).read()
    def get(name):
        match = re.search(r'"%s"\s*,\s*"([^"]*)"' % name, text)
        return match.group(1) if match else ""
    return {"host": get("SERVEUR_SQL") or "localhost", "user": get("COMPTE_BASE"),
            "password": get("PSWD_BASE"), "db": get("DB_NAME") or "ocs_db"}


def read_inventory():
    cfg = db_settings()
    env = dict(os.environ, MYSQL_PWD=cfg["password"])  # senha fora da linha de comando
    out = subprocess.run(
        ["mysql", "-h", cfg["host"], "-u", cfg["user"], "-N", "-B", "--raw", cfg["db"], "-e", QUERY],
        env=env, check=True, capture_output=True, text=True,
    ).stdout
    offset = datetime.now().astimezone().strftime("%z")
    offset = offset[:3] + ":" + offset[3:]
    assets = []
    for line in out.splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        last = row.pop("lastDate", None)
        assets.append({
            **{k: v for k, v in row.items() if k not in ("disks", "monitors")},
            "externalId": str(row["externalId"]),
            "lastInventoryAt": f"{last}{offset}" if last else None,
            "details": {"disks": (row.get("disks") or [])[:50], "monitors": (row.get("monitors") or [])[:20]},
        })
    return assets


def main():
    dry_run = "--dry-run" in sys.argv
    assets = read_inventory()
    if dry_run:
        print(json.dumps(assets[:3], ensure_ascii=False, indent=2))
        print(f"{len(assets)} equipamentos (nada enviado)")
        return 0
    if not assets:
        print("Inventário vazio: nada enviado", file=sys.stderr)
        return 1

    env = read_env(ENV_FILE)
    url = env["CHAMADOS_API_URL"].rstrip("/") + "/api/v1/assets/sync"
    body = json.dumps({"source": "ocs", "assets": assets}).encode()
    request = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "X-Asset-Sync-Secret": env["ASSET_SYNC_SECRET"],
        "User-Agent": "ocs-sync/1.0",
    })
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            print(f"{datetime.now():%Y-%m-%d %H:%M:%S} {response.read().decode()}")
            return 0
    except urllib.error.HTTPError as error:
        print(f"{datetime.now():%Y-%m-%d %H:%M:%S} erro {error.code}: {error.read().decode()[:500]}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
