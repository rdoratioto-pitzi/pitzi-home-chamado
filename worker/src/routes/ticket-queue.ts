// worker/src/routes/ticket-queue.ts
// Fila do grupo: assumir e transferir chamados (regras em server/services/ticket-queue.service.ts).
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { sendTicketAssignedEmail } from "../lib/email";
import { claimTicket, transferTicket, type QueueActor } from "../../../server/services/ticket-queue.service";

export const ticketQueue = new Hono<AppEnv>();

function actorOf(user: AppEnv["Variables"]["user"]): QueueActor {
  return { userId: user.userId, isAdmin: user.role === "admin", tenantId: user.tenantId ?? null };
}

// POST /api/tickets/:id/assumir — o usuário passa a ser o responsável.
ticketQueue.post("/api/tickets/:id/assumir", async (c) => {
  const storage = getStorage(c.get("db"));
  const result = await claimTicket(storage, actorOf(c.get("user")), c.req.param("id"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.ticket);
});

// POST /api/tickets/:id/transferir — { category, assigneeId? }
ticketQueue.post("/api/tickets/:id/transferir", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json().catch(() => null);
  const result = await transferTicket(storage, actorOf(c.get("user")), c.req.param("id"), body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  if (result.newAssignee) {
    sendTicketAssignedEmail(c.env, storage, result.ticket, result.newAssignee).catch(console.error);
  }
  return c.json(result.ticket);
});
