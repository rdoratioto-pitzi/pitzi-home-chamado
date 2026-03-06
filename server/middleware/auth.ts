import { Request, Response, NextFunction } from "express";

// Re-exporta as funções de autenticação do módulo principal
// As implementações principais estão em server/auth.ts

export function getSessionUser(req: Request) {
  if (!req.session?.userId) {
    const err = new Error("Unauthorized: No session found");
    (err as any).status = 401;
    throw err;
  }
  return { userId: req.session.userId, isAdmin: req.session.isAdmin === true };
}

// Middleware básico de autenticação - verifica se tem sessão
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }
  next();
};

// Middleware de autenticação com verificação de rota pública
// Este é o padrão usado na aplicação (importado de server/auth.ts)
export function requireAuthWithPublicRoutes(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  const PUBLIC_ROUTES = [
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/me",
  ];

  const isPublic = PUBLIC_ROUTES.some(
    (route) => req.path === route
  );
  if (isPublic) {
    return next();
  }

  if (req.method === "GET" && /^\/api\/settings\/(logo_url_light|logo_url_dark|favicon_url)$/.test(req.path)) {
    return next();
  }

  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  next();
}

// Middleware para verificar se é administrador
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized: No session found" });
  }
  if (req.session.isAdmin !== true) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
};
