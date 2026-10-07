// worker/src/routes/assets.ts
// Equipamentos: sincronização vinda do OCS Inventory (script na máquina do OCS) e consulta
// pelos técnicos. A pessoa de cada máquina é ligada pelo nome (shared/assets.ts).
import { Hono, type MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { secretMatches } from "../lib/crypto";
import { sameTenant } from "../../../shared/tenant";
import { assetSyncPayloadSchema, assetUserMatches } from "../../../shared/assets";
import { isTechnicianUserId } from "../../../server/services/user-type.service";
import type { Asset, User } from "../../../shared/schema";

export const assetsRoutes = new Hono<AppEnv>();

const requireTechnician: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (user.role === "admin") return next();
  if (!(await isTechnicianUserId(getStorage(c.get("db")), user.userId))) {
    return c.json({ error: "Apenas técnicos" }, 403);
  }
  return next();
};

/** Pessoa cadastrada que usa a máquina (pelo usuário informado no OCS), se houver. */
function personOf(asset: Asset, people: User[]) {
  const person = people.find(p => p.status === "active" && assetUserMatches(asset.userLabel, p));
  return person ? { id: person.id, name: person.name, email: person.email } : null;
}

// POST /api/v1/assets/sync — lista completa do inventário. Rota pública: autenticada pelo
// header X-Asset-Sync-Secret (segredo ASSET_SYNC_SECRET no Worker).
assetsRoutes.post("/api/v1/assets/sync", async (c) => {
  if (!secretMatches(c.req.header("X-Asset-Sync-Secret"), c.env.ASSET_SYNC_SECRET)) {
    return c.json({ error: "Nao autorizado" }, 401);
  }
  const parsed = assetSyncPayloadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Inventário inválido", details: parsed.error.issues.slice(0, 5) }, 400);
  }
  // Lista vazia inativaria tudo: provavelmente falha na leitura do OCS, então é recusada.
  if (parsed.data.assets.length === 0) return c.json({ error: "Inventário vazio" }, 400);

  const tenantId = c.env.ASSET_SYNC_TENANT_ID || null;
  const result = await getStorage(c.get("db")).syncAssets(tenantId, parsed.data.source, parsed.data.assets);
  console.log(JSON.stringify({ event: "assets_synced", source: parsed.data.source, ...result }));
  return c.json({ ok: true, received: parsed.data.assets.length, ...result });
});

// GET /api/v1/assets — equipamentos do tenant com a pessoa ligada (técnicos).
assetsRoutes.get("/api/v1/assets", requireTechnician, async (c) => {
  const { tenantId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const [list, people] = await Promise.all([storage.getAssets(tenantId ?? null), storage.getUsers()]);
  const tenantPeople = people.filter(p => sameTenant(p.tenantId, tenantId));
  return c.json(list.map(a => ({ ...a, person: personOf(a, tenantPeople) })));
});

// GET /api/v1/assets/:id — ficha do equipamento com os chamados dele (técnicos).
assetsRoutes.get("/api/v1/assets/:id", requireTechnician, async (c) => {
  const { tenantId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const asset = await storage.getAsset(c.req.param("id"));
  if (!asset || !sameTenant(asset.tenantId, tenantId)) return c.json({ error: "Equipamento não encontrado" }, 404);
  const [people, ticketList] = await Promise.all([
    storage.getUsers(),
    storage.getTicketsByAsset(asset.id, tenantId ?? null),
  ]);
  const tenantPeople = people.filter(p => sameTenant(p.tenantId, tenantId));
  return c.json({ ...asset, person: personOf(asset, tenantPeople), tickets: ticketList });
});
