// worker/src/routes/ai.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { streamChatCompletion, generateTitle, fetchOpenRouterModels } from "../services/openrouter";
import { scrapeMercadoLivre } from "../services/firecrawl.service";

const ai = new Hono<AppEnv>();

// POST /api/ai/chat — SSE streaming
ai.post("/api/ai/chat", async (c) => {
  const { messages, model, attachments } = await c.req.json();
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const apiKey = c.env.OPENROUTER_API_KEY;
  const firecrawlApiKey = c.env.FIRECRAWL_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of streamChatCompletion(
          messages,
          { userId: user?.userId },
          model,
          attachments,
          { storage, apiKey, firecrawlApiKey },
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("Error streaming chat completion:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});

// POST /api/ai/title
ai.post("/api/ai/title", async (c) => {
  const { userMessage } = await c.req.json();
  if (!userMessage) {
    return c.json({ error: "userMessage is required" }, 400);
  }
  const title = await generateTitle(userMessage, c.env.OPENROUTER_API_KEY);
  return c.json({ title });
});

// GET /api/firecrawl/test
ai.get("/api/firecrawl/test", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: "query parameter is required" }, 400);
  }
  console.log(`[Firecrawl Test] Testing with query: "${query}"`);
  const result = await scrapeMercadoLivre(query, c.env.FIRECRAWL_API_KEY);
  if (!result) {
    return c.json({ error: "Nenhum resultado encontrado ou erro na API Firecrawl" }, 404);
  }
  return c.json(result);
});

// GET /api/ai/openrouter-models
ai.get("/api/ai/openrouter-models", async (c) => {
  const models = await fetchOpenRouterModels(c.env.OPENROUTER_API_KEY);
  return c.json(models);
});

export { ai };
