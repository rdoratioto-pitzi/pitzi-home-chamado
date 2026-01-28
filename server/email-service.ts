import nodemailer from "nodemailer";
import type { Ticket, User, TicketComment } from "@shared/schema";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : "https://home.renovsmart.com.br";

const emailStyles = `
  <style>
    body { font-family: 'Montserrat', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background-color: #00A137; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .ticket-info { background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .ticket-info h3 { margin: 0 0 8px 0; color: #333; }
    .ticket-info p { margin: 4px 0; color: #666; }
    .label { font-weight: 600; color: #333; }
    .btn { display: inline-block; background-color: #00A137; color: white; padding: 12px 24px; 
           text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #999; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-open { background: #fef3cd; color: #856404; }
    .status-in_progress { background: #cce5ff; color: #004085; }
    .status-blocked { background: #f8d7da; color: #721c24; }
    .status-resolved { background: #d4edda; color: #155724; }
    .status-closed { background: #e2e3e5; color: #383d41; }
  </style>
`;

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    open: "Aberto",
    in_progress: "Em Andamento",
    blocked: "Bloqueado",
    resolved: "Resolvido",
    closed: "Fechado",
  };
  return labels[status] || status;
};

const getPriorityLabel = (priority: string): string => {
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return labels[priority] || priority;
};

export async function sendTicketCreatedEmail(
  ticket: Ticket,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("SMTP not configured, skipping email notification");
    return;
  }

  const recipients = [requester.email];
  if (assignee && assignee.email !== requester.email) {
    recipients.push(assignee.email);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Novo Chamado Criado</h1>
        </div>
        <div class="content">
          <p>Olá,</p>
          <p>Um novo chamado foi aberto no Renov Home:</p>
          
          <div class="ticket-info">
            <h3>${ticket.code} - ${ticket.title}</h3>
            <p><span class="label">Categoria:</span> ${ticket.category}</p>
            <p><span class="label">Tipo:</span> ${ticket.type}</p>
            <p><span class="label">Local:</span> ${ticket.location}</p>
            <p><span class="label">Prioridade:</span> ${getPriorityLabel(ticket.priority)}</p>
            <p><span class="label">Solicitante:</span> ${requester.name}</p>
            ${assignee ? `<p><span class="label">Responsável:</span> ${assignee.name}</p>` : ''}
            <p><span class="label">Status:</span> <span class="status-badge status-${ticket.status}">${getStatusLabel(ticket.status)}</span></p>
          </div>
          
          <p><strong>Descrição:</strong></p>
          <p>${ticket.description}</p>
          
          <a href="${BASE_URL}/chamados" class="btn">Ver Chamado</a>
        </div>
        <div class="footer">
          <p>Renov Home - Sistema de Gestão Interna</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Renov Home" <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `[${ticket.code}] Novo Chamado: ${ticket.title}`,
      html,
    });
    console.log(`Email sent for ticket ${ticket.code} to ${recipients.join(", ")}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendTicketAssignedEmail(
  ticket: Ticket,
  assignee: User
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("SMTP not configured, skipping email notification");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Chamado Atribuído a Você</h1>
        </div>
        <div class="content">
          <p>Olá ${assignee.name},</p>
          <p>Um chamado foi atribuído a você no Renov Home:</p>
          
          <div class="ticket-info">
            <h3>${ticket.code} - ${ticket.title}</h3>
            <p><span class="label">Categoria:</span> ${ticket.category}</p>
            <p><span class="label">Tipo:</span> ${ticket.type}</p>
            <p><span class="label">Local:</span> ${ticket.location}</p>
            <p><span class="label">Prioridade:</span> ${getPriorityLabel(ticket.priority)}</p>
            <p><span class="label">Status:</span> <span class="status-badge status-${ticket.status}">${getStatusLabel(ticket.status)}</span></p>
          </div>
          
          <p><strong>Descrição:</strong></p>
          <p>${ticket.description}</p>
          
          <a href="${BASE_URL}/chamados" class="btn">Ver Chamado</a>
        </div>
        <div class="footer">
          <p>Renov Home - Sistema de Gestão Interna</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Renov Home" <${process.env.SMTP_USER}>`,
      to: assignee.email,
      subject: `[${ticket.code}] Chamado Atribuído: ${ticket.title}`,
      html,
    });
    console.log(`Assignment email sent for ticket ${ticket.code} to ${assignee.email}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendTicketStatusChangedEmail(
  ticket: Ticket,
  oldStatus: string,
  newStatus: string,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("SMTP not configured, skipping email notification");
    return;
  }

  const recipients = [requester.email];
  if (assignee && assignee.email !== requester.email) {
    recipients.push(assignee.email);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Status do Chamado Alterado</h1>
        </div>
        <div class="content">
          <p>Olá,</p>
          <p>O status do chamado foi atualizado:</p>
          
          <div class="ticket-info">
            <h3>${ticket.code} - ${ticket.title}</h3>
            <p>
              <span class="status-badge status-${oldStatus}">${getStatusLabel(oldStatus)}</span>
              →
              <span class="status-badge status-${newStatus}">${getStatusLabel(newStatus)}</span>
            </p>
          </div>
          
          <a href="${BASE_URL}/chamados" class="btn">Ver Chamado</a>
        </div>
        <div class="footer">
          <p>Renov Home - Sistema de Gestão Interna</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Renov Home" <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `[${ticket.code}] Status Alterado: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`,
      html,
    });
    console.log(`Status change email sent for ticket ${ticket.code}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendTicketCommentEmail(
  ticket: Ticket,
  comment: TicketComment,
  commenter: User,
  requester: User,
  assignee: User | null
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("SMTP not configured, skipping email notification");
    return;
  }

  if (comment.isInternal) {
    return;
  }

  const recipients = new Set<string>();
  if (requester.email !== commenter.email) {
    recipients.add(requester.email);
  }
  if (assignee && assignee.email !== commenter.email) {
    recipients.add(assignee.email);
  }

  if (recipients.size === 0) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Novo Comentário no Chamado</h1>
        </div>
        <div class="content">
          <p>Olá,</p>
          <p>${commenter.name} adicionou um comentário ao chamado:</p>
          
          <div class="ticket-info">
            <h3>${ticket.code} - ${ticket.title}</h3>
          </div>
          
          <div style="background: #f0f0f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${comment.content}</p>
          </div>
          
          <a href="${BASE_URL}/chamados" class="btn">Ver Chamado</a>
        </div>
        <div class="footer">
          <p>Renov Home - Sistema de Gestão Interna</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Renov Home" <${process.env.SMTP_USER}>`,
      to: Array.from(recipients).join(", "),
      subject: `[${ticket.code}] Novo Comentário: ${ticket.title}`,
      html,
    });
    console.log(`Comment email sent for ticket ${ticket.code}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
