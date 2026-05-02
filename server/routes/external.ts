import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireApiKey } from "../middleware/api-key.js";
import { tickets, users } from "@shared/schema";
import { eq, and, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const VALID_STATUSES = ["open", "in_progress", "blocked", "resolved", "closed"] as const;

const querySchema = z.object({
  status: z.string().optional(),
  from: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function registerExternalRoutes(router: Router) {
  router.get("/api/external/chamados", requireApiKey, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Parâmetros inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { status, from, to, limit, offset } = parsed.data;

      // Validate status values if provided
      const statusList: string[] = [];
      if (status) {
        for (const s of status.split(",")) {
          const trimmed = s.trim();
          if (!VALID_STATUSES.includes(trimmed as typeof VALID_STATUSES[number])) {
            return res.status(400).json({
              error: `Status inválido: "${trimmed}". Valores aceitos: ${VALID_STATUSES.join(", ")}`,
            });
          }
          statusList.push(trimmed);
        }
      }

      // Default date range: last 30 days
      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromDate = from ? new Date(from) : defaultFrom;
      const toDate = to ? new Date(to) : now;

      // Build conditions
      const conditions: SQL[] = [
        gte(tickets.createdAt, fromDate),
        lte(tickets.createdAt, toDate),
      ];

      if (statusList.length > 0) {
        conditions.push(inArray(tickets.status, statusList));
      }

      const requester = alias(users, "requester");
      const assignee = alias(users, "assignee");

      // Count total
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tickets)
        .where(and(...conditions));

      // Fetch data
      const data = await db
        .select({
          id: tickets.id,
          code: tickets.code,
          title: tickets.title,
          category: tickets.category,
          type: tickets.type,
          applicationKey: tickets.applicationKey,
          priority: tickets.priority,
          impact: tickets.impact,
          status: tickets.status,
          requesterName: requester.name,
          assigneeName: assignee.name,
          createdAt: tickets.createdAt,
          dueDate: tickets.dueDate,
          dataAbertura: tickets.dataAbertura,
          dataResolucao: tickets.dataResolucao,
        })
        .from(tickets)
        .leftJoin(requester, eq(tickets.requesterId, requester.id))
        .leftJoin(assignee, eq(tickets.assigneeId, assignee.id))
        .where(and(...conditions))
        .orderBy(tickets.createdAt)
        .limit(limit)
        .offset(offset);

      res.json({
        data,
        meta: {
          total: countResult.count,
          limit,
          offset,
        },
      });
    } catch (error: unknown) {
      console.error("[external/chamados] Error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  });
}
