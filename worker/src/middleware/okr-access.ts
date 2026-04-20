import type { Context } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { hasModulePermission } from "../../../shared/permissions";

export interface OkrSession {
  userId: string;
  isAdmin: boolean;
}

export type OkrGuard =
  | { ok: true; session: OkrSession }
  | { ok: false; response: Response };

export async function assertOkrAccess(c: Context<AppEnv>): Promise<OkrGuard> {
  const user = c.get("user");
  if (!user) {
    return { ok: false, response: c.json({ error: "Não autenticado" }, 401) };
  }
  if (user.role === "admin") {
    return { ok: true, session: { userId: user.userId, isAdmin: true } };
  }

  const storage = getStorage(c.get("db"));
  const dbUser = await storage.getUser(user.userId);
  if (!dbUser || !hasModulePermission(dbUser, "okrs")) {
    return {
      ok: false,
      response: c.json({ error: "Acesso negado ao módulo OKRs" }, 403),
    };
  }
  return { ok: true, session: { userId: user.userId, isAdmin: false } };
}
