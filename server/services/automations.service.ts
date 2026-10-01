// Respostas prontas e automações de chamados. Usado pelo Worker e pelo Express; as regras de
// avaliação ficam em shared/automations.ts (puras, testadas à parte).
import { z } from "zod";
import type { AutomationRule, CannedResponse, Ticket } from "../../shared/schema";
import { parseAutomationRule, planAutomations, type AutomationTrigger } from "../../shared/automations";
import type { IStorage } from "../storage";
import { isTechnicianUserId } from "./user-type.service";

type Fail = { ok: false; status: 400 | 404; error: string };

// ─── Respostas prontas ────────────────────────────────────────────────────────

const cannedSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(120, "Título muito longo (máx. 120 caracteres)"),
  body: z.string().trim().min(1, "Informe o texto").max(5000, "Texto muito longo (máx. 5000 caracteres)"),
  groupKey: z.string().trim().min(1).nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** Lista para a caixa de comentário: só ativas, do grupo do chamado ou de todos os grupos. */
export function filterCannedResponses(
  all: CannedResponse[],
  opts: { includeInactive?: boolean; group?: string | null },
): CannedResponse[] {
  if (opts.includeInactive) return all;
  return all.filter(r => r.active && (!opts.group || !r.groupKey || r.groupKey === opts.group));
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}

async function checkGroup(storage: IStorage, groupKey: string | null | undefined): Promise<boolean> {
  return !groupKey || !!(await storage.getActiveSupportGroupByKey(groupKey));
}

export async function createCannedResponse(
  storage: IStorage,
  raw: unknown,
  actor: { userId: string; tenantId: string | null },
): Promise<{ ok: true; response: CannedResponse } | Fail> {
  const parsed = cannedSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  if (!(await checkGroup(storage, parsed.data.groupKey))) {
    return { ok: false, status: 400, error: "Grupo de atendimento inválido" };
  }
  const response = await storage.createCannedResponse({
    ...parsed.data,
    groupKey: parsed.data.groupKey ?? null,
    tenantId: actor.tenantId,
    createdBy: actor.userId,
  });
  return { ok: true, response };
}

export async function updateCannedResponse(
  storage: IStorage,
  id: string,
  raw: unknown,
): Promise<{ ok: true; response: CannedResponse } | Fail> {
  if (!(await storage.getCannedResponse(id))) return { ok: false, status: 404, error: "Resposta não encontrada" };
  const parsed = cannedSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  if (parsed.data.groupKey !== undefined && !(await checkGroup(storage, parsed.data.groupKey))) {
    return { ok: false, status: 400, error: "Grupo de atendimento inválido" };
  }
  const data = { ...parsed.data, ...(parsed.data.groupKey !== undefined ? { groupKey: parsed.data.groupKey ?? null } : {}) };
  const response = await storage.updateCannedResponse(id, data);
  if (!response) return { ok: false, status: 404, error: "Resposta não encontrada" };
  return { ok: true, response };
}

// ─── Automações: cadastro ─────────────────────────────────────────────────────

async function checkRuleTargets(storage: IStorage, rule: ReturnType<typeof parseAutomationRule>): Promise<string | null> {
  for (const action of rule.actions) {
    if (action.type === "set_group" && !(await storage.getActiveSupportGroupByKey(action.value))) {
      return "Grupo de atendimento inválido na ação";
    }
    if ((action.type === "set_assignee" || (action.type === "notify_user" && !["assignee", "requester"].includes(action.value)))
      && !(await storage.getUser(action.value))) {
      return "Usuário inválido na ação";
    }
    if (action.type === "set_assignee" && !(await isTechnicianUserId(storage, action.value))) {
      return "Responsável da ação precisa ser um técnico";
    }
  }
  return null;
}

export async function createAutomationRule(
  storage: IStorage,
  raw: unknown,
  actor: { userId: string; tenantId: string | null },
): Promise<{ ok: true; rule: AutomationRule } | Fail> {
  let data;
  try {
    data = parseAutomationRule(raw);
  } catch (e: any) {
    return { ok: false, status: 400, error: e.message };
  }
  const targetError = await checkRuleTargets(storage, data);
  if (targetError) return { ok: false, status: 400, error: targetError };
  const rule = await storage.createAutomationRule({ ...data, tenantId: actor.tenantId, createdBy: actor.userId });
  return { ok: true, rule };
}

export async function updateAutomationRule(
  storage: IStorage,
  id: string,
  raw: unknown,
): Promise<{ ok: true; rule: AutomationRule } | Fail> {
  const current = await storage.getAutomationRule(id);
  if (!current) return { ok: false, status: 404, error: "Automação não encontrada" };
  // A tela manda a regra inteira; mesclar permite também só ligar/desligar ({ active }).
  const merged = { ...current, ...(raw && typeof raw === "object" ? raw : {}) };
  let data;
  try {
    data = parseAutomationRule(merged);
  } catch (e: any) {
    return { ok: false, status: 400, error: e.message };
  }
  const targetError = await checkRuleTargets(storage, data);
  if (targetError) return { ok: false, status: 400, error: targetError };
  const rule = await storage.updateAutomationRule(id, data);
  if (!rule) return { ok: false, status: 404, error: "Automação não encontrada" };
  return { ok: true, rule };
}

// ─── Automações: execução ─────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

function noteHtml(note: string): string {
  return note.split("\n").map(line => `<p>${escapeHtml(line)}</p>`).join("");
}

/**
 * Avalia as automações do gatilho para um chamado já gravado e aplica o resultado.
 * Não dispara automações de novo (o que ela muda não passa por aqui outra vez).
 * Falhas são registradas no log e não derrubam a requisição que abriu/alterou o chamado.
 */
export async function runTicketAutomations(
  storage: IStorage,
  trigger: AutomationTrigger,
  ticket: Ticket,
  opts: { actorId?: string | null; newStatus?: string; now?: Date; rules?: AutomationRule[]; notifyAssignee?: boolean } = {},
): Promise<Ticket> {
  try {
    const rules = (opts.rules ?? await storage.getAutomationRules(trigger)).filter(r => r.active);
    if (rules.length === 0) return ticket;
    const groups = await storage.getSupportGroups(ticket.tenantId ?? null);
    // set_assignee só aceita técnicos: confere os responsáveis citados nas regras.
    const assigneeIds = Array.from(new Set(rules.flatMap(r =>
      (r.actions as { type: string; value?: string }[] | null ?? [])
        .filter(a => a.type === "set_assignee" && a.value)
        .map(a => a.value as string))));
    const technicianIds: string[] = [];
    for (const id of assigneeIds) if (await isTechnicianUserId(storage, id)) technicianIds.push(id);
    const plan = planAutomations(rules, trigger, ticket, {
      groups: groups.map(g => ({ key: g.key, memberIds: g.memberIds })),
      newStatus: opts.newStatus,
      now: opts.now,
      technicianIds,
    });
    if (plan.applied.length === 0) return ticket;

    let updated = ticket;
    if (Object.keys(plan.patch).length > 0) {
      updated = (await storage.updateTicket(ticket.id, plan.patch as Partial<Ticket>)) ?? ticket;
    }

    // Nota interna em nome de quem disparou; no cron, do responsável ou do solicitante.
    const authorId = opts.actorId || updated.assigneeId || updated.requesterId;
    for (const note of plan.notes) {
      await storage.createTicketComment({
        ticketId: updated.id,
        tenantId: updated.tenantId,
        userId: authorId,
        content: noteHtml(note),
        isInternal: true,
        mentions: [],
      });
    }

    const notified = new Set<string>();
    const notifyUser = (userId: string, title: string, message: string) => {
      if (notified.has(userId) || userId === opts.actorId) return;
      notified.add(userId);
      return storage.createNotification({
        userId,
        fromUserId: opts.actorId ?? null,
        title,
        message,
        module: "chamados",
        entityId: updated.id,
        linkUrl: `/chamados?ticket=${updated.id}`,
      }).catch(console.error);
    };
    // Na abertura, a rota já avisa o responsável final; aqui só nas demais situações.
    if (opts.notifyAssignee !== false && plan.patch.assigneeId && plan.patch.assigneeId !== ticket.assigneeId) {
      await notifyUser(String(plan.patch.assigneeId), "Chamado atribuído a você",
        `O chamado "${updated.title}" (${updated.code || ""}) foi atribuído a você por uma automação`);
    }
    for (const { userId, ruleName } of plan.notify) {
      await notifyUser(userId, "Automação de chamado",
        `Automação "${ruleName}" no chamado "${updated.title}" (${updated.code || ""})`);
    }
    return updated;
  } catch (error) {
    console.error("[automations] falha ao aplicar automações:", error);
    return ticket;
  }
}

/**
 * Cron: aplica as automações "X dias aguardando o solicitante". A regra exige mudar o status
 * (parseAutomationRule), então cada chamado é tratado uma vez e sai da consulta.
 */
export async function runWaitingRequesterTimeouts(storage: IStorage, now: Date = new Date()): Promise<number> {
  const rules = (await storage.getAutomationRules("waiting_requester_timeout")).filter(r => r.active && r.timeoutDays);
  let touched = 0;
  for (const rule of rules) {
    const tickets = await storage.getTicketsWaitingRequesterSince(rule.timeoutDays!);
    for (const ticket of tickets) {
      // Só a regra cujo prazo venceu: outra regra com mais dias não pode rodar antes da hora.
      const updated = await runTicketAutomations(storage, "waiting_requester_timeout", ticket, { now, rules: [rule] });
      if (updated !== ticket) touched++;
    }
  }
  return touched;
}
