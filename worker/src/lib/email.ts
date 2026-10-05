/**
 * E-mails do Pitzi Home (Cloudflare Workers).
 *
 * Chamados: cada evento vira linhas na fila email_outbox (lib/mailer.ts), com o texto dos
 * modelos de Configurações → E-mail (shared/email-settings.ts), e é enviado em segundo plano
 * pelo Gmail. Os módulos legados (projetos, tarefas, reuniões) usam o envio direto.
 */

import { format } from "date-fns-tz";
import { generateICSContent } from "./ics";
import type { Ticket, User, TicketComment, Task, KanbanCard, Project, InsertEmailOutbox } from "../../../shared/schema";
import type { IStorage, EmailNotificationType } from "../../../server/storage";
import {
  EMAIL_EVENT_META,
  escapeHtml,
  renderSubject,
  renderTemplateHtml,
  renderTemplateText,
  type EmailEvent,
  type EmailRecipient,
  type EmailVariables,
} from "../../../shared/email-settings";
import { emailDomain, newMessageId, ticketThreadRootId } from "../../../shared/email-mime";
import { ticketStatusLabel, ticketTypeLabel } from "../../../shared/ticket-options";
import {
  emailTemplate,
  getTicketUrl,
  getProjectUrl,
  getStatusLabel,
  getPriorityLabel,
  formatDateTime,
  statusBadge,
  priorityBadge,
  statusTransition,
  actionBy,
  infoTable,
  sectionCard,
  commentBox,
  ctaButton,
} from "../../../server/email-templates";
import { keepAlive, loadEmailSettings, queueEmails, sendDirect, type MailContext, type MailEnv } from "./mailer";

// ============== TYPES ==============

export type EmailEnv = MailEnv;
export type { MailContext };

interface SendPulseRecipient {
  name: string;
  email: string;
}

interface SendMailOptions {
  to: SendPulseRecipient[];
  subject: string;
  html: string;
  attachments_binary?: Record<string, string>;
}

/** Envio direto (sem fila) dos módulos legados. */
async function sendMail(env: EmailEnv, options: SendMailOptions): Promise<void> {
  await sendDirect(env, options);
}

// ============== PREFERENCE FILTER + LOGGING ==============

async function filterRecipientsByPreference(
  storage: IStorage,
  userIds: string[],
  notificationType: EmailNotificationType
): Promise<string[]> {
  const allowedIds: string[] = [];
  for (const userId of userIds) {
    const shouldSend = await storage.shouldSendEmail(userId, notificationType);
    if (shouldSend) allowedIds.push(userId);
  }
  return allowedIds;
}

function logEmailSent(type: string, recipients: string[], entityId?: string) {
  console.log(`[EMAIL] ${type} enviado`, {
    type,
    recipients: recipients.join(", "),
    entityId: entityId || "—",
    timestamp: new Date().toISOString(),
  });
}

function logEmailSkipped(type: string, reason: string, userId?: string) {
  console.log(`[EMAIL] ${type} ignorado: ${reason}`, { userId });
}

// ============== FILA: e-mails avulsos (senha, boas-vindas, avaliação, menção) ==============

function senderDomain(env: MailEnv): string {
  return emailDomain(env.GMAIL_SENDER || env.SENDPULSE_FROM_EMAIL || "chamados@pitzi.com.br");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Grava um e-mail avulso na fila. Destinatário inativo ou sem e-mail vira `skipped`. */
async function queueSingle(
  ctx: MailContext,
  event: string,
  user: Pick<User, "id" | "email" | "status" | "tenantId">,
  subject: string,
  html: string,
  ticket?: Pick<Ticket, "id"> | null,
): Promise<void> {
  const skipReason = !user.email ? "Destinatário sem e-mail" : user.status !== "active" ? "Usuário inativo" : null;
  const domain = senderDomain(ctx.env);
  await queueEmails(ctx, [{
    tenantId: user.tenantId ?? null,
    event,
    ticketId: ticket?.id ?? null,
    toEmail: user.email || "",
    toUserId: user.id,
    subject,
    html,
    text: htmlToText(html),
    status: skipReason ? "skipped" : "pending",
    lastError: skipReason,
    messageIdHeader: newMessageId(domain),
    threadRootId: ticket ? ticketThreadRootId(ticket.id, domain) : null,
  }]);
  if (!skipReason) logEmailSent(event, [user.email], ticket?.id);
}

// ============== 1. sendPasswordResetEmail ==============

async function sendPasswordResetEmailNow(
  ctx: MailContext,
  user: User,
  temporaryPassword: string
): Promise<void> {
  const html = emailTemplate({
    title: "Redefinição de Senha",
    greeting: `Olá ${escapeHtml(user.name)},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Recebemos uma solicitação para redefinir sua senha no Pitzi Home.</p>
      ${sectionCard(`
        <div style="text-align:center;">
          <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Sua nova senha temporária</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:3px;color:#1a1a2e;margin:0;padding:12px;background:white;border-radius:8px;">${escapeHtml(temporaryPassword)}</p>
        </div>
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Use esta senha para acessar o sistema. Recomendamos que você altere sua senha após o primeiro acesso.</p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Se você não solicitou esta redefinição, entre em contato com o administrador do sistema imediatamente.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${ctx.env.APP_URL}/login`,
  });
  await queueSingle(ctx, "password_reset", user, "Pitzi Home - Redefinição de Senha", html);
}

/** Link de redefinição de senha (fluxo público). A senha só muda quando o link é usado. Sempre ativo. */
async function sendPasswordResetLinkEmailNow(ctx: MailContext, user: User, resetUrl: string): Promise<void> {
  const html = emailTemplate({
    title: "Redefinição de Senha",
    greeting: `Olá ${escapeHtml(user.name)},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Recebemos uma solicitação para redefinir sua senha no Pitzi Home.</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;">Clique no botão abaixo para escolher uma nova senha. O link vale por 30 minutos e só pode ser usado uma vez.</p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Se você não solicitou esta redefinição, ignore este e-mail: sua senha atual continua valendo.</p>
    `,
    ctaText: "Redefinir senha",
    ctaUrl: resetUrl,
  });
  await queueSingle(ctx, "password_reset_link", user, "Pitzi Home - Redefinição de Senha", html);
}

// ============== 2. sendWelcomeEmail ==============

async function sendWelcomeEmailNow(
  ctx: MailContext,
  user: User,
  initialPassword: string
): Promise<{ success: boolean; error?: string }> {
  const html = emailTemplate({
    title: "Bem-vindo ao Pitzi Home",
    greeting: `Olá <strong>${escapeHtml(user.name)}</strong>,`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Você foi cadastrado na central de chamados da Pitzi. Abaixo estão suas informações de acesso:</p>
      ${sectionCard(`
        ${infoTable([
          { label: "Link", value: `<a href="${escapeHtml(ctx.env.APP_URL)}" style="color:#3B42DE;font-weight:600;">${escapeHtml(ctx.env.APP_URL.replace(/^https?:\/\//, ""))}</a>` },
          { label: "E-mail", value: escapeHtml(user.email) },
          { label: "Senha inicial", value: `<code style="background:#e8f5e9;padding:4px 8px;border-radius:4px;font-weight:600;">${escapeHtml(initialPassword)}</code>` },
        ])}
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Recomendamos que você altere sua senha após o primeiro acesso.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${ctx.env.APP_URL}/login`,
  });

  try {
    await queueSingle(ctx, "welcome", user, "Bem-vindo ao Pitzi Home - Acesso ao Sistema", html);
    return { success: true };
  } catch (error) {
    const errorMessage = `Falha ao registrar e-mail de boas-vindas para ${user.email}: ${error instanceof Error ? error.message : String(error)}`;
    console.error("[EMAIL]", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============== 3–6. EVENTOS DE CHAMADO (configuráveis) ==============

/** Tipo de preferência pessoal (Minhas notificações) respeitada por cada evento. */
const EVENT_PREFERENCE: Record<EmailEvent, EmailNotificationType> = {
  ticket_created: "ticket_new",
  ticket_assigned: "ticket_assigned",
  agent_reply: "ticket_comment",
  requester_reply: "ticket_comment",
  status_changed: "ticket_status",
  ticket_closed: "ticket_status",
  ticket_updated: "ticket_status",
};

export interface TicketEmailInput {
  requester: User | null | undefined;
  assignee: User | null | undefined;
  /** Autor da ação (quem comentou); nunca recebe o próprio e-mail. */
  actor?: User | null;
  comment?: string | null;
  newStatus?: string | null;
  oldStatus?: string | null;
  /** Resumo das alterações da equipe (evento ticket_updated), ex.: "grupo: TI → Financeiro". */
  changes?: string | null;
}

export function ticketLink(env: MailEnv, ticket: Pick<Ticket, "id">): string {
  return `${env.APP_URL}/chamados/${ticket.id}`;
}

export function ticketVariables(env: MailEnv, ticket: Ticket, input: TicketEmailInput): EmailVariables {
  return {
    codigo: ticket.code,
    titulo: ticket.title,
    solicitante: input.requester?.name ?? "",
    responsavel: input.assignee?.name ?? input.actor?.name ?? "",
    status: ticketStatusLabel(input.newStatus ?? ticket.status),
    link: ticketLink(env, ticket),
    comentario: input.comment ?? "",
    alteracoes: input.changes ?? "",
  };
}

function ticketDetailsCard(ticket: Ticket, input: TicketEmailInput): string {
  const e = (v: string | null | undefined) => escapeHtml(v ?? "");
  return sectionCard(`
    <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:12px;">${e(ticket.code)} — ${e(ticket.title)}</div>
    ${input.oldStatus && input.newStatus && input.oldStatus !== input.newStatus ? statusTransition(input.oldStatus, input.newStatus) : ""}
    ${infoTable([
      { label: "Grupo", value: e(ticket.category) },
      { label: "Tipo", value: e(ticketTypeLabel(ticket.type)) },
      ...(ticket.requestObject ? [{ label: "Objeto da Requisição", value: e([ticket.requestObject, ticket.requestAction, ticket.requestDetail].filter(Boolean).join(" › ")) }] : []),
      { label: "Status", value: statusBadge(input.newStatus ?? ticket.status) },
      ...(input.requester ? [{ label: "Solicitante", value: e(input.requester.name) }] : []),
      ...(input.assignee ? [{ label: "Responsável", value: e(input.assignee.name) }] : []),
    ])}
  `, "Detalhes do chamado");
}

/** Monta as linhas da fila de um evento de chamado, conforme Configurações → E-mail. */
export async function buildTicketEmailRows(
  ctx: MailContext,
  storage: IStorage,
  event: EmailEvent,
  ticket: Ticket,
  input: TicketEmailInput,
): Promise<InsertEmailOutbox[]> {
  const settings = await loadEmailSettings(ctx.db);
  const config = settings.events[event];
  if (!config.enabled) {
    logEmailSkipped(event, "Evento desativado em Configurações → E-mail");
    return [];
  }

  const byRole: Record<EmailRecipient, User | null | undefined> = {
    solicitante: input.requester,
    responsavel: input.assignee,
  };
  // Só as duas pontas do chamado recebem: solicitante e responsável (nunca o grupo nem os
  // admins). Sem responsável, a resposta do solicitante fica só no histórico do chamado.
  const recipients = new Map<string, User>();
  for (const role of config.recipients) {
    const user = byRole[role];
    if (!user || (input.actor && user.id === input.actor.id)) continue;
    recipients.set(user.id, user);
  }
  if (recipients.size === 0) {
    logEmailSkipped(event, "Sem destinatário (chamado sem responsável ou autor é o único envolvido)");
    return [];
  }

  const meta = EMAIL_EVENT_META[event];
  const vars = ticketVariables(ctx.env, ticket, input);
  const subject = renderSubject(config.subject, vars);
  const link = vars.link!;
  const html = emailTemplate({
    title: meta.heading,
    subtitle: escapeHtml(`${ticket.code} - ${ticket.title}`),
    breadcrumbParts: ["Chamados", escapeHtml(ticket.code)],
    greeting: "",
    body: `${renderTemplateHtml(config.body, vars)}${ticketDetailsCard(ticket, input)}`,
    ctaText: meta.cta,
    ctaUrl: link,
  });
  const text = `${renderTemplateText(config.body, vars)}\n\n${meta.cta}: ${link}`;
  const domain = senderDomain(ctx.env);
  const rootId = ticketThreadRootId(ticket.id, domain);

  const rows: InsertEmailOutbox[] = [];
  for (const user of recipients.values()) {
    const base = {
      tenantId: ticket.tenantId ?? null,
      event,
      ticketId: ticket.id,
      toEmail: user.email || "",
      toUserId: user.id,
      subject,
      html,
      text,
      messageIdHeader: newMessageId(domain, "chamado"),
      threadRootId: rootId,
    };
    if (!user.email || user.status !== "active") {
      rows.push({ ...base, status: "skipped", lastError: !user.email ? "Destinatário sem e-mail" : "Usuário inativo" });
      continue;
    }
    if (!(await storage.shouldSendEmail(user.id, EVENT_PREFERENCE[event]))) {
      logEmailSkipped(event, "Desabilitado pelo usuário", user.id);
      continue;
    }
    rows.push({ ...base, status: "pending" });
  }
  return rows;
}

export async function queueTicketEmail(
  ctx: MailContext,
  storage: IStorage,
  event: EmailEvent,
  ticket: Ticket,
  input: TicketEmailInput,
): Promise<void> {
  const rows = await buildTicketEmailRows(ctx, storage, event, ticket, input);
  if (rows.length === 0) return;
  await queueEmails(ctx, rows);
  logEmailSent(event, rows.filter((r) => r.status === "pending").map((r) => r.toEmail ?? ""), ticket.code);
}

// ============== 3. sendTicketCreatedEmail ==============

async function sendTicketCreatedEmailNow(
  ctx: MailContext,
  storage: IStorage,
  ticket: Ticket,
  requester: User,
  assignee: User | null
): Promise<void> {
  await queueTicketEmail(ctx, storage, "ticket_created", ticket, { requester, assignee });
}

// ============== 4. sendTicketAssignedEmail ==============

async function sendTicketAssignedEmailNow(
  ctx: MailContext,
  storage: IStorage,
  ticket: Ticket,
  assignee: User
): Promise<void> {
  const requester = await storage.getUser(ticket.requesterId);
  await queueTicketEmail(ctx, storage, "ticket_assigned", ticket, { requester, assignee });
}

// ============== 5. sendTicketStatusChangedEmail ==============

async function sendTicketStatusChangedEmailNow(
  ctx: MailContext,
  storage: IStorage,
  ticket: Ticket,
  oldStatus: string,
  newStatus: string,
  requester: User,
  assignee: User | null
): Promise<void> {
  const event: EmailEvent = newStatus === "resolved" || newStatus === "closed" ? "ticket_closed" : "status_changed";
  await queueTicketEmail(ctx, storage, event, ticket, { requester, assignee, oldStatus, newStatus });
}

// ============== 5b. sendTicketUpdatedEmail ==============

/** A equipe alterou grupo ou título: avisa o solicitante (nunca quem fez a alteração). */
async function sendTicketUpdatedEmailNow(
  ctx: MailContext,
  storage: IStorage,
  ticket: Ticket,
  changes: string,
  requester: User,
  actor: User | null,
): Promise<void> {
  if (!changes) return;
  await queueTicketEmail(ctx, storage, "ticket_updated", ticket, { requester, assignee: null, actor, changes });
}

// ============== 6. sendTicketCommentEmail ==============

async function sendTicketCommentEmailNow(
  ctx: MailContext,
  storage: IStorage,
  ticket: Ticket,
  comment: TicketComment,
  commenter: User,
  requester: User,
  assignee: User | null
): Promise<void> {
  // Nota interna nunca sai por e-mail.
  if (comment.isInternal) return;
  const event: EmailEvent = commenter.id === requester.id ? "requester_reply" : "agent_reply";
  await queueTicketEmail(ctx, storage, event, ticket, {
    requester,
    // Na resposta da equipe sem responsável, {{responsavel}} é quem respondeu.
    assignee: event === "agent_reply" && !assignee ? commenter : assignee,
    actor: commenter,
    comment: comment.content,
  });
}

// ============== 7. sendCSATReceivedEmail ==============

async function sendCSATReceivedEmailNow(
  ctx: MailContext,
  _storage: IStorage,
  ticket: Ticket,
  rating: number,
  comment: string | null,
  assignee: User
): Promise<void> {
  const stars = "⭐".repeat(rating);
  const emptyStars = "☆".repeat(5 - rating);

  const html = emailTemplate({
    title: "Avaliação de Chamado Recebida",
    subtitle: `${stars} ${rating}/5`,
    breadcrumbParts: ["Chamados", escapeHtml(ticket.code), "Avaliação"],
    greeting: `Olá ${escapeHtml(assignee.name)},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">O chamado que você atendeu recebeu uma avaliação de satisfação:</p>
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:16px;">${escapeHtml(ticket.code)} — ${escapeHtml(ticket.title)}</div>
        <div style="text-align:center;margin:16px 0;">
          <span style="font-size:32px;">${stars}${emptyStars}</span>
          <p style="color:#64748b;font-size:14px;margin:8px 0 0;">${rating} de 5 estrelas</p>
        </div>
        ${comment ? `<div style="margin-top:16px;padding:12px;background:white;border-radius:8px;border-left:4px solid #3B42DE;"><p style="color:#64748b;font-size:13px;font-style:italic;margin:0;">"${escapeHtml(comment)}"</p></div>` : ""}
        ${infoTable([{ label: "Avaliado em", value: formatDateTime(new Date()) }])}
      `)}
    `,
    ctaText: "Ver Chamado Completo",
    ctaUrl: ticketLink(ctx.env, ticket),
  });
  await queueSingle(ctx, "csat_received", assignee, `[${ticket.code}] Avaliação recebida - ${stars}`, html, ticket);
}

// ============== 8. sendCardStatusChangedEmail ==============

export async function sendCardStatusChangedEmail(
  env: EmailEnv,
  storage: IStorage,
  card: KanbanCard,
  project: Project,
  oldStatus: string,
  newStatus: string,
  changedBy: User,
  assignee: User | null,
  reporter: User | null
): Promise<void> {
  const userIds: string[] = [];
  if (assignee && assignee.id !== changedBy.id) userIds.push(assignee.id);
  if (reporter && reporter.id !== changedBy.id && reporter.id !== assignee?.id) userIds.push(reporter.id);
  if (userIds.length === 0) return;

  const allowedIds = await filterRecipientsByPreference(storage, userIds, "project_card_status");
  if (allowedIds.length === 0) {
    logEmailSkipped("project_card_status", "Todos os destinatarios desabilitaram esta notificacao");
    return;
  }

  const recipientEmails: SendPulseRecipient[] = [];
  if (assignee && allowedIds.includes(assignee.id)) recipientEmails.push({ name: assignee.name, email: assignee.email });
  if (reporter && allowedIds.includes(reporter.id) && !recipientEmails.some((r) => r.email === reporter.email)) {
    recipientEmails.push({ name: reporter.name, email: reporter.email });
  }
  if (recipientEmails.length === 0) return;

  const projectUrl = getProjectUrl(card.projectId);
  const html = emailTemplate({
    title: "Status do Card Alterado",
    subtitle: `${project.code || project.name} — ${card.title}`,
    breadcrumbParts: ["Projetos", project.code || project.name, card.title, "Status"],
    body: `
      ${actionBy(changedBy.name, "alterou o status do card", new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:16px;">${card.title}</div>
        ${statusTransition(oldStatus, newStatus)}
        ${infoTable([
          { label: "Projeto", value: project.name },
          ...(assignee ? [{ label: "Responsavel", value: assignee.name }] : []),
          ...(card.dueDate ? [{ label: "Prazo", value: formatDateTime(card.dueDate) }] : []),
        ])}
      `)}
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await sendMail(env, {
      to: recipientEmails,
      subject: `[${project.code || "PRO"}] Card "${card.title}": ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`,
      html,
    });
    logEmailSent("project_card_status", recipientEmails.map((r) => r.email), card.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar project_card_status:", error);
  }
}

// ============== 9. sendCardAssignedEmail ==============

export async function sendCardAssignedEmail(
  env: EmailEnv,
  storage: IStorage,
  card: KanbanCard,
  project: Project,
  assignee: User,
  assignedBy: User
): Promise<void> {
  if (!assignee.email || assignee.status !== "active" || assignee.id === assignedBy.id) return;

  const shouldSend = await storage.shouldSendEmail(assignee.id, "project_card_assigned");
  if (!shouldSend) {
    logEmailSkipped("project_card_assigned", "Desabilitado pelo usuario", assignee.id);
    return;
  }

  const projectUrl = getProjectUrl(card.projectId);
  const html = emailTemplate({
    title: "Card Atribuido a Voce",
    subtitle: `${project.code || project.name} — ${card.title}`,
    breadcrumbParts: ["Projetos", project.code || project.name, card.title, "Atribuicao"],
    greeting: `Ola ${assignee.name},`,
    body: `
      ${actionBy(assignedBy.name, "atribuiu um card a voce", new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:16px;">${card.title}</div>
        ${infoTable([
          { label: "Projeto", value: project.name },
          { label: "Status", value: statusBadge(card.status) },
          ...(card.priority ? [{ label: "Prioridade", value: priorityBadge(card.priority) }] : []),
          ...(card.dueDate ? [{ label: "Prazo", value: formatDateTime(card.dueDate) }] : []),
        ])}
      `)}
      ${(card as any).description ? sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${(card as any).description.substring(0, 300)}${(card as any).description.length > 300 ? "..." : ""}</div>`, "Descricao") : ""}
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await sendMail(env, {
      to: [{ name: assignee.name, email: assignee.email }],
      subject: `[${project.code || "PRO"}] Card Atribuido: ${card.title}`,
      html,
    });
    logEmailSent("project_card_assigned", [assignee.email], card.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar project_card_assigned:", error);
  }
}

// ============== 10. sendProjectMemberAddedEmail ==============

export async function sendProjectMemberAddedEmail(
  env: EmailEnv,
  storage: IStorage,
  project: Project,
  member: User,
  addedBy: User
): Promise<void> {
  if (!member.email || member.status !== "active" || member.id === addedBy.id) return;

  const shouldSend = await storage.shouldSendEmail(member.id, "project_update");
  if (!shouldSend) {
    logEmailSkipped("project_update", "Desabilitado pelo usuario", member.id);
    return;
  }

  const projectUrl = getProjectUrl(project.id);
  const html = emailTemplate({
    title: "Voce foi adicionado a um Projeto",
    subtitle: project.name,
    breadcrumbParts: ["Projetos", project.code || project.name, "Novo membro"],
    greeting: `Ola ${member.name},`,
    body: `
      ${actionBy(addedBy.name, "adicionou voce ao projeto", new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:12px;">${project.name}</div>
        ${project.description ? `<div style="color:#64748b;font-size:13px;line-height:1.6;margin-bottom:12px;">${project.description.substring(0, 200)}</div>` : ""}
        ${infoTable([
          { label: "Codigo", value: project.code || "—" },
          { label: "Status", value: statusBadge(project.status) },
          ...(project.startDate ? [{ label: "Inicio", value: formatDateTime(project.startDate) }] : []),
          ...(project.endDate ? [{ label: "Termino", value: formatDateTime(project.endDate) }] : []),
        ])}
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Agora voce pode visualizar e colaborar nos cards e atividades deste projeto.</p>
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await sendMail(env, {
      to: [{ name: member.name, email: member.email }],
      subject: `Voce foi adicionado ao projeto: ${project.name}`,
      html,
    });
    logEmailSent("project_member_added", [member.email], project.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar project_member_added:", error);
  }
}

// ============== 11. sendCardCommentEmail ==============

export async function sendCardCommentEmail(
  env: EmailEnv,
  storage: IStorage,
  card: KanbanCard,
  project: Project,
  commentContent: string,
  commenter: User,
  assignee: User | null,
  reporter: User | null
): Promise<void> {
  const userIds: string[] = [];
  if (assignee && assignee.id !== commenter.id) userIds.push(assignee.id);
  if (reporter && reporter.id !== commenter.id && reporter.id !== assignee?.id) userIds.push(reporter.id);
  if (userIds.length === 0) return;

  const allowedIds = await filterRecipientsByPreference(storage, userIds, "ticket_comment");
  if (allowedIds.length === 0) return;

  const recipientEmails: SendPulseRecipient[] = [];
  if (assignee && allowedIds.includes(assignee.id)) recipientEmails.push({ name: assignee.name, email: assignee.email });
  if (reporter && allowedIds.includes(reporter.id) && !recipientEmails.some((r) => r.email === reporter.email)) {
    recipientEmails.push({ name: reporter.name, email: reporter.email });
  }
  if (recipientEmails.length === 0) return;

  const projectUrl = getProjectUrl(card.projectId);
  const html = emailTemplate({
    title: "Novo Comentario no Card",
    subtitle: `${project.code || project.name} — ${card.title}`,
    breadcrumbParts: ["Projetos", project.code || project.name, card.title, "Comentario"],
    body: `
      ${actionBy(commenter.name, "comentou no card", new Date())}
      ${sectionCard(`<div style="font-weight:700;font-size:15px;color:#1a1a2e;">${card.title}</div>`)}
      ${commentBox(commentContent, commenter.name)}
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await sendMail(env, {
      to: recipientEmails,
      subject: `[${project.code || "PRO"}] Comentario em "${card.title}"`,
      html,
    });
    logEmailSent("card_comment", recipientEmails.map((r) => r.email), card.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar card_comment:", error);
  }
}

// ============== 12. sendMeetingInviteEmail ==============

export async function sendMeetingInviteEmail(
  env: EmailEnv,
  storage: IStorage,
  task: Task,
  organizer: User,
  participants: User[],
  externalEmails: string[]
): Promise<void> {
  let meetingData: { date: string; time: string; location?: string; agenda?: string };
  try {
    meetingData =
      typeof task.meetingData === "string"
        ? JSON.parse(task.meetingData)
        : (task.meetingData as unknown as typeof meetingData);
  } catch {
    logEmailSkipped("meeting_invite", "Dados de reuniao invalidos");
    return;
  }

  if (!meetingData?.date || !meetingData?.time) {
    logEmailSkipped("meeting_invite", "Dados de reuniao incompletos");
    return;
  }

  // Filter participants by preference
  const participantIds = participants.map((p) => p.id);
  const allowedIds = await filterRecipientsByPreference(storage, participantIds, "meeting_invite");
  const allowedParticipants = participants.filter((p) => allowedIds.includes(p.id));

  const recipients: SendPulseRecipient[] = [
    ...allowedParticipants.map((p) => ({ name: p.name, email: p.email })),
    ...externalEmails.filter(Boolean).map((e) => ({ name: e, email: e })),
  ];

  if (recipients.length === 0) return;

  const attendees = [
    ...allowedParticipants.map((p) => ({ name: p.name, email: p.email })),
    ...externalEmails.map((e) => ({ name: e, email: e })),
  ];

  let recurrenceWeekdays: number[] = [];
  try {
    recurrenceWeekdays =
      typeof task.recurrenceWeekdays === "string"
        ? JSON.parse(task.recurrenceWeekdays)
        : (task.recurrenceWeekdays as unknown as number[]) || [];
  } catch {
    recurrenceWeekdays = [];
  }

  const icsContent = generateICSContent(
    {
      title: task.title,
      date: meetingData.date,
      time: meetingData.time,
      location: meetingData.location,
      description: typeof meetingData.agenda === "string" ? meetingData.agenda : "",
      organizerName: organizer.name,
      organizerEmail: organizer.email,
      isRecurring: task.isRecurring || false,
      recurrenceType: task.recurrenceType || undefined,
      recurrenceWeekdays,
      recurrenceEndDate: task.recurrenceEndDate
        ? format(task.recurrenceEndDate, "yyyy-MM-dd")
        : undefined,
    },
    attendees
  );

  const formattedDate = new Date(`${meetingData.date}T${meetingData.time}`).toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const html = emailTemplate({
    title: "Convite de Reuniao",
    subtitle: task.title,
    breadcrumbParts: ["Reunioes", task.title],
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Voce foi convidado(a) para uma reuniao no Pitzi Home:</p>
      ${actionBy(organizer.name, "organizou esta reuniao")}
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:16px;">${task.title}</div>
        ${infoTable([
          { label: "Data e Hora", value: `<strong>${formattedDate}</strong>` },
          ...(meetingData.location ? [{ label: "Local", value: meetingData.location }] : []),
          { label: "Organizador", value: organizer.name },
          { label: "Participantes", value: attendees.map((a) => a.name).join(", ") },
        ])}
      `)}
      ${meetingData.agenda ? sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${meetingData.agenda}</div>`, "Pauta") : ""}
      <p style="margin-top:16px;font-size:13px;color:#64748b;">O arquivo de calendario (.ics) esta anexado a este e-mail. Voce pode adiciona-lo diretamente a sua agenda.</p>
    `,
    ctaText: "Ver no Pitzi Home",
    ctaUrl: `${env.APP_URL}/tarefas`,
  });

  try {
    await sendMail(env, {
      to: recipients,
      subject: `Convite: ${task.title} - ${formattedDate}`,
      html,
      attachments_binary: {
        "invite.ics": btoa(icsContent),
      },
    });
    logEmailSent("meeting_invite", recipients.map((r) => r.email), task.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar meeting_invite:", error);
  }
}

// ============== 13. sendMeetingUpdatedEmail (NO preference filter) ==============

export async function sendMeetingUpdatedEmail(
  env: EmailEnv,
  task: Task,
  organizer: User,
  participants: User[],
  externalEmails: string[],
  changeType: "rescheduled" | "cancelled" | "updated"
): Promise<void> {
  let meetingData: { date: string; time: string; location?: string; agenda?: string } | null = null;
  try {
    meetingData =
      typeof task.meetingData === "string"
        ? JSON.parse(task.meetingData)
        : (task.meetingData as unknown as typeof meetingData);
  } catch {
    meetingData = null;
  }

  const recipients: SendPulseRecipient[] = [
    ...participants.map((p) => ({ name: p.name, email: p.email })),
    ...externalEmails.filter(Boolean).map((e) => ({ name: e, email: e })),
  ];
  if (recipients.length === 0) return;

  const titleMap = {
    rescheduled: "Reuniao Reagendada",
    cancelled: "Reuniao Cancelada",
    updated: "Reuniao Atualizada",
  };

  const formattedDate =
    meetingData?.date && meetingData?.time
      ? new Date(`${meetingData.date}T${meetingData.time}`).toLocaleDateString("pt-BR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Data a definir";

  const html = emailTemplate({
    title: titleMap[changeType],
    subtitle: task.title,
    breadcrumbParts: ["Reunioes", task.title, titleMap[changeType]],
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">A reuniao "<strong>${task.title}</strong>" foi ${changeType === "rescheduled" ? "reagendada" : changeType === "cancelled" ? "cancelada" : "atualizada"}.</p>
      ${actionBy(organizer.name, changeType === "cancelled" ? "cancelou a reuniao" : "atualizou a reuniao", new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:16px;">${task.title}</div>
        ${infoTable([
          { label: "Data e Hora", value: `<strong>${formattedDate}</strong>` },
          ...(meetingData?.location ? [{ label: "Local", value: meetingData.location }] : []),
          { label: "Organizador", value: organizer.name },
        ])}
      `)}
    `,
    ctaText: "Ver no Pitzi Home",
    ctaUrl: `${env.APP_URL}/tarefas`,
  });

  try {
    await sendMail(env, {
      to: recipients,
      subject: `${titleMap[changeType]}: ${task.title}`,
      html,
    });
    logEmailSent("meeting_update", recipients.map((r) => r.email), task.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar meeting_update:", error);
  }
}

// ============== 14. sendMentionNotificationEmail ==============

async function sendMentionNotificationEmailNow(
  ctx: MailContext,
  storage: IStorage,
  mentionedUser: User,
  mentionerName: string,
  taskTitle: string,
  _taskId: string,
  commentContent: string,
  ticket?: Pick<Ticket, "id" | "code"> | null
): Promise<void> {
  if (!mentionedUser.email || mentionedUser.status !== "active") return;

  const shouldSend = await storage.shouldSendEmail(mentionedUser.id, "mention");
  if (!shouldSend) {
    logEmailSkipped("mention", "Desabilitado pelo usuario", mentionedUser.id);
    return;
  }

  const html = emailTemplate({
    title: "Você foi mencionado",
    subtitle: escapeHtml(taskTitle),
    breadcrumbParts: ["Menção", escapeHtml(taskTitle)],
    greeting: `Olá ${escapeHtml(mentionedUser.name)},`,
    body: `
      ${actionBy(escapeHtml(mentionerName), "mencionou você em um comentário")}
      ${sectionCard(`<div style="font-weight:700;font-size:15px;color:#1a1a2e;">${escapeHtml(taskTitle)}</div>`)}
      ${commentBox(escapeHtml(htmlToText(commentContent).replace(/\uFEFF/g, "").trim()), escapeHtml(mentionerName))}
    `,
    ctaText: ticket ? "Ver chamado" : "Ver Tarefa",
    ctaUrl: ticket ? ticketLink(ctx.env, ticket) : `${ctx.env.APP_URL}/tarefas`,
  });
  const subject = ticket ? `[${ticket.code}] Você foi mencionado: ${taskTitle}` : `Você foi mencionado em: ${taskTitle}`;
  await queueSingle(ctx, "mention", mentionedUser, subject, html, ticket ? { id: ticket.id } : null);
}

// ============== 15. sendSharedAreaInviteEmail ==============

export async function sendSharedAreaInviteEmail(
  env: EmailEnv,
  invitedUser: User,
  areaName: string,
  areaId: string,
  ownerName: string
): Promise<void> {
  if (!invitedUser.email || invitedUser.status !== "active") return;

  const html = emailTemplate({
    title: "Convite para Area Compartilhada",
    subtitle: areaName,
    greeting: `Ola ${invitedUser.name},`,
    body: `
      ${actionBy(ownerName, "adicionou voce a area compartilhada")}
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:12px;">${areaName}</div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;">Agora voce pode visualizar e colaborar em tarefas e reunioes desta area.</p>
      `)}
    `,
    ctaText: "Acessar Area",
    ctaUrl: `${env.APP_URL}/shared-area/${areaId}`,
  });

  try {
    await sendMail(env, {
      to: [{ name: invitedUser.name, email: invitedUser.email }],
      subject: `Convite: Area Compartilhada "${areaName}"`,
      html,
    });
    logEmailSent("shared_area_invite", [invitedUser.email], areaId);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar shared_area_invite:", error);
  }
}

// ============== EXPORTS COM keepAlive ==============
// Cada envio registra waitUntil no momento da chamada (ver keepAlive em mailer.ts).
export const sendPasswordResetEmail: typeof sendPasswordResetEmailNow = (...args) => keepAlive(args[0], sendPasswordResetEmailNow(...args));
export const sendPasswordResetLinkEmail: typeof sendPasswordResetLinkEmailNow = (...args) => keepAlive(args[0], sendPasswordResetLinkEmailNow(...args));
export const sendWelcomeEmail: typeof sendWelcomeEmailNow = (...args) => keepAlive(args[0], sendWelcomeEmailNow(...args));
export const sendTicketCreatedEmail: typeof sendTicketCreatedEmailNow = (...args) => keepAlive(args[0], sendTicketCreatedEmailNow(...args));
export const sendTicketAssignedEmail: typeof sendTicketAssignedEmailNow = (...args) => keepAlive(args[0], sendTicketAssignedEmailNow(...args));
export const sendTicketStatusChangedEmail: typeof sendTicketStatusChangedEmailNow = (...args) => keepAlive(args[0], sendTicketStatusChangedEmailNow(...args));
export const sendTicketUpdatedEmail: typeof sendTicketUpdatedEmailNow = (...args) => keepAlive(args[0], sendTicketUpdatedEmailNow(...args));
export const sendTicketCommentEmail: typeof sendTicketCommentEmailNow = (...args) => keepAlive(args[0], sendTicketCommentEmailNow(...args));
export const sendCSATReceivedEmail: typeof sendCSATReceivedEmailNow = (...args) => keepAlive(args[0], sendCSATReceivedEmailNow(...args));
export const sendMentionNotificationEmail: typeof sendMentionNotificationEmailNow = (...args) => keepAlive(args[0], sendMentionNotificationEmailNow(...args));
