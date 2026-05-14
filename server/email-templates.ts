/**
 * Sistema de Templates de E-mail — Pitzi Home
 *
 * Template base reutilizável com identidade visual Renov,
 * usado por todas as funções de envio de e-mail do sistema.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

// ============== CORES DA MARCA ==============
const BRAND = {
  green: "#00A137",
  greenDark: "#008A2E",
  greenLight: "#E8F5E9",
  dark: "#1a1a2e",
  gray: "#64748b",
  grayLight: "#f1f5f9",
  grayBorder: "#e2e8f0",
  white: "#ffffff",
  text: "#334155",
  textLight: "#94a3b8",
};

// ============== STATUS COLORS ==============
const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  // Chamados
  open: { bg: "#fef3cd", color: "#856404", label: "Aberto" },
  in_progress: { bg: "#cce5ff", color: "#004085", label: "Em Andamento" },
  blocked: { bg: "#f8d7da", color: "#721c24", label: "Bloqueado" },
  resolved: { bg: "#d4edda", color: "#155724", label: "Resolvido" },
  closed: { bg: "#e2e3e5", color: "#383d41", label: "Fechado" },
  pending: { bg: "#fff3cd", color: "#856404", label: "Pendente" },
  // Projetos/Cards
  todo: { bg: "#e2e8f0", color: "#475569", label: "A Fazer" },
  doing: { bg: "#dbeafe", color: "#1e40af", label: "Em Progresso" },
  done: { bg: "#dcfce7", color: "#166534", label: "Concluído" },
  active: { bg: "#d4edda", color: "#155724", label: "Ativo" },
};

const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  low: { bg: "#e2e8f0", color: "#475569", label: "Baixa" },
  medium: { bg: "#fef3cd", color: "#856404", label: "Média" },
  high: { bg: "#fed7aa", color: "#c2410c", label: "Alta" },
  critical: { bg: "#fecaca", color: "#dc2626", label: "Crítica" },
};

// ============== HELPERS ==============

export function getStatusLabel(status: string): string {
  return STATUS_STYLES[status]?.label || status;
}

export function getPriorityLabel(priority: string): string {
  return PRIORITY_STYLES[priority]?.label || priority;
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const zonedDate = toZonedTime(d, TIMEZONE);
  return format(zonedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const zonedDate = toZonedTime(d, TIMEZONE);
  return format(zonedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://rdoratioto-pitzi.github.io/pitzi-home-chamado";
}

export function getTicketUrl(ticketCode: string): string {
  return `${getBaseUrl()}/chamados?id=${ticketCode}`;
}

export function getProjectUrl(projectId: string): string {
  return `${getBaseUrl()}/projetos/${projectId}`;
}

export function getSettingsUrl(): string {
  return `${getBaseUrl()}/configuracoes`;
}

function getUserInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ============== COMPONENTES REUTILIZÁVEIS ==============

export function statusBadge(status: string): string {
  const style = STATUS_STYLES[status] || { bg: "#e2e8f0", color: "#475569", label: status };
  return `<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:${style.bg};color:${style.color};letter-spacing:0.3px;">${style.label}</span>`;
}

export function priorityBadge(priority: string): string {
  const style = PRIORITY_STYLES[priority] || { bg: "#e2e8f0", color: "#475569", label: priority };
  return `<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:${style.bg};color:${style.color};letter-spacing:0.3px;">${style.label}</span>`;
}

export function statusTransition(oldStatus: string, newStatus: string): string {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin:16px 0;">
      ${statusBadge(oldStatus)}
      <span style="font-size:20px;color:${BRAND.gray};">&#8594;</span>
      ${statusBadge(newStatus)}
    </div>
  `;
}

export function userAvatar(name: string): string {
  const initials = getUserInitials(name);
  return `
    <div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${BRAND.green};color:white;font-size:14px;font-weight:700;letter-spacing:0.5px;">${initials}</div>
  `;
}

export function actionBy(userName: string, action: string, dateTime?: Date | string | null): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td style="vertical-align:middle;padding-right:12px;">
          ${userAvatar(userName)}
        </td>
        <td style="vertical-align:middle;">
          <span style="font-weight:600;color:${BRAND.text};font-size:14px;">${userName}</span>
          <span style="color:${BRAND.gray};font-size:14px;"> ${action}</span>
          ${dateTime ? `<br><span style="color:${BRAND.textLight};font-size:12px;">${formatDateTime(dateTime)}</span>` : ""}
        </td>
      </tr>
    </table>
  `;
}

export function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 16px 8px 0;color:${BRAND.gray};font-size:13px;font-weight:500;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:${BRAND.text};font-size:13px;">${value}</td>
    </tr>
  `;
}

export function infoTable(rows: Array<{ label: string; value: string }>): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0;">
      ${rows.map((r) => infoRow(r.label, r.value)).join("")}
    </table>
  `;
}

export function ctaButton(text: string, url: string): string {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.green};color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(0,161,55,0.3);">
        ${text}
      </a>
    </div>
  `;
}

export function sectionCard(content: string, title?: string): string {
  return `
    <div style="background:${BRAND.grayLight};border:1px solid ${BRAND.grayBorder};border-radius:10px;padding:20px;margin:16px 0;">
      ${title ? `<div style="font-weight:600;color:${BRAND.text};font-size:14px;margin-bottom:12px;">${title}</div>` : ""}
      ${content}
    </div>
  `;
}

export function commentBox(content: string, authorName?: string): string {
  const preview = content.length > 300 ? content.substring(0, 300) + "..." : content;
  return `
    <div style="background:white;border-left:4px solid ${BRAND.green};border-radius:0 8px 8px 0;padding:16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      ${authorName ? `<div style="font-weight:600;color:${BRAND.text};font-size:13px;margin-bottom:8px;">${authorName}</div>` : ""}
      <div style="color:${BRAND.gray};font-size:13px;line-height:1.6;">${preview}</div>
    </div>
  `;
}

export function breadcrumb(parts: string[]): string {
  return `
    <div style="font-size:11px;color:${BRAND.textLight};margin-bottom:8px;letter-spacing:0.3px;text-transform:uppercase;">
      ${parts.join(` <span style="margin:0 4px;">&#8250;</span> `)}
    </div>
  `;
}

// ============== TEMPLATE BASE ==============

interface EmailTemplateOptions {
  /** Título principal no header (ex: "Novo Chamado Criado") */
  title: string;
  /** Subtítulo opcional no header */
  subtitle?: string;
  /** Breadcrumb (ex: ["Chamados", "CHA-0042", "Status alterado"]) */
  breadcrumbParts?: string[];
  /** Saudação (ex: "Olá João,") — se omitido, usa "Olá," */
  greeting?: string;
  /** Conteúdo principal do e-mail (HTML) */
  body: string;
  /** Texto/URL do botão CTA principal */
  ctaText?: string;
  ctaUrl?: string;
  /** Mensagem após o CTA */
  postCta?: string;
  /** Rodapé customizado (substitui o padrão) */
  customFooter?: string;
}

export function emailTemplate(options: EmailTemplateOptions): string {
  const {
    title,
    subtitle,
    breadcrumbParts,
    greeting = "Olá,",
    body,
    ctaText,
    ctaUrl,
    postCta,
  } = options;

  const settingsUrl = getSettingsUrl();

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Montserrat',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenDark} 100%);padding:32px 40px;text-align:center;">
              <!-- Logo / Brand Name -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 20px;margin-bottom:16px;">
                      <span style="color:white;font-size:20px;font-weight:700;letter-spacing:1px;">RENOV</span>
                      <span style="color:rgba(255,255,255,0.8);font-size:20px;font-weight:400;letter-spacing:1px;"> HOME</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="color:white;margin:0;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
                    ${subtitle ? `<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;font-weight:400;">${subtitle}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${breadcrumbParts ? breadcrumb(breadcrumbParts) : ""}
              <p style="color:${BRAND.text};font-size:15px;margin:0 0 20px;line-height:1.6;">${greeting}</p>
              ${body}
              ${ctaText && ctaUrl ? ctaButton(ctaText, ctaUrl) : ""}
              ${postCta ? `<p style="margin-top:8px;font-size:12px;color:${BRAND.textLight};text-align:center;">${postCta}</p>` : ""}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid ${BRAND.grayBorder};"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <p style="color:${BRAND.textLight};font-size:12px;margin:0 0 8px;line-height:1.5;">
                      <strong style="color:${BRAND.gray};">Pitzi Home</strong> — Sistema de Gest\u00e3o Interna
                    </p>
                    <p style="color:${BRAND.textLight};font-size:11px;margin:0 0 12px;line-height:1.5;">
                      Este \u00e9 um e-mail autom\u00e1tico. N\u00e3o responda diretamente.
                    </p>
                    <p style="margin:0;">
                      <a href="${settingsUrl}" style="color:${BRAND.green};font-size:11px;text-decoration:none;font-weight:500;">
                        Gerenciar prefer\u00eancias de notifica\u00e7\u00e3o
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End Container -->
      </td>
    </tr>
  </table>
  <!-- End Wrapper -->
</body>
</html>`;
}
