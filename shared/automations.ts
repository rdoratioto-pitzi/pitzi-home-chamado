// Automações de chamados — regras "quando X, se Y, faça Z". Cálculo puro, compartilhado por
// Worker, Express e frontend (os rótulos da tela vêm daqui também).
//
// - Gatilhos: abertura do chamado, mudança de status e tempo em "Aguardando solicitante"
//   (dias corridos desde que o chamado entrou nesse status; conferido pelo cron do Worker).
// - As regras rodam em ordem (sort_order) e cada uma enxerga o chamado já alterado pelas
//   anteriores. O que uma automação muda não dispara outras automações (sem laços): a
//   avaliação acontece uma única vez por abertura/mudança feita por uma pessoa.
// - Ações que não podem ser aplicadas (grupo inativo, responsável fora do grupo, encerrar
//   sem responsável) são puladas e aparecem na nota interna da automação.

import { TICKET_STATUSES, ticketStatusLabel } from "./ticket-options";
import { slaPauseUpdate } from "./sla";

export type AutomationTrigger = "ticket_created" | "status_changed" | "waiting_requester_timeout";

export const AUTOMATION_TRIGGERS: readonly { value: AutomationTrigger; label: string }[] = [
  { value: "ticket_created", label: "Quando o chamado é aberto" },
  { value: "status_changed", label: "Quando o status muda" },
  { value: "waiting_requester_timeout", label: "Quando fica X dias aguardando o solicitante" },
];

export interface AutomationConditions {
  types?: string[];
  groups?: string[];
  impacts?: string[];
  requestObjects?: string[];
  /** Só para status_changed: o novo status. */
  statuses?: string[];
}

export type AutomationAction =
  | { type: "set_group"; value: string }
  | { type: "set_assignee"; value: string }
  | { type: "set_status"; value: string }
  | { type: "set_impact"; value: string }
  | { type: "add_internal_note"; value: string }
  | { type: "notify_user"; value: string }; // "assignee" | "requester" | id do usuário

export const AUTOMATION_ACTION_TYPES: readonly { value: AutomationAction["type"]; label: string }[] = [
  { value: "set_group", label: "Mudar o grupo" },
  { value: "set_assignee", label: "Definir o responsável" },
  { value: "set_status", label: "Mudar o status" },
  { value: "set_impact", label: "Mudar a gravidade" },
  { value: "add_internal_note", label: "Adicionar nota interna" },
  { value: "notify_user", label: "Notificar" },
];

export const IMPACT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Médio" },
  { value: "alto", label: "Alto" },
  { value: "critico", label: "Crítico" },
];

export interface AutomationRuleLike {
  id?: string;
  name: string;
  active?: boolean | null;
  trigger: string;
  conditions: unknown;
  actions: unknown;
  timeoutDays?: number | null;
  sortOrder?: number | null;
}

export interface AutomationTicket {
  type?: string | null;
  category?: string | null;
  impact?: string | null;
  requestObject?: string | null;
  status?: string | null;
  assigneeId?: string | null;
  requesterId?: string | null;
  dataResolucao?: Date | string | null;
  dataFechamento?: Date | string | null;
  slaPausadoEm?: Date | string | null;
  slaPausaMinutos?: number | null;
}

export interface AutomationContext {
  /** Grupos ativos e seus membros (support_groups). */
  groups: readonly { key: string; memberIds: readonly string[] }[];
  /** Para status_changed: o status que acabou de ser gravado. */
  newStatus?: string;
  now?: Date;
}

export interface AutomationPlan {
  /** Campos a gravar no chamado (vazio se nada muda). */
  patch: Record<string, unknown>;
  /** Uma nota interna por regra aplicada, já com o nome da regra. */
  notes: string[];
  /** Destinatários de notificação: ids de usuário (assignee/requester já resolvidos). */
  notify: { userId: string; ruleName: string }[];
  applied: string[];
}

const TRIGGERS = AUTOMATION_TRIGGERS.map((t) => t.value) as string[];
const ACTIONS = AUTOMATION_ACTION_TYPES.map((a) => a.value) as string[];
const STATUS_VALUES = TICKET_STATUSES.map((s) => s.value);
const IMPACT_VALUES = IMPACT_OPTIONS.map((i) => i.value);
const NEEDS_ASSIGNEE = ["resolved", "closed", "blocked"];

function stringList(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) {
    throw new Error(`Condição inválida: ${field}`);
  }
  const list = Array.from(new Set(value.map((v: string) => v.trim())));
  return list.length ? list : undefined;
}

/** Valida e normaliza uma regra vinda da tela. Lança Error com mensagem para o usuário. */
export function parseAutomationRule(raw: unknown): {
  name: string;
  active: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  timeoutDays: number | null;
  sortOrder: number;
} {
  if (!raw || typeof raw !== "object") throw new Error("Regra inválida");
  const r = raw as Record<string, any>;

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) throw new Error("Informe o nome da automação");
  if (name.length > 120) throw new Error("Nome muito longo (máx. 120 caracteres)");

  if (!TRIGGERS.includes(r.trigger)) throw new Error("Gatilho inválido");
  const trigger = r.trigger as AutomationTrigger;

  const c = (r.conditions && typeof r.conditions === "object" ? r.conditions : {}) as Record<string, unknown>;
  const conditions: AutomationConditions = {};
  for (const key of ["types", "groups", "impacts", "requestObjects", "statuses"] as const) {
    const list = stringList(c[key], key);
    if (list) conditions[key] = list;
  }
  if (conditions.impacts?.some((i) => !IMPACT_VALUES.includes(i))) throw new Error("Gravidade inválida");
  if (conditions.statuses) {
    if (trigger !== "status_changed") delete conditions.statuses;
    else if (conditions.statuses.some((s) => !STATUS_VALUES.includes(s))) throw new Error("Status inválido");
  }

  if (!Array.isArray(r.actions) || r.actions.length === 0) throw new Error("Inclua pelo menos uma ação");
  if (r.actions.length > 10) throw new Error("Máximo de 10 ações por automação");
  const actions: AutomationAction[] = r.actions.map((a: any) => {
    if (!a || !ACTIONS.includes(a.type)) throw new Error("Ação inválida");
    const value = typeof a.value === "string" ? a.value.trim() : "";
    if (!value) throw new Error("Preencha o valor de todas as ações");
    if (a.type === "set_status" && !STATUS_VALUES.includes(value)) throw new Error("Status inválido na ação");
    if (a.type === "set_impact" && !IMPACT_VALUES.includes(value)) throw new Error("Gravidade inválida na ação");
    if (a.type === "add_internal_note" && value.length > 2000) throw new Error("Nota muito longa (máx. 2000 caracteres)");
    return { type: a.type, value } as AutomationAction;
  });

  let timeoutDays: number | null = null;
  if (trigger === "waiting_requester_timeout") {
    const days = Number(r.timeoutDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Informe os dias (1 a 365)");
    timeoutDays = days;
    // Sem tirar o chamado de "Aguardando solicitante" a regra rodaria de novo a cada hora.
    const leaves = actions.some((a) => a.type === "set_status" && a.value !== "waiting_requester");
    if (!leaves) throw new Error("Automação por tempo precisa mudar o status do chamado");
  }

  const sortOrder = Number.isInteger(Number(r.sortOrder)) ? Number(r.sortOrder) : 0;
  return { name, active: r.active !== false, trigger, conditions, actions, timeoutDays, sortOrder };
}

function asConditions(raw: unknown): AutomationConditions {
  return raw && typeof raw === "object" ? (raw as AutomationConditions) : {};
}

function asActions(raw: unknown): AutomationAction[] {
  return Array.isArray(raw) ? (raw as AutomationAction[]) : [];
}

function inList(list: string[] | undefined, value: string | null | undefined): boolean {
  if (!list || list.length === 0) return true;
  return !!value && list.includes(value);
}

export function matchesAutomation(
  rule: AutomationRuleLike,
  ticket: AutomationTicket,
  ctx: Pick<AutomationContext, "newStatus"> = {},
): boolean {
  const c = asConditions(rule.conditions);
  if (!inList(c.types, ticket.type)) return false;
  if (!inList(c.groups, ticket.category)) return false;
  if (!inList(c.impacts, ticket.impact)) return false;
  if (!inList(c.requestObjects, ticket.requestObject)) return false;
  if (rule.trigger === "status_changed" && !inList(c.statuses, ctx.newStatus ?? ticket.status)) return false;
  return true;
}

/** Campos que acompanham uma mudança de status (mesma regra do PATCH /api/tickets/:id). */
export function statusChangeFields(ticket: AutomationTicket, newStatus: string, now: Date): Record<string, unknown> {
  const fields: Record<string, unknown> = { status: newStatus };
  if (newStatus === "resolved" && !ticket.dataResolucao) fields.dataResolucao = now;
  if (newStatus === "closed" && !ticket.dataFechamento) fields.dataFechamento = now;
  Object.assign(fields, slaPauseUpdate(ticket, newStatus, now));
  return fields;
}

function groupOf(ctx: AutomationContext, key: string | null | undefined) {
  return key ? ctx.groups.find((g) => g.key === key) : undefined;
}

/**
 * Aplica, em ordem, as regras ativas do gatilho que casam com o chamado. Não grava nada:
 * devolve o patch, as notas e as notificações para o chamador executar.
 */
export function planAutomations(
  rules: readonly AutomationRuleLike[],
  trigger: AutomationTrigger,
  ticket: AutomationTicket,
  ctx: AutomationContext,
): AutomationPlan {
  const now = ctx.now ?? new Date();
  const current: AutomationTicket = { ...ticket };
  const patch: Record<string, unknown> = {};
  const notes: string[] = [];
  const notify: AutomationPlan["notify"] = [];
  const applied: string[] = [];

  const ordered = rules
    .filter((r) => r.active !== false && r.trigger === trigger)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const set = (fields: Record<string, unknown>) => {
    Object.assign(patch, fields);
    Object.assign(current, fields);
  };

  for (const rule of ordered) {
    if (!matchesAutomation(rule, current, { newStatus: ctx.newStatus })) continue;
    const done: string[] = [];
    const skipped: string[] = [];
    const userNotes: string[] = [];

    for (const action of asActions(rule.actions)) {
      switch (action.type) {
        case "set_group": {
          if (action.value === current.category) break;
          const target = groupOf(ctx, action.value);
          if (!target) { skipped.push(`grupo "${action.value}" inativo ou inexistente`); break; }
          const fields: Record<string, unknown> = { category: action.value };
          // Como no Transferir: responsável de fora do novo grupo volta o chamado para a fila.
          if (current.assigneeId && !target.memberIds.includes(current.assigneeId)) fields.assigneeId = null;
          set(fields);
          done.push(`grupo → ${action.value}`);
          break;
        }
        case "set_assignee": {
          if (action.value === current.assigneeId) break;
          const group = groupOf(ctx, current.category);
          if (!group || !group.memberIds.includes(action.value)) {
            skipped.push("responsável não é membro do grupo do chamado");
            break;
          }
          set({ assigneeId: action.value });
          done.push("responsável definido");
          break;
        }
        case "set_status": {
          if (action.value === current.status) break;
          if (NEEDS_ASSIGNEE.includes(action.value) && !current.assigneeId) {
            skipped.push(`status "${ticketStatusLabel(action.value)}" exige responsável`);
            break;
          }
          set(statusChangeFields(current, action.value, now));
          done.push(`status → ${ticketStatusLabel(action.value)}`);
          break;
        }
        case "set_impact": {
          if (action.value === current.impact) break;
          set({ impact: action.value });
          done.push(`gravidade → ${IMPACT_OPTIONS.find((i) => i.value === action.value)?.label ?? action.value}`);
          break;
        }
        case "add_internal_note":
          userNotes.push(action.value);
          break;
        case "notify_user": {
          const userId =
            action.value === "assignee" ? current.assigneeId :
            action.value === "requester" ? current.requesterId :
            action.value;
          if (userId) notify.push({ userId, ruleName: rule.name });
          else skipped.push("notificação sem destinatário");
          break;
        }
      }
    }

    applied.push(rule.name);
    const parts = [`Automação "${rule.name}"`];
    if (done.length) parts.push(`aplicou: ${done.join("; ")}`);
    if (skipped.length) parts.push(`não aplicou: ${skipped.join("; ")}`);
    notes.push([parts.join(" — "), ...userNotes].join("\n"));
  }

  return { patch, notes, notify, applied };
}
