import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { tickets, users } from "../../../shared/schema";
import { eq, and, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const external = new Hono<AppEnv>();

const VALID_STATUSES = ["open", "in_progress", "blocked", "resolved", "closed"] as const;

const querySchema = z.object({
  status: z.string().optional(),
  from: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

external.get("/api/external/chamados", async (c) => {
  const db = c.get("db");

  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: "Parâmetros inválidos", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const { status, from, to, limit, offset } = parsed.data;

  // Validate status values
  const statusList: string[] = [];
  if (status) {
    for (const s of status.split(",")) {
      const trimmed = s.trim();
      if (!VALID_STATUSES.includes(trimmed as typeof VALID_STATUSES[number])) {
        return c.json(
          { error: `Status inválido: "${trimmed}". Valores aceitos: ${VALID_STATUSES.join(", ")}` },
          400,
        );
      }
      statusList.push(trimmed);
    }
  }

  // Default date range: last 30 days
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : now;

  const conditions: SQL[] = [
    gte(tickets.createdAt, fromDate),
    lte(tickets.createdAt, toDate),
  ];

  if (statusList.length > 0) {
    conditions.push(inArray(tickets.status, statusList));
  }

  const requester = alias(users, "requester");
  const assignee = alias(users, "assignee");

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(...conditions));

  const data = await db
    .select({
      id: tickets.id,
      code: tickets.code,
      title: tickets.title,
      category: tickets.category,
      type: tickets.type,
      location: tickets.location,
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

  return c.json({
    data,
    meta: {
      total: countResult.count,
      limit,
      offset,
    },
  });
});

export { external };
