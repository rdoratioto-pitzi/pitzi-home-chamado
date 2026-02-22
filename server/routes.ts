import type { Express } from "express";
import { type Server } from "http";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerModularRoutes } from "./routes/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register modular routes
  registerModularRoutes(app);

  // Register Replit Object Storage routes
  registerObjectStorageRoutes(app);

  return httpServer;
}
