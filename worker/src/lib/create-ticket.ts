// Abertura de chamado: mesma regra para POST /api/tickets e para o Slack (/chamado e o
// atalho "Transformar em chamado"). Responsável automático, automações de abertura,
// e-mails e aviso ao responsável.
import { insertTicketSchema, type Ticket } from "../../../shared/schema";
import { isValidApplicationKey } from "../../../shared/applications";
import { normalizeRequestSelection } from "../../../shared/request-objects";
import { TECHNICIAN_REQUIRED_ERROR } from "../../../shared/user-type";
import { checkRequestSelection, resolveCustomFieldValues } from "../../../server/services/ticket-fields.service";
import { runTicketAutomations } from "../../../server/services/automations.service";
import { isTechnicianUserId } from "../../../server/services/user-type.service";
import type { IStorage } from "./storage";
import { sendTicketAssignedEmail, sendTicketCreatedEmail } from "./email";
import type { MailContext } from "./mailer";

export interface TicketCreator {
  userId: string;
  isAdmin: boolean;
  tenantId: string | null;
}

export type CreateTicketResult =
  | { ok: true; ticket: Ticket }
  | { ok: false; status: 400 | 403 | 404; error: string };

// Campos que só o sistema grava (origem no Slack): nunca vêm do corpo da requisição.
const SYSTEM_ONLY_FIELDS = ["slackTeamId", "slackChannelId", "slackThreadTs", "slackMessageTs", "slackUserId", "slackPermalink"] as const;
type SystemTicketFields = Partial<Pick<Ticket,
  "slackTeamId" | "slackChannelId" | "slackThreadTs" | "slackMessageTs" | "slackUserId" | "slackPermalink"
>>;

export interface CreateTicketOptions {
  /**
   * Responsável definido pelo sistema (Slack: o técnico que converteu a conversa). Precisa ser
   * técnico; vale mesmo que o solicitante seja Usuário e substitui o responsável automático.
   */
  assigneeOverride?: string | null;
  /** Quem fez a ação (não recebe e-mail/aviso de atribuição para si mesmo). */
  actorId?: string | null;
}

export async function createTicketFor(
  storage: IStorage,
  mail: MailContext,
  creator: TicketCreator,
  body: Record<string, unknown>,
  systemFields: SystemTicketFields = {},
  options: CreateTicketOptions = {},
): Promise<CreateTicketResult> {
  const data: Record<string, unknown> = { ...body };
  for (const field of SYSTEM_ONLY_FIELDS) delete data[field];

  if (!creator.isAdmin || !data.requesterId) {
    data.requesterId = creator.userId;
  }
  // Quem não é técnico não escolhe o responsável: o chamado vai para o responsável
  // automático do grupo ou para a fila (evita o solicitante apontar o técnico errado).
  if (!creator.isAdmin && !(await isTechnicianUserId(storage, creator.userId))) {
    delete data.assigneeId;
  }

  // Aplicação é opcional: o formulário não pede mais; se vier, precisa ser válida.
  if (data.applicationKey && !isValidApplicationKey(data.applicationKey as string)) {
    return { ok: false, status: 400, error: "Aplicação inválida" };
  }
  data.applicationKey = data.applicationKey || null;

  normalizeRequestSelection(data as any);
  if (!(await checkRequestSelection(storage, data as any))) {
    return { ok: false, status: 400, error: "Objeto da Requisição inválido" };
  }

  const validated = insertTicketSchema.parse(data);

  if (!(await storage.getActiveSupportGroupByKey(validated.category))) {
    return { ok: false, status: 400, error: "Grupo de atendimento é obrigatório e deve ser válido" };
  }

  // Campos personalizados do grupo (obrigatórios exigidos na abertura).
  const custom = await resolveCustomFieldValues(storage, {
    incoming: body?.customFields, groupKey: validated.category, isCreate: true,
  });
  if (!custom.ok) return { ok: false, status: custom.status as 400, error: custom.error };
  validated.customFields = custom.values ?? null;

  if (options.assigneeOverride) validated.assigneeId = options.assigneeOverride;

  // Responsável informado na abertura precisa ser técnico.
  if (validated.assigneeId && !(await isTechnicianUserId(storage, validated.assigneeId))) {
    return { ok: false, status: 400, error: TECHNICIAN_REQUIRED_ERROR };
  }

  // Auto-assignment (regra antiga cujo responsável deixou de ser técnico é ignorada)
  if (!validated.assigneeId && validated.category && validated.type) {
    const autoAssignee = await storage.findResponsavelForTicket(
      validated.category,
      validated.type,
      creator.tenantId ?? null,
    );
    if (autoAssignee && (await isTechnicianUserId(storage, autoAssignee))) validated.assigneeId = autoAssignee;
  }

  const created = await storage.createTicket({ ...validated, tenantId: creator.tenantId, ...systemFields });
  // Automações de abertura rodam depois do responsável automático; e-mails e avisos abaixo
  // já usam o resultado final.
  const ticket = await runTicketAutomations(storage, "ticket_created", created, {
    actorId: options.actorId ?? creator.userId, notifyAssignee: false,
  });
  const requester = await storage.getUser(ticket.requesterId);
  const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

  // Emails (fire-and-forget)
  if (requester) {
    sendTicketCreatedEmail(mail, storage, ticket, requester, assignee || null).catch(console.error);
  }
  const actorId = options.actorId ?? null;
  if (assignee && assignee.id !== ticket.requesterId && assignee.id !== actorId) {
    sendTicketAssignedEmail(mail, storage, ticket, assignee).catch(console.error);
  }

  // Notification
  if (ticket.assigneeId && ticket.assigneeId !== ticket.requesterId && ticket.assigneeId !== actorId) {
    storage
      .createNotification({
        userId: ticket.assigneeId,
        fromUserId: ticket.requesterId,
        title: "Novo chamado atribuído",
        message: `O chamado "${ticket.title}" (${ticket.code}) foi criado e atribuído a você`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados?ticket=${ticket.id}`,
      })
      .catch(console.error);
  }

  return { ok: true, ticket };
}
