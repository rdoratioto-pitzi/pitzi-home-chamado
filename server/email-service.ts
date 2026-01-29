import nodemailer from "nodemailer";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { Ticket, User, TicketComment, Task } from "@shared/schema";

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

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function escapeICSParam(text: string): string {
  if (text.includes(',') || text.includes(';') || text.includes(':') || text.includes('"')) {
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
    current = ' ' + current.substring(75);
  }
  parts.push(current);
  return parts.join('\r\n');
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
  
  const [year, month, day] = meeting.date.split('-').map(Number);
  const [hour, minute] = meeting.time.split(':').map(Number);
  
  const SAO_PAULO_TZ = 'America/Sao_Paulo';
  
  // Create a date representing the intended local time in São Paulo
  // Then convert to UTC using timezone-aware library
  const localDateTime = new Date(year, month - 1, day, hour, minute, 0);
  const startUTC = fromZonedTime(localDateTime, SAO_PAULO_TZ);
  const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000);
  
  const formatDateUTC = (d: Date): string => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const dtStart = formatDateUTC(startUTC);
  const dtEnd = formatDateUTC(endUTC);
  
  const attendeeLines = attendees
    .map(a => `ATTENDEE;CN=${escapeICSParam(a.name)};RSVP=TRUE:mailto:${a.email}`);

  let rrule = '';
  if (meeting.isRecurring) {
    if (meeting.recurrenceType === 'daily') {
      rrule = 'RRULE:FREQ=DAILY';
    } else if (meeting.recurrenceType === 'weekly' && meeting.recurrenceWeekdays && meeting.recurrenceWeekdays.length > 0) {
      const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const dayList = meeting.recurrenceWeekdays.map(d => days[d]).join(',');
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayList}`;
    }
    if (rrule && meeting.recurrenceEndDate) {
      const [ey, em, ed] = meeting.recurrenceEndDate.split('-').map(Number);
      // Convert end of day in São Paulo to UTC
      const endLocalDateTime = new Date(ey, em - 1, ed, 23, 59, 59);
      const untilUTC = fromZonedTime(endLocalDateTime, SAO_PAULO_TZ);
      rrule += `;UNTIL=${formatDateUTC(untilUTC)}`;
    }
  }

  const rawLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Renov Home//Meeting Invite//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(meeting.title)}`,
    `LOCATION:${escapeICSText(meeting.location || '')}`,
    `DESCRIPTION:${escapeICSText(meeting.description || '')}`,
    `ORGANIZER;CN=${escapeICSParam(meeting.organizerName)}:mailto:${meeting.organizerEmail}`,
    ...attendeeLines,
    rrule,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(line => line.length > 0);

  return rawLines.map(line => foldICSLine(line)).join('\r\n');
}

export async function sendMeetingInviteEmail(
  task: Task,
  organizer: User,
  participants: User[],
  externalEmails: string[]
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("SMTP not configured, skipping meeting invite email");
    return;
  }

  let meetingData: {
    date: string;
    time: string;
    location?: string;
    agenda?: string;
  };

  try {
    meetingData = typeof task.meetingData === 'string' 
      ? JSON.parse(task.meetingData)
      : task.meetingData as unknown as typeof meetingData;
  } catch {
    console.log("Failed to parse meeting data, skipping invite");
    return;
  }

  if (!meetingData?.date || !meetingData?.time) {
    console.log("Meeting data incomplete, skipping invite");
    return;
  }

  const recipients = [
    ...participants.map(p => p.email),
    ...externalEmails
  ].filter(Boolean);

  if (recipients.length === 0) return;

  const attendees = [
    ...participants.map(p => ({ name: p.name, email: p.email })),
    ...externalEmails.map(e => ({ name: e, email: e }))
  ];

  let recurrenceWeekdays: number[] = [];
  try {
    recurrenceWeekdays = typeof task.recurrenceWeekdays === 'string'
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
      description: typeof meetingData.agenda === 'string' ? meetingData.agenda : '',
      organizerName: organizer.name,
      organizerEmail: organizer.email,
      isRecurring: task.isRecurring || false,
      recurrenceType: task.recurrenceType || undefined,
      recurrenceWeekdays,
      recurrenceEndDate: task.recurrenceEndDate || undefined
    },
    attendees
  );

  const formattedDate = new Date(`${meetingData.date}T${meetingData.time}`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Convite de Reunião</h1>
        </div>
        <div class="content">
          <p>Olá,</p>
          <p>Você foi convidado(a) para uma reunião no Renov Home:</p>
          
          <div class="ticket-info">
            <h3>${task.title}</h3>
            <p><span class="label">Data e Hora:</span> ${formattedDate}</p>
            ${meetingData.location ? `<p><span class="label">Local:</span> ${meetingData.location}</p>` : ''}
            <p><span class="label">Organizador:</span> ${organizer.name}</p>
            <p><span class="label">Participantes:</span> ${attendees.map(a => a.name).join(', ')}</p>
          </div>
          
          ${meetingData.agenda ? `
            <p><strong>Pauta:</strong></p>
            <div style="background: #f0f0f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; white-space: pre-wrap;">${meetingData.agenda}</p>
            </div>
          ` : ''}
          
          <a href="${BASE_URL}/tarefas" class="btn">Ver no Renov Home</a>
          
          <p style="margin-top: 24px; font-size: 14px; color: #666;">
            O arquivo de calendário (.ics) está anexado a este email. Você pode adicionar diretamente à sua agenda.
          </p>
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
      subject: `Convite: ${task.title} - ${formattedDate}`,
      html,
      icalEvent: {
        filename: 'invite.ics',
        method: 'request',
        content: icsContent
      }
    });
    console.log(`Meeting invite sent for "${task.title}" to ${recipients.join(", ")}`);
  } catch (error) {
    console.error("Failed to send meeting invite:", error);
  }
}

export async function sendMeetingUpdatedEmail(
  task: Task,
  organizer: User,
  participants: User[],
  externalEmails: string[],
  changeType: 'rescheduled' | 'cancelled' | 'updated'
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("SMTP not configured, skipping meeting update email");
    return;
  }

  let meetingData: {
    date: string;
    time: string;
    location?: string;
    agenda?: string;
  } | null = null;

  try {
    meetingData = typeof task.meetingData === 'string' 
      ? JSON.parse(task.meetingData)
      : task.meetingData as unknown as typeof meetingData;
  } catch {
    meetingData = null;
  }

  const recipients = [
    ...participants.map(p => p.email),
    ...externalEmails
  ].filter(Boolean);

  if (recipients.length === 0) return;

  const titleMap = {
    rescheduled: 'Reunião Reagendada',
    cancelled: 'Reunião Cancelada',
    updated: 'Reunião Atualizada'
  };

  const formattedDate = meetingData?.date && meetingData?.time 
    ? new Date(`${meetingData.date}T${meetingData.time}`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Data a definir';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header" style="${changeType === 'cancelled' ? 'background-color: #dc3545;' : ''}">
          <h1>${titleMap[changeType]}</h1>
        </div>
        <div class="content">
          <p>Olá,</p>
          <p>A reunião "${task.title}" foi ${changeType === 'rescheduled' ? 'reagendada' : changeType === 'cancelled' ? 'cancelada' : 'atualizada'}.</p>
          
          <div class="ticket-info">
            <h3>${task.title}</h3>
            <p><span class="label">Data e Hora:</span> ${formattedDate}</p>
            ${meetingData?.location ? `<p><span class="label">Local:</span> ${meetingData.location}</p>` : ''}
            <p><span class="label">Organizador:</span> ${organizer.name}</p>
          </div>
          
          <a href="${BASE_URL}/tarefas" class="btn">Ver no Renov Home</a>
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
      subject: `${titleMap[changeType]}: ${task.title}`,
      html
    });
    console.log(`Meeting ${changeType} email sent for "${task.title}"`);
  } catch (error) {
    console.error("Failed to send meeting update email:", error);
  }
}

// Send email when user is mentioned in a comment
export async function sendMentionNotificationEmail(
  mentionedUser: User,
  mentionerName: string,
  taskTitle: string,
  taskId: string,
  commentContent: string
): Promise<void> {
  if (!mentionedUser.email) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Renov Home</h1>
        </div>
        <div class="content">
          <h2>Você foi mencionado em um comentário</h2>
          <p>Olá ${mentionedUser.name},</p>
          <p><strong>${mentionerName}</strong> mencionou você em um comentário na tarefa:</p>
          
          <div class="ticket-info">
            <h3>${taskTitle}</h3>
            <p style="margin-top: 12px; padding: 12px; background: white; border-radius: 4px; font-style: italic;">
              "${commentContent.slice(0, 200)}${commentContent.length > 200 ? '...' : ''}"
            </p>
          </div>
          
          <a href="${BASE_URL}/tarefas/${taskId}" class="btn">Ver Tarefa</a>
        </div>
        <div class="footer">
          <p>Renov Smart - Inovação em Gestão</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Renov Home" <noreply@renovsmart.com.br>',
      to: mentionedUser.email,
      subject: `Você foi mencionado em: ${taskTitle}`,
      html
    });
    console.log(`Mention notification email sent to ${mentionedUser.email}`);
  } catch (error) {
    console.error("Failed to send mention notification email:", error);
  }
}

// Send email when user is added to a shared area
export async function sendSharedAreaInviteEmail(
  invitedUser: User,
  areaName: string,
  areaId: string,
  ownerName: string
): Promise<void> {
  if (!invitedUser.email) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Renov Home</h1>
        </div>
        <div class="content">
          <h2>Convite para Área Compartilhada</h2>
          <p>Olá ${invitedUser.name},</p>
          <p>Você foi adicionado(a) à área compartilhada <strong>"${areaName}"</strong> por <strong>${ownerName}</strong>.</p>
          
          <div class="ticket-info">
            <h3>${areaName}</h3>
            <p>Agora você pode visualizar e colaborar em tarefas e reuniões desta área.</p>
          </div>
          
          <a href="${BASE_URL}/tarefas" class="btn">Acessar Área</a>
        </div>
        <div class="footer">
          <p>Renov Smart - Inovação em Gestão</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Renov Home" <noreply@renovsmart.com.br>',
      to: invitedUser.email,
      subject: `Convite: Área Compartilhada "${areaName}"`,
      html
    });
    console.log(`Shared area invite email sent to ${invitedUser.email}`);
  } catch (error) {
    console.error("Failed to send shared area invite email:", error);
  }
}
