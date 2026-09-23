// worker/src/routes/support-groups.ts
// Grupos de atendimento: lista para abertura de chamados e gestão de membros (admin).
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import { sameTenant } from "../../../shared/tenant";

export const supportGroups = new Hono<AppEnv>();

const membersSchema = z.object({ userIds: z.array(z.string().min(1)).max(500) });

// GET /api/v1/support-groups — grupos ativos com os membros do tenant do usuário.
supportGroups.get("/api/v1/support-groups", async (c) => {
  const { tenantId } = c.get("user");
  const storage = getStorage(c.get("db"));
  return c.json(await storage.getSupportGroups(tenantId ?? null));
});

// PUT /api/v1/support-groups/:id/members — substitui os membros do grupo (admin).
supportGroups.put("/api/v1/support-groups/:id/members", requireAdmin, async (c) => {
  const { tenantId } = c.get("user");
  const parsed = membersSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Lista de membros inválida" }, 400);

  const storage = getStorage(c.get("db"));
  const groups = await storage.getSupportGroups(tenantId ?? null);
  const group = groups.find(g => g.id === c.req.param("id"));
  if (!group) return c.json({ error: "Grupo não encontrado" }, 404);

  const userIds = Array.from(new Set(parsed.data.userIds));
  for (const userId of userIds) {
    const member = await storage.getUser(userId);
    if (!member || !sameTenant(member.tenantId, tenantId)) {
      return c.json({ error: "Usuário inválido na lista de membros" }, 400);
    }
  }

  await storage.setSupportGroupMembers(group.id, userIds, tenantId ?? null);
  return c.json({ ...group, memberIds: userIds });
});
