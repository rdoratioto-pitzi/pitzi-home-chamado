import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.VENUS_API_KEY;

  if (!expectedKey) {
    console.error("[api-key] VENUS_API_KEY not configured");
    return res.status(500).json({ error: "API key not configured on server" });
  }

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ error: "API key ausente — envie via header X-API-Key" });
  }

  const keyBuffer = Buffer.from(apiKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (keyBuffer.length !== expectedBuffer.length || !timingSafeEqual(keyBuffer, expectedBuffer)) {
    return res.status(401).json({ error: "API key inválida" });
  }

  next();
}
