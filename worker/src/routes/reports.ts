// worker/src/routes/reports.ts
// Relatórios (Configurações → Relatórios, só admin): chamados por técnico no período.
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import { canBeAssignee, isTechnician } from "../../../shared/user-type";
import { sameTenant } from "../../../shared/tenant";
import { buildTechnicianReport, isValidDay } from "../../../shared/technician-report";

export const reports = new Hono<AppEnv>();

/** "2026-10-01" no fuso de Brasília → instante UTC do início do dia. */
function brasiliaDayStart(day: string): Date {
  return new Date(`${day}T00:00:00-03:00`);
}

// GET /api/v1/reports/technicians?from=AAAA-MM-DD&to=AAAA-MM-DD&group=sap — período inclusivo.
reports.get("/api/v1/reports/technicians", requireAdmin, async (c) => {
  const { tenantId } = c.get("user");
  const fromDay = c.req.query("from") || "";
  const toDay = c.req.query("to") || "";
  const group = c.req.query("group") || "";
  if (!isValidDay(fromDay) || !isValidDay(toDay) || fromDay > toDay) {
    return c.json({ error: "Período inválido (use from e to no formato AAAA-MM-DD)" }, 400);
  }
  const from = brasiliaDayStart(fromDay);
  const to = new Date(brasiliaDayStart(toDay).getTime() + 24 * 60 * 60 * 1000);

  const storage = getStorage(c.get("db"));
  const [tickets, users, slaRules] = await Promise.all([
    storage.getTickets({ tenantId: tenantId ?? null }),
    storage.getUsers(),
    storage.getSlaRules(),
  ]);
  const people = users.filter((u) => sameTenant(u.tenantId, tenantId));
  const technicianIds = people.filter((u) => canBeAssignee(u) || (isTechnician(u) && u.status === "active")).map((u) => u.id);
  const scoped = group ? tickets.filter((t) => t.category === group) : tickets;

  const report = buildTechnicianReport({
    tickets: scoped as any,
    people: people.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    technicianIds,
    slaRules: slaRules as any,
    from,
    to,
  });
  return c.json({ ...report, period: { from: fromDay, to: toDay }, group: group || null });
});
