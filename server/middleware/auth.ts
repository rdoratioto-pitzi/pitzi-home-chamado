import { Request, Response, NextFunction } from "express";

export function getSessionUser(req: Request) {
  if (!req.session?.userId) {
    const err = new Error("Unauthorized: No session found");
    (err as any).status = 401;
    throw err;
  }
  return { userId: req.session.userId, isAdmin: req.session.isAdmin === true };
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }
  if (req.session.isAdmin !== true) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
};
