import nodemailer from "nodemailer";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import type { Ticket, User, TicketComment, Task, KanbanCard, Project } from "@shared/schema";
import { storage, type EmailNotificationType } from "./storage";
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
} from "./email-templates";

// ============== SMTP TRANSPORTER ==============

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://home.renovsmart.com.br";
}

const BASE_URL = getBaseUrl();

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || `"Renov Home" <${process.env.SMTP_USER}>`;
}

/** Filtra destinatários com base nas preferências de e-mail */
async function filterRecipientsByPreference(
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

/** Log estruturado de envio de e-mail */
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

// ============== E-MAILS DE SISTEMA (sem verificação de preferência) ==============

export async function sendPasswordResetEmail(
  user: User,
  temporaryPassword: string
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("password_reset", "SMTP não configurado");
    return;
  }

  const html = emailTemplate({
    title: "Redefinição de Senha",
    greeting: `Olá ${user.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Recebemos uma solicitação para redefinir sua senha no Renov Home.</p>
      ${sectionCard(`
        <div style="text-align:center;">
          <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Sua nova senha temporária</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:3px;color:#1a1a2e;margin:0;padding:12px;background:white;border-radius:8px;">${temporaryPassword}</p>
        </div>
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Use esta senha para acessar o sistema. Recomendamos que você altere sua senha após o primeiro acesso.</p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Se você não solicitou esta redefinição, entre em contato com o administrador do sistema imediatamente.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${BASE_URL}/login`,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: user.email,
      subject: "Renov Home - Redefinição de Senha",
      html,
    });
    logEmailSent("password_reset", [user.email]);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar redefinição de senha:", error);
    throw error;
  }
}

export async function sendWelcomeEmail(
  user: User,
  initialPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!smtpConfigured()) {
    return { success: false, error: "SMTP não configurado" };
  }

  try {
    await transporter.verify();
  } catch (verifyError) {
    const errorMessage = `Verificação SMTP falhou: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`;
    console.error("[EMAIL]", errorMessage);
    return { success: false, error: errorMessage };
  }

  const html = emailTemplate({
    title: "Bem-vindo ao Renov Home",
    greeting: `Olá <strong>${user.name}</strong>,`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Você foi cadastrado na plataforma interna de gestão da Renov. Abaixo estão suas informações de acesso:</p>
      ${sectionCard(`
        ${infoTable([
          { label: "Link", value: `<a href="https://home.renovsmart.com.br/" style="color:#00A137;font-weight:600;">home.renovsmart.com.br</a>` },
          { label: "E-mail", value: user.email },
          { label: "Senha inicial", value: `<code style="background:#e8f5e9;padding:4px 8px;border-radius:4px;font-weight:600;">${initialPassword}</code>` },
        ])}
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Recomendamos que você altere sua senha após o primeiro acesso.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${BASE_URL}/login`,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: user.email,
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

// ============== E-MAILS DE CHAMADOS ==============

export async function sendTicketCreatedEmail(
  ticket: Ticket,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("ticket_new", "SMTP não configurado");
    return;
  }

  // Filtrar destinatários por preferência
  const userIds = [requester.id];
  if (assignee && assignee.id !== requester.id) userIds.push(assignee.id);
  const allowedIds = await filterRecipientsByPreference(userIds, "ticket_new");
  if (allowedIds.length === 0) {
    logEmailSkipped("ticket_new", "Todos os destinatários desabilitaram esta notificação");
    return;
  }

  const recipientEmails: string[] = [];
  if (allowedIds.includes(requester.id)) recipientEmails.push(requester.email);
  if (assignee && allowedIds.includes(assignee.id) && !recipientEmails.includes(assignee.email)) {
    recipientEmails.push(assignee.email);
  }

  const ticketUrl = getTicketUrl(ticket.code);
  const descriptionPreview = ticket.description
    ? (ticket.description.length > 300 ? ticket.description.substring(0, 300) + "..." : ticket.description)
    : "Sem descrição";

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
          ...(assignee ? [{ label: "Responsável", value: assignee.name }] : []),
          { label: "Status", value: statusBadge(ticket.status) },
        ])}
      `, "Detalhes do Chamado")}
      ${sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${descriptionPreview}</div>`, "Descrição")}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipientEmails.join(", "),
      subject: `[${ticket.code}] Novo Chamado: ${ticket.title}`,
      html,
    });
    logEmailSent("ticket_new", recipientEmails, ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_new:", error);
  }
}

export async function sendTicketAssignedEmail(
  ticket: Ticket,
  assignee: User
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("ticket_assigned", "SMTP não configurado");
    return;
  }

  if (!assignee.email || assignee.status !== "active") {
    logEmailSkipped("ticket_assigned", "Destinatário sem e-mail ou inativo", assignee.id);
    return;
  }

  const shouldSend = await storage.shouldSendEmail(assignee.id, "ticket_assigned");
  if (!shouldSend) {
    logEmailSkipped("ticket_assigned", "Desabilitado pelo usuário", assignee.id);
    return;
  }

  const ticketUrl = getTicketUrl(ticket.code);
  const html = emailTemplate({
    title: "Chamado Atribuído a Você",
    subtitle: `${ticket.code} - ${ticket.title}`,
    breadcrumbParts: ["Chamados", ticket.code, "Atribuição"],
    greeting: `Olá ${assignee.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Um chamado foi atribuído a você no Renov Home:</p>
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
      ${ticket.description ? sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${ticket.description.substring(0, 300)}${ticket.description.length > 300 ? "..." : ""}</div>`, "Descrição") : ""}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: assignee.email,
      subject: `[${ticket.code}] Chamado Atribuído: ${ticket.title}`,
      html,
    });
    logEmailSent("ticket_assigned", [assignee.email], ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_assigned:", error);
  }
}

export async function sendTicketStatusChangedEmail(
  ticket: Ticket,
  oldStatus: string,
  newStatus: string,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("ticket_status", "SMTP não configurado");
    return;
  }

  const userIds = [requester.id];
  if (assignee && assignee.id !== requester.id) userIds.push(assignee.id);
  const allowedIds = await filterRecipientsByPreference(userIds, "ticket_status");
  if (allowedIds.length === 0) {
    logEmailSkipped("ticket_status", "Todos os destinatários desabilitaram esta notificação");
    return;
  }

  const recipientEmails: string[] = [];
  if (allowedIds.includes(requester.id)) recipientEmails.push(requester.email);
  if (assignee && allowedIds.includes(assignee.id) && !recipientEmails.includes(assignee.email)) {
    recipientEmails.push(assignee.email);
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
          ...(assignee ? [{ label: "Responsável", value: assignee.name }] : []),
          { label: "Atualizado em", value: formatDateTime(new Date()) },
        ])}
      `)}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipientEmails.join(", "),
      subject: `[${ticket.code}] Status: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`,
      html,
    });
    logEmailSent("ticket_status", recipientEmails, ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_status:", error);
  }
}

export async function sendTicketCommentEmail(
  ticket: Ticket,
  comment: TicketComment,
  commenter: User,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("ticket_comment", "SMTP não configurado");
    return;
  }

  if (comment.isInternal) return;

  // Filtrar: não enviar ao próprio comentador
  const userIds: string[] = [];
  if (requester.id !== commenter.id) userIds.push(requester.id);
  if (assignee && assignee.id !== commenter.id && assignee.id !== requester.id) userIds.push(assignee.id);
  if (userIds.length === 0) return;

  const allowedIds = await filterRecipientsByPreference(userIds, "ticket_comment");
  if (allowedIds.length === 0) {
    logEmailSkipped("ticket_comment", "Todos os destinatários desabilitaram esta notificação");
    return;
  }

  const recipientEmails: string[] = [];
  if (allowedIds.includes(requester.id)) recipientEmails.push(requester.email);
  if (assignee && allowedIds.includes(assignee.id) && !recipientEmails.includes(assignee.email)) {
    recipientEmails.push(assignee.email);
  }
  if (recipientEmails.length === 0) return;

  const ticketUrl = getTicketUrl(ticket.code);
  const html = emailTemplate({
    title: "Novo Comentário no Chamado",
    subtitle: `${ticket.code} - ${ticket.title}`,
    breadcrumbParts: ["Chamados", ticket.code, "Comentário"],
    body: `
      ${actionBy(commenter.name, "adicionou um comentário", comment.createdAt)}
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:12px;">${ticket.code} — ${ticket.title}</div>
      `)}
      ${commentBox(comment.content, commenter.name)}
    `,
    ctaText: "Ver Chamado",
    ctaUrl: ticketUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipientEmails.join(", "),
      subject: `[${ticket.code}] Novo Comentário: ${ticket.title}`,
      html,
    });
    logEmailSent("ticket_comment", recipientEmails, ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar ticket_comment:", error);
  }
}

export async function sendCSATReceivedEmail(
  ticket: Ticket,
  rating: number,
  comment: string | null,
  assignee: User
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("csat", "SMTP não configurado");
    return;
  }

  if (!assignee.email || assignee.status !== "active") return;

  const ticketUrl = getTicketUrl(ticket.code || ticket.id);
  const stars = "⭐".repeat(rating);
  const emptyStars = "☆".repeat(5 - rating);

  const html = emailTemplate({
    title: "Avaliação de Chamado Recebida",
    subtitle: `${stars} ${rating}/5`,
    breadcrumbParts: ["Chamados", ticket.code, "Avaliação CSAT"],
    greeting: `Olá ${assignee.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">O chamado que você atendeu recebeu uma avaliação de satisfação:</p>
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
    await transporter.sendMail({
      from: getFromAddress(),
      to: assignee.email,
      subject: `[${ticket.code}] Avaliação Recebida - ${stars}`,
      html,
    });
    logEmailSent("csat", [assignee.email], ticket.code);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar csat:", error);
  }
}

// ============== E-MAILS DE PROJETOS (NOVO) ==============

export async function sendCardStatusChangedEmail(
  card: KanbanCard,
  project: Project,
  oldStatus: string,
  newStatus: string,
  changedBy: User,
  assignee: User | null,
  reporter: User | null
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("project_card_status", "SMTP não configurado");
    return;
  }

  const userIds: string[] = [];
  if (assignee && assignee.id !== changedBy.id) userIds.push(assignee.id);
  if (reporter && reporter.id !== changedBy.id && reporter.id !== assignee?.id) userIds.push(reporter.id);
  if (userIds.length === 0) return;

  const allowedIds = await filterRecipientsByPreference(userIds, "project_card_status");
  if (allowedIds.length === 0) {
    logEmailSkipped("project_card_status", "Todos os destinatários desabilitaram esta notificação");
    return;
  }

  const recipientEmails: string[] = [];
  if (assignee && allowedIds.includes(assignee.id)) recipientEmails.push(assignee.email);
  if (reporter && allowedIds.includes(reporter.id) && !recipientEmails.includes(reporter.email)) {
    recipientEmails.push(reporter.email);
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
          ...(assignee ? [{ label: "Responsável", value: assignee.name }] : []),
          ...(card.dueDate ? [{ label: "Prazo", value: formatDateTime(card.dueDate) }] : []),
        ])}
      `)}
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipientEmails.join(", "),
      subject: `[${project.code || "PRO"}] Card "${card.title}": ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`,
      html,
    });
    logEmailSent("project_card_status", recipientEmails, card.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar project_card_status:", error);
  }
}

export async function sendCardAssignedEmail(
  card: KanbanCard,
  project: Project,
  assignee: User,
  assignedBy: User
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("project_card_assigned", "SMTP não configurado");
    return;
  }

  if (!assignee.email || assignee.status !== "active" || assignee.id === assignedBy.id) return;

  const shouldSend = await storage.shouldSendEmail(assignee.id, "project_card_assigned");
  if (!shouldSend) {
    logEmailSkipped("project_card_assigned", "Desabilitado pelo usuário", assignee.id);
    return;
  }

  const projectUrl = getProjectUrl(card.projectId);
  const html = emailTemplate({
    title: "Card Atribuído a Você",
    subtitle: `${project.code || project.name} — ${card.title}`,
    breadcrumbParts: ["Projetos", project.code || project.name, card.title, "Atribuição"],
    greeting: `Olá ${assignee.name},`,
    body: `
      ${actionBy(assignedBy.name, "atribuiu um card a você", new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;margin-bottom:16px;">${card.title}</div>
        ${infoTable([
          { label: "Projeto", value: project.name },
          { label: "Status", value: statusBadge(card.status) },
          ...(card.priority ? [{ label: "Prioridade", value: priorityBadge(card.priority) }] : []),
          ...(card.dueDate ? [{ label: "Prazo", value: formatDateTime(card.dueDate) }] : []),
        ])}
      `)}
      ${card.description ? sectionCard(`<div style="color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">${card.description.substring(0, 300)}${card.description.length > 300 ? "..." : ""}</div>`, "Descrição") : ""}
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: assignee.email,
      subject: `[${project.code || "PRO"}] Card Atribuído: ${card.title}`,
      html,
    });
    logEmailSent("project_card_assigned", [assignee.email], card.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar project_card_assigned:", error);
  }
}

export async function sendProjectMemberAddedEmail(
  project: Project,
  member: User,
  addedBy: User
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("project_update", "SMTP não configurado");
    return;
  }

  if (!member.email || member.status !== "active" || member.id === addedBy.id) return;

  const shouldSend = await storage.shouldSendEmail(member.id, "project_update");
  if (!shouldSend) {
    logEmailSkipped("project_update", "Desabilitado pelo usuário", member.id);
    return;
  }

  const projectUrl = getProjectUrl(project.id);
  const html = emailTemplate({
    title: "Você foi adicionado a um Projeto",
    subtitle: project.name,
    breadcrumbParts: ["Projetos", project.code || project.name, "Novo membro"],
    greeting: `Olá ${member.name},`,
    body: `
      ${actionBy(addedBy.name, "adicionou você ao projeto", new Date())}
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:12px;">${project.name}</div>
        ${project.description ? `<div style="color:#64748b;font-size:13px;line-height:1.6;margin-bottom:12px;">${project.description.substring(0, 200)}</div>` : ""}
        ${infoTable([
          { label: "Código", value: project.code || "—" },
          { label: "Status", value: statusBadge(project.status) },
          ...(project.startDate ? [{ label: "Início", value: formatDateTime(project.startDate) }] : []),
          ...(project.endDate ? [{ label: "Término", value: formatDateTime(project.endDate) }] : []),
        ])}
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Agora você pode visualizar e colaborar nos cards e atividades deste projeto.</p>
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: member.email,
      subject: `Você foi adicionado ao projeto: ${project.name}`,
      html,
    });
    logEmailSent("project_member_added", [member.email], project.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar project_member_added:", error);
  }
}

export async function sendCardCommentEmail(
  card: KanbanCard,
  project: Project,
  commentContent: string,
  commenter: User,
  assignee: User | null,
  reporter: User | null
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("ticket_comment", "SMTP não configurado");
    return;
  }

  const userIds: string[] = [];
  if (assignee && assignee.id !== commenter.id) userIds.push(assignee.id);
  if (reporter && reporter.id !== commenter.id && reporter.id !== assignee?.id) userIds.push(reporter.id);
  if (userIds.length === 0) return;

  const allowedIds = await filterRecipientsByPreference(userIds, "ticket_comment");
  if (allowedIds.length === 0) return;

  const recipientEmails: string[] = [];
  if (assignee && allowedIds.includes(assignee.id)) recipientEmails.push(assignee.email);
  if (reporter && allowedIds.includes(reporter.id) && !recipientEmails.includes(reporter.email)) {
    recipientEmails.push(reporter.email);
  }
  if (recipientEmails.length === 0) return;

  const projectUrl = getProjectUrl(card.projectId);
  const html = emailTemplate({
    title: "Novo Comentário no Card",
    subtitle: `${project.code || project.name} — ${card.title}`,
    breadcrumbParts: ["Projetos", project.code || project.name, card.title, "Comentário"],
    body: `
      ${actionBy(commenter.name, "comentou no card", new Date())}
      ${sectionCard(`<div style="font-weight:700;font-size:15px;color:#1a1a2e;">${card.title}</div>`)}
      ${commentBox(commentContent, commenter.name)}
    `,
    ctaText: "Ver Projeto",
    ctaUrl: projectUrl,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipientEmails.join(", "),
      subject: `[${project.code || "PRO"}] Comentário em "${card.title}"`,
      html,
    });
    logEmailSent("card_comment", recipientEmails, card.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar card_comment:", error);
  }
}

// ============== E-MAILS DE REUNIÕES ==============

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function escapeICSParam(text: string): string {
  if (text.includes(",") || text.includes(";") || text.includes(":") || text.includes('"')) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let current = line;
  while (current.length > 75) {
    parts.push(current.substring(0, 75));
    current = " " + current.substring(75);
  }
  parts.push(current);
  return parts.join("\r\n");
}

function generateICSContent(
  meeting: {
    title: string;
    date: string;
    time: string;
    location?: string;
    description?: string;
    organizerName: string;
    organizerEmail: string;
    isRecurring?: boolean;
    recurrenceType?: string;
    recurrenceWeekdays?: number[];
    recurrenceEndDate?: string;
  },
  attendees: { name: string; email: string }[]
): string {
  const uid = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@renovhome.com.br`;
  const now = new Date();

  const [year, month, day] = meeting.date.split("-").map(Number);
  const [hour, minute] = meeting.time.split(":").map(Number);

  const SAO_PAULO_TZ = "America/Sao_Paulo";
  const localDateTime = new Date(year, month - 1, day, hour, minute, 0);
  const startUTC = fromZonedTime(localDateTime, SAO_PAULO_TZ);
  const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000);

  const formatDateUTC = (d: Date): string => {
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const dtStart = formatDateUTC(startUTC);
  const dtEnd = formatDateUTC(endUTC);

  const attendeeLines = attendees.map(
    (a) => `ATTENDEE;CN=${escapeICSParam(a.name)};RSVP=TRUE:mailto:${a.email}`
  );

  let rrule = "";
  if (meeting.isRecurring) {
    if (meeting.recurrenceType === "daily") {
      rrule = "RRULE:FREQ=DAILY";
    } else if (meeting.recurrenceType === "weekly" && meeting.recurrenceWeekdays?.length) {
      const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const dayList = meeting.recurrenceWeekdays.map((d) => days[d]).join(",");
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayList}`;
    }
    if (rrule && meeting.recurrenceEndDate) {
      const [ey, em, ed] = meeting.recurrenceEndDate.split("-").map(Number);
      const endLocalDateTime = new Date(ey, em - 1, ed, 23, 59, 59);
      const untilUTC = fromZonedTime(endLocalDateTime, SAO_PAULO_TZ);
      rrule += `;UNTIL=${formatDateUTC(untilUTC)}`;
    }
  }

  const rawLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Renov Home//Meeting Invite//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(meeting.title)}`,
    `LOCATION:${escapeICSText(meeting.location || "")}`,
    `DESCRIPTION:${escapeICSText(meeting.description || "")}`,
    `ORGANIZER;CN=${escapeICSParam(meeting.organizerName)}:mailto:${meeting.organizerEmail}`,
    ...attendeeLines,
    rrule,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line) => line.length > 0);

  return rawLines.map((line) => foldICSLine(line)).join("\r\n");
}

export async function sendMeetingInviteEmail(
  task: Task,
  organizer: User,
  participants: User[],
  externalEmails: string[]
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("meeting_invite", "SMTP não configurado");
    return;
  }

  let meetingData: { date: string; time: string; location?: string; agenda?: string };
  try {
    meetingData =
      typeof task.meetingData === "string"
        ? JSON.parse(task.meetingData)
        : (task.meetingData as unknown as typeof meetingData);
  } catch {
    logEmailSkipped("meeting_invite", "Dados de reunião inválidos");
    return;
  }

  if (!meetingData?.date || !meetingData?.time) {
    logEmailSkipped("meeting_invite", "Dados de reunião incompletos");
    return;
  }

  // Filtrar participantes por preferência
  const participantIds = participants.map((p) => p.id);
  const allowedIds = await filterRecipientsByPreference(participantIds, "meeting_invite");
  const allowedParticipants = participants.filter((p) => allowedIds.includes(p.id));

  const recipients = [
    ...allowedParticipants.map((p) => p.email),
    ...externalEmails,
  ].filter(Boolean);

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
    title: "Convite de Reunião",
    subtitle: task.title,
    breadcrumbParts: ["Reuniões", task.title],
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Você foi convidado(a) para uma reunião no Renov Home:</p>
      ${actionBy(organizer.name, "organizou esta reunião")}
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
      <p style="margin-top:16px;font-size:13px;color:#64748b;">O arquivo de calendário (.ics) está anexado a este e-mail. Você pode adicioná-lo diretamente à sua agenda.</p>
    `,
    ctaText: "Ver no Renov Home",
    ctaUrl: `${BASE_URL}/tarefas`,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipients.join(", "),
      subject: `Convite: ${task.title} - ${formattedDate}`,
      html,
      icalEvent: {
        filename: "invite.ics",
        method: "request",
        content: icsContent,
      },
    });
    logEmailSent("meeting_invite", recipients, task.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar meeting_invite:", error);
  }
}

export async function sendMeetingUpdatedEmail(
  task: Task,
  organizer: User,
  participants: User[],
  externalEmails: string[],
  changeType: "rescheduled" | "cancelled" | "updated"
): Promise<void> {
  if (!smtpConfigured()) {
    logEmailSkipped("meeting_update", "SMTP não configurado");
    return;
  }

  let meetingData: { date: string; time: string; location?: string; agenda?: string } | null =
    null;
  try {
    meetingData =
      typeof task.meetingData === "string"
        ? JSON.parse(task.meetingData)
        : (task.meetingData as unknown as typeof meetingData);
  } catch {
    meetingData = null;
  }

  const recipients = [...participants.map((p) => p.email), ...externalEmails].filter(Boolean);
  if (recipients.length === 0) return;

  const titleMap = {
    rescheduled: "Reunião Reagendada",
    cancelled: "Reunião Cancelada",
    updated: "Reunião Atualizada",
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
    breadcrumbParts: ["Reuniões", task.title, titleMap[changeType]],
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">A reunião "<strong>${task.title}</strong>" foi ${changeType === "rescheduled" ? "reagendada" : changeType === "cancelled" ? "cancelada" : "atualizada"}.</p>
      ${actionBy(organizer.name, changeType === "cancelled" ? "cancelou a reunião" : "atualizou a reunião", new Date())}
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
    ctaUrl: `${BASE_URL}/tarefas`,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipients.join(", "),
      subject: `${titleMap[changeType]}: ${task.title}`,
      html,
    });
    logEmailSent("meeting_update", recipients, task.id);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar meeting_update:", error);
  }
}

// ============== E-MAILS DE MENÇÃO E ÁREA COMPARTILHADA ==============

export async function sendMentionNotificationEmail(
  mentionedUser: User,
  mentionerName: string,
  taskTitle: string,
  taskId: string,
  commentContent: string
): Promise<void> {
  if (!mentionedUser.email || mentionedUser.status !== "active") return;

  const shouldSend = await storage.shouldSendEmail(mentionedUser.id, "mention");
  if (!shouldSend) {
    logEmailSkipped("mention", "Desabilitado pelo usuário", mentionedUser.id);
    return;
  }

  const html = emailTemplate({
    title: "Você foi mencionado",
    subtitle: taskTitle,
    breadcrumbParts: ["Menção", taskTitle],
    greeting: `Olá ${mentionedUser.name},`,
    body: `
      ${actionBy(mentionerName, "mencionou você em um comentário")}
      ${sectionCard(`<div style="font-weight:700;font-size:15px;color:#1a1a2e;">${taskTitle}</div>`)}
      ${commentBox(commentContent, mentionerName)}
    `,
    ctaText: "Ver Tarefa",
    ctaUrl: `${BASE_URL}/tarefas`,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: mentionedUser.email,
      subject: `Você foi mencionado em: ${taskTitle}`,
      html,
    });
    logEmailSent("mention", [mentionedUser.email], taskId);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar mention:", error);
  }
}

export async function sendSharedAreaInviteEmail(
  invitedUser: User,
  areaName: string,
  areaId: string,
  ownerName: string
): Promise<void> {
  if (!invitedUser.email || invitedUser.status !== "active") return;

  const html = emailTemplate({
    title: "Convite para Área Compartilhada",
    subtitle: areaName,
    greeting: `Olá ${invitedUser.name},`,
    body: `
      ${actionBy(ownerName, "adicionou você à área compartilhada")}
      ${sectionCard(`
        <div style="font-weight:700;font-size:16px;color:#1a1a2e;margin-bottom:12px;">${areaName}</div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;">Agora você pode visualizar e colaborar em tarefas e reuniões desta área.</p>
      `)}
    `,
    ctaText: "Acessar Área",
    ctaUrl: `${BASE_URL}/shared-area/${areaId}`,
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: invitedUser.email,
      subject: `Convite: Área Compartilhada "${areaName}"`,
      html,
    });
    logEmailSent("shared_area_invite", [invitedUser.email], areaId);
  } catch (error) {
    console.error("[EMAIL] Falha ao enviar shared_area_invite:", error);
  }
}
