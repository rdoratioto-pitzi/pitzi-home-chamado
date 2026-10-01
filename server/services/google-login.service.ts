// Login com Google: encontra o usuário pelo e-mail ou cria no primeiro acesso.
// Usado pelo Worker (worker/src/routes/auth.ts) e pelo Express (server/routes/auth.ts).
import { completeModulePermissions } from "../../shared/permissions";
import { eq, sql } from "drizzle-orm";
import { users, type User } from "../../shared/schema";
import type { GoogleIdentity } from "../../shared/google-id-token";

/** Quem entra pela primeira vez com Google vira "Usuário": abre e acompanha os próprios chamados. */
export const GOOGLE_NEW_USER_PERMISSIONS = completeModulePermissions({ chamados: true });

export type GoogleLoginResult =
  | { ok: true; user: User; created: boolean }
  | { ok: false; reason: "inactive" };

// db: instância Drizzle (node-postgres no Express, neon-http no Worker; mesma API).
export async function findOrProvisionGoogleUser(db: any, identity: GoogleIdentity): Promise<GoogleLoginResult> {
  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${identity.email}`)
    .limit(1);

  if (existing) {
    if (existing.status !== "active") return { ok: false, reason: "inactive" };
    // Mantém papel e tipo; só completa nome/foto que estiverem vazios.
    const patch: Partial<User> = {};
    if (!existing.avatarUrl && identity.picture) patch.avatarUrl = identity.picture;
    if (!existing.name && identity.name) patch.name = identity.name;
    if (Object.keys(patch).length > 0) {
      await db.update(users).set(patch).where(eq(users.id, existing.id));
    }
    return { ok: true, user: { ...existing, ...patch }, created: false };
  }

  const [created] = await db
    .insert(users)
    .values({
      name: identity.name || identity.email.split("@")[0],
      email: identity.email,
      password: null,
      status: "active",
      authMethod: "google",
      avatarUrl: identity.picture,
      isAdmin: false,
      isTechnician: false,
      modulePermissions: GOOGLE_NEW_USER_PERMISSIONS,
    })
    .returning();
  return { ok: true, user: created, created: true };
}
