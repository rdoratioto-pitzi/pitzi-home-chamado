import type { Express } from "express";
import { type Server } from "http";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerModularRoutes } from "./routes/index";

// Comment validation schemas (only content needed, userId comes from session)
const taskCommentSchema = z.object({
  content: z.string().min(1, "Comentário não pode ser vazio").max(5000),
});

const ticketCommentSchema = z.object({
  content: z.string().min(1, "Comentário não pode ser vazio").max(5000),
});

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
