import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { getSessionUser } from "./auth";
import { hasModulePermission } from "../../shared/permissions";

export interface OkrSession {
  userId: string;
  isAdmin: boolean;
}

async function loadOkrAccess(req: Request): Promise<OkrSession | null> {
  const { userId, isAdmin } = getSessionUser(req);
  if (isAdmin) return { userId, isAdmin: true };
  const user = await storage.getUser(userId);
  if (!user) return null;
  if (!hasModulePermission(user, "okrs")) return null;
  return { userId, isAdmin: false };
}

export async function assertOkrAccess(req: Request, res: Response): Promise<OkrSession | null> {
  try {
    const session = await loadOkrAccess(req);
    if (!session) {
      res.status(403).json({ error: "Acesso negado ao módulo OKRs" });
      return null;
    }
    return session;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 401;
    res.status(status).json({ error: "Não autenticado" });
    return null;
  }
}

export function requireOkrAccess(req: Request, res: Response, next: NextFunction) {
  assertOkrAccess(req, res).then((session) => {
    if (session) next();
  });
}
