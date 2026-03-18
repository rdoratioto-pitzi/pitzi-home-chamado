/**
 * Email service for Cloudflare Workers — Renov Home
 *
 * Replaces server/email-service.ts (nodemailer/SMTP) with SendPulse REST API.
 * All 15 exported email functions are faithfully reproduced.
 */

import { format } from "date-fns-tz";
import { generateICSContent } from "./ics";
import type { Ticket, User, TicketComment, Task, KanbanCard, Project } from "../../../shared/schema";
import type { IStorage, EmailNotificationType } from "../../../server/storage";
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

// ============== TYPES ==============

export interface EmailEnv {
  SENDPULSE_API_USER_ID: string;
  SENDPULSE_API_SECRET: string;
  SENDPULSE_SENDER_NAME: string;
  SENDPULSE_SENDER_EMAIL: string;
  APP_URL: string;
}

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

// ============== SENDPULSE TRANSPORT ==============

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getSendPulseToken(env: EmailEnv): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.SENDPULSE_API_USER_ID,
      client_secret: env.SENDPULSE_API_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`SendPulse auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

async function sendMail(env: EmailEnv, options: SendMailOptions): Promise<void> {
  const token = await getSendPulseToken(env);

  const payload: Record<string, unknown> = {
    email: {
      subject: options.subject,
      html: options.html,
      from: {
        name: env.SENDPULSE_SENDER_NAME,
        email: env.SENDPULSE_SENDER_EMAIL,
      },
      to: options.to,
    },
  };

  if (options.attachments_binary) {
    (payload.email as Record<string, unknown>).attachments_binary = options.attachments_binary;
  }

  const res = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`SendPulse send failed: ${res.status} ${await res.text()}`);
  }
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

// ============== 1. sendPasswordResetEmail ==============

export async function sendPasswordResetEmail(
  env: EmailEnv,
  user: User,
  temporaryPassword: string
): Promise<void> {
  const html = emailTemplate({
    title: "Redefinicao de Senha",
    greeting: `Ola ${user.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Recebemos uma solicitacao para redefinir sua senha no Renov Home.</p>
      ${sectionCard(`
        <div style="text-align:center;">
          <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Sua nova senha temporaria</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:3px;color:#1a1a2e;margin:0;padding:12px;background:white;border-radius:8px;">${temporaryPassword}</p>
        </div>
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Use esta senha para acessar o sistema. Recomendamos que voce altere sua senha apos o primeiro acesso.</p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Se voce nao solicitou esta redefinicao, entre em contato com o administrador do sistema imediatamente.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${env.APP_URL}/login`,
  });

  try {
    await sendMail(env, {
      to: [{ name: user.name, email: user.email }],
      subject: "Renov Home - Redefinicao de Senha",
      html,
    });
    logEmailSent("password_reset", [user.email]);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar redefinicao de senha:", error);
    throw error;
  }
}

// ============== 2. sendWelcomeEmail ==============

export async function sendWelcomeEmail(
  env: EmailEnv,
  user: User,
  initialPassword: string
): Promise<{ success: boolean; error?: string }> {
  const html = emailTemplate({
    title: "Bem-vindo ao Renov Home",
    greeting: `Ola <strong>${user.name}</strong>,`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Voce foi cadastrado na plataforma interna de gestao da Renov. Abaixo estao suas informacoes de acesso:</p>
      ${sectionCard(`
        ${infoTable([
          { label: "Link", value: `<a href="https://home.renovsmart.com.br/" style="color:#00A137;font-weight:600;">home.renovsmart.com.br</a>` },
          { label: "E-mail", value: user.email },
          { label: "Senha inicial", value: `<code style="background:#e8f5e9;padding:4px 8px;border-radius:4px;font-weight:600;">${initialPassword}</code>` },
        ])}
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Recomendamos que voce altere sua senha apos o primeiro acesso.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${env.APP_URL}/login`,
  });

  try {
    await sendMail(env, {
      to: [{ name: user.name, email: user.email }],
      subject: "Bem-vindo ao Renov Home - Acesso ao Sistema",
      html,
    });
    logEmailSent("welcome", [user.email]);
    return { success: true };
  } catch (error) {
    const errorMessage = `Falha ao enviar e-mail de boas-vindas para ${user.email}: ${error instanceof Error ? error.message : String(error)}`;
    console.error("[EMAIL]", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============== 3. sendTicketCreatedEmail ==============

export async function sendTicketCreatedEmail(
  env: EmailEnv,
  storage: IStorage,
  ticket: Ticket,
  requester: User,
  assignee: User | null
): Promise<void> {
  const userIds = [requester.id];
  if (assignee && assignee.id !== requester.id) userIds.push(assignee.id);
  const allowedIds = await filterRecipientsByPreference(storage, userIds, "ticket_new");
  if (allowedIds.length === 0) {
    logEmailSkipped("ticket_new", "Todos os destinatarios desabilitaram esta notificacao");
    return;
  }

  const recipientEmails: SendPulseRecipient[] = [];
  if (allowedIds.includes(requester.id)) recipientEmails.push({ name: requester.name, email: requester.email });
  if (assignee && allowedIds.includes(assignee.id) && !recipientEmails.some((r) => r.email === assignee.email)) {
    recipientEmails.push({ name: assignee.name, email: assignee.email });
  }

  const ticketUrl = getTicketUrl(ticket.code);
  const descriptionPreview = ticket.description
    ? (ticket.description.length > 300 ? ticket.description.substring(0, 300) + "..." : ticket.description)
    : "Sem descricao";

  const html = emailTemplate({
    title: "Novo Chamado Criado",
    subtitle: `${ticket.code} - ${ticket.title}`,
    breadcrumbParts: ["Chamados", ticket.code, "Criado"],
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Um novo chamado foi aberto no Renov Home:</p>
      ${actionBy(requester.name, "abriu este chamado", ticket.dataAbertura || new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:16px;">${ticket.code} — ${ticket.title}</div>
        ${infoTable([
          { label: "Categoria", value: ticket.category },
          { label: "Tipo", value: ticket.type },
          { label: "Local", value: ticket.location },
          { label: "Prioridade", value: priorityBadge(ticket.priority) },
          { label: "Solicitante", value: requester.name },
          ...(assignee ? [{ label: "Responsavel", value: assignee.name }] : []),
          { label: "Status", value: statusBadge(ticket.status) },
        ])}
      `, "Detalhes do Chamado")}
      ${sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${descriptionPreview}</div>`, "Descricao")}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await sendMail(env, {
      to: recipientEmails,
      subject: `[${ticket.code}] Novo Chamado: ${ticket.title}`,
      html,
    });
    logEmailSent("ticket_new", recipientEmails.map((r) => r.email), ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_new:", error);
  }
}

// ============== 4. sendTicketAssignedEmail ==============

export async function sendTicketAssignedEmail(
  env: EmailEnv,
  storage: IStorage,
  ticket: Ticket,
  assignee: User
): Promise<void> {
  if (!assignee.email || assignee.status !== "active") {
    logEmailSkipped("ticket_assigned", "Destinatario sem e-mail ou inativo", assignee.id);
    return;
  }

  const shouldSend = await storage.shouldSendEmail(assignee.id, "ticket_assigned");
  if (!shouldSend) {
    logEmailSkipped("ticket_assigned", "Desabilitado pelo usuario", assignee.id);
    return;
  }

  const ticketUrl = getTicketUrl(ticket.code);
  const html = emailTemplate({
    title: "Chamado Atribuido a Voce",
    subtitle: `${ticket.code} - ${ticket.title}`,
    breadcrumbParts: ["Chamados", ticket.code, "Atribuicao"],
    greeting: `Ola ${assignee.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Um chamado foi atribuido a voce no Renov Home:</p>
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:16px;">${ticket.code} — ${ticket.title}</div>
        ${infoTable([
          { label: "Categoria", value: ticket.category },
          { label: "Tipo", value: ticket.type },
          { label: "Local", value: ticket.location },
          { label: "Prioridade", value: priorityBadge(ticket.priority) },
          { label: "Status", value: statusBadge(ticket.status) },
        ])}
      `)}
      ${ticket.description ? sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${ticket.description.substring(0, 300)}${ticket.description.length > 300 ? "..." : ""}</div>`, "Descricao") : ""}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await sendMail(env, {
      to: [{ name: assignee.name, email: assignee.email }],
      subject: `[${ticket.code}] Chamado Atribuido: ${ticket.title}`,
      html,
    });
    logEmailSent("ticket_assigned", [assignee.email], ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_assigned:", error);
  }
}

// ============== 5. sendTicketStatusChangedEmail ==============

export async function sendTicketStatusChangedEmail(
  env: EmailEnv,
  storage: IStorage,
  ticket: Ticket,
  oldStatus: string,
  newStatus: string,
  requester: User,
  assignee: User | null
): Promise<void> {
  const userIds = [requester.id];
  if (assignee && assignee.id !== requester.id) userIds.push(assignee.id);
  const allowedIds = await filterRecipientsByPreference(storage, userIds, "ticket_status");
  if (allowedIds.length === 0) {
    logEmailSkipped("ticket_status", "Todos os destinatarios desabilitaram esta notificacao");
    return;
  }

  const recipientEmails: SendPulseRecipient[] = [];
  if (allowedIds.includes(requester.id)) recipientEmails.push({ name: requester.name, email: requester.email });
  if (assignee && allowedIds.includes(assignee.id) && !recipientEmails.some((r) => r.email === assignee.email)) {
    recipientEmails.push({ name: assignee.name, email: assignee.email });
  }

  const ticketUrl = getTicketUrl(ticket.code);
  const html = emailTemplate({
    title: "Status do Chamado Alterado",
    subtitle: `${ticket.code} - ${ticket.title}`,
    breadcrumbParts: ["Chamados", ticket.code, "Status alterado"],
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">O status do chamado foi atualizado:</p>
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:16px;">${ticket.code} — ${ticket.title}</div>
        ${statusTransition(oldStatus, newStatus)}
        ${infoTable([
          { label: "Prioridade", value: priorityBadge(ticket.priority) },
          ...(assignee ? [{ label: "Responsavel", value: assignee.name }] : []),
          { label: "Atualizado em", value: formatDateTime(new Date()) },
        ])}
      `)}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await sendMail(env, {
      to: recipientEmails,
      subject: `[${ticket.code}] Status: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`,
      html,
    });
    logEmailSent("ticket_status", recipientEmails.map((r) => r.email), ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_status:", error);
  }
}

// ============== 6. sendTicketCommentEmail ==============

export async function sendTicketCommentEmail(
  env: EmailEnv,
  storage: IStorage,
  ticket: Ticket,
  comment: TicketComment,
  commenter: User,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (comment.isInternal) return;

  const userIds: string[] = [];
  if (requester.id !== commenter.id) userIds.push(requester.id);
  if (assignee && assignee.id !== commenter.id && assignee.id !== requester.id) userIds.push(assignee.id);
  if (userIds.length === 0) return;

  const allowedIds = await filterRecipientsByPreference(storage, userIds, "ticket_comment");
  if (allowedIds.length === 0) {
    logEmailSkipped("ticket_comment", "Todos os destinatarios desabilitaram esta notificacao");
    return;
  }

  const recipientEmails: SendPulseRecipient[] = [];
  if (allowedIds.includes(requester.id)) recipientEmails.push({ name: requester.name, email: requester.email });
  if (assignee && allowedIds.includes(assignee.id) && !recipientEmails.some((r) => r.email === assignee.email)) {
    recipientEmails.push({ name: assignee.name, email: assignee.email });
  }
  if (recipientEmails.length === 0) return;

  const ticketUrl = getTicketUrl(ticket.code);
  const html = emailTemplate({
    title: "Novo Comentario no Chamado",
    subtitle: `${ticket.code} - ${ticket.title}`,
    breadcrumbParts: ["Chamados", ticket.code, "Comentario"],
    body: `
      ${actionBy(commenter.name, "adicionou um comentario", comment.createdAt)}
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:12px;">${ticket.code} — ${ticket.title}</div>
      `)}
      ${commentBox(comment.content, commenter.name)}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await sendMail(env, {
      to: recipientEmails,
      subject: `[${ticket.code}] Novo Comentario: ${ticket.title}`,
      html,
    });
    logEmailSent("ticket_comment", recipientEmails.map((r) => r.email), ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_comment:", error);
  }
}

// ============== 7. sendCSATReceivedEmail ==============

export async function sendCSATReceivedEmail(
  env: EmailEnv,
  ticket: Ticket,
  rating: number,
  comment: string | null,
  assignee: User
): Promise<void> {
  if (!assignee.email || assignee.status !== "active") return;

  const ticketUrl = getTicketUrl(ticket.code || ticket.id);
  const stars = "\u2B50".repeat(rating);
  const emptyStars = "\u2606".repeat(5 - rating);

  const html = emailTemplate({
    title: "Avaliacao de Chamado Recebida",
    subtitle: `${stars} ${rating}/5`,
    breadcrumbParts: ["Chamados", ticket.code, "Avaliacao CSAT"],
    greeting: `Ola ${assignee.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">O chamado que voce atendeu recebeu uma avaliacao de satisfacao:</p>
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:16px;">${ticket.code} — ${ticket.title}</div>
        <div style="text-align:center;margin:16px 0;">
          <span style="font-size:32px;">${stars}${emptyStars}</span>
          <p style="color:#64748b;font-size:14px;margin:8px 0 0;">${rating} de 5 estrelas</p>
        </div>
        ${comment ? `<div style="margin-top:16px;padding:12px;background:white;border-radius:8px;border-left:4px solid #00A137;"><p style="color:#64748b;font-size:13px;font-style:italic;margin:0;">"${comment}"</p></div>` : ""}
        ${infoTable([
          { label: "Avaliado em", value: formatDateTime(new Date()) },
        ])}
      `)}
    `,
    ctaText: "Ver Chamado Completo",
    ctaUrl: ticketUrl,
  });

  try {
    await sendMail(env, {
      to: [{ name: assignee.name, email: assignee.email }],
      subject: `[${ticket.code}] Avaliacao Recebida - ${stars}`,
      html,
    });
    logEmailSent("csat", [assignee.email], ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar csat:", error);
  }
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
      <p style="color:#334155;font-size:15px;line-height:1.6;">Voce foi convidado(a) para uma reuniao no Renov Home:</p>
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
    ctaText: "Ver no Renov Home",
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
    ctaText: "Ver no Renov Home",
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

export async function sendMentionNotificationEmail(
  env: EmailEnv,
  storage: IStorage,
  mentionedUser: User,
  mentionerName: string,
  taskTitle: string,
  taskId: string,
  commentContent: string
): Promise<void> {
  if (!mentionedUser.email || mentionedUser.status !== "active") return;

  const shouldSend = await storage.shouldSendEmail(mentionedUser.id, "mention");
  if (!shouldSend) {
    logEmailSkipped("mention", "Desabilitado pelo usuario", mentionedUser.id);
    return;
  }

  const html = emailTemplate({
    title: "Voce foi mencionado",
    subtitle: taskTitle,
    breadcrumbParts: ["Mencao", taskTitle],
    greeting: `Ola ${mentionedUser.name},`,
    body: `
      ${actionBy(mentionerName, "mencionou voce em um comentario")}
      ${sectionCard(`<div style="font-weight:700;font-size:15px;color:#1a1a2e;">${taskTitle}</div>`)}
      ${commentBox(commentContent, mentionerName)}
    `,
    ctaText: "Ver Tarefa",
    ctaUrl: `${env.APP_URL}/tarefas`,
  });

  try {
    await sendMail(env, {
      to: [{ name: mentionedUser.name, email: mentionedUser.email }],
      subject: `Voce foi mencionado em: ${taskTitle}`,
      html,
    });
    logEmailSent("mention", [mentionedUser.email], taskId);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar mention:", error);
  }
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
