import type { RequestHandler } from "express";
import { isActiveApiPath } from "../../shared/active-routes";

export const activeRoutesMiddleware: RequestHandler = (req, res, next) => {
  if (!isActiveApiPath(req.path)) {
    res.status(404).json({ error: "Módulo indisponível" });
    return;
  }
  next();
};
