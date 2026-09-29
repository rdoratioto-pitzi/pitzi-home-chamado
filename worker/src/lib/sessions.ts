// Sessões = linhas de refresh_tokens. O token de acesso carrega o id da sessão (sid);
// a cada requisição o middleware confere se a sessão existe e se o usuário está ativo,
// então logout, desativação e troca de senha valem na hora, sem esperar o token expirar.
import { and, eq, gt } from "drizzle-orm";
import { refreshTokens, users } from "../../../shared/schema";
import type { AuthUser } from "../index";
import type { Database } from "./db";

/** Estado atual da sessão; null se ela foi encerrada, expirou ou o usuário não está ativo. */
export async function loadActiveSession(
  db: Database,
  userId: string,
  sessionId: string,
): Promise<AuthUser | null> {
  const [row] = await db
    .select({
      tenantId: users.tenantId,
      isAdmin: users.isAdmin,
      status: users.status,
      modulePermissions: users.modulePermissions,
    })
    .from(refreshTokens)
    .innerJoin(users, eq(users.id, refreshTokens.userId))
    .where(and(
      eq(refreshTokens.id, sessionId),
      eq(refreshTokens.userId, userId),
      gt(refreshTokens.expiresAt, new Date()),
    ))
    .limit(1);
  if (!row || row.status !== "active") return null;
  return {
    userId,
    tenantId: row.tenantId ?? null,
    role: row.isAdmin ? "admin" : "user",
    sessionId,
    modulePermissions: row.modulePermissions,
  };
}

export async function endSession(db: Database, sessionId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.id, sessionId));
}
