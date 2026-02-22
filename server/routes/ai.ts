import { Router, Request, Response, NextFunction } from "express";
import { streamChatCompletion, generateTitle, fetchOpenRouterModels } from "../openrouter";
import { requireAuth } from "../middleware/auth";
// Removed import { Message, Attachment } from "../openrouter"; as they are not explicitly exported types

export function registerAIRoutes(app: Router) {
  // POST /api/ai/chat - Stream chat completion
  app.post("/api/ai/chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const { messages, model, attachments } = req.body;
      // Assuming req.session.userId is available after requireAuth middleware
      const options = { userId: req.session?.userId };

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      for await (const chunk of streamChatCompletion(messages, options, model, attachments)) {
        res.write(chunk);
      }
      res.end();
    } catch (error: any) {
      console.error("Error streaming chat completion:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Failed to stream chat completion" });
      } else {
        res.end();
      }
    }
  });

  // POST /api/ai/title - Generate title for a conversation
  app.post("/api/ai/title", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userMessage } = req.body;
      if (!userMessage) {
        return res.status(400).json({ error: "userMessage is required" });
      }
      const title = await generateTitle(userMessage);
      res.json({ title });
    } catch (error: any) {
      console.error("Error generating title:", error);
      res.status(500).json({ error: error.message || "Failed to generate title" });
    }
  });

  // GET /api/ai/openrouter-models - Fetch available OpenRouter models
  app.get("/api/ai/openrouter-models", requireAuth, async (req: Request, res: Response) => {
    try {
      const models = await fetchOpenRouterModels();
      res.json(models);
    } catch (error: any) {
      console.error("Error fetching OpenRouter models:", error);
      res.status(500).json({ error: error.message || "Failed to fetch models" });
    }
  });
}
