// Configuração dos e-mails automáticos dos chamados (Configurações → E-mail).
// Fica na tabela settings, chave `email_settings`, como JSON; o que faltar vem dos padrões
// abaixo. Credenciais NÃO ficam aqui: são segredos do Worker (docs/emails-gmail-setup.md).
import { z } from "zod";

export const EMAIL_SETTINGS_KEY = "email_settings";

export const EMAIL_EVENTS = [
  "ticket_created",
  "ticket_assigned",
  "agent_reply",
  "requester_reply",
  "status_changed",
  "ticket_closed",
] as const;
export type EmailEvent = (typeof EMAIL_EVENTS)[number];

export const EMAIL_RECIPIENTS = ["solicitante", "responsavel"] as const;
export type EmailRecipient = (typeof EMAIL_RECIPIENTS)[number];

export const EMAIL_VARIABLES = [
  "codigo", "titulo", "solicitante", "responsavel", "status", "link", "comentario",
] as const;
export type EmailVariables = Partial<Record<(typeof EMAIL_VARIABLES)[number], string>>;

export interface EmailEventMeta {
  label: string;
  description: string;
  /** Título do cabeçalho do e-mail (não editável). */
  heading: string;
  cta: string;
}

export const EMAIL_EVENT_META: Record<EmailEvent, EmailEventMeta> = {
  ticket_created: {
    label: "Abertura do chamado",
    description: "Confirmação com o número do chamado.",
    heading: "Chamado recebido",
    cta: "Acompanhar chamado",
  },
  ticket_assigned: {
    label: "Atribuição",
    description: "Avisa quem passou a ser o responsável.",
    heading: "Chamado atribuído a você",
    cta: "Ver chamado",
  },
  agent_reply: {
    label: "Resposta da equipe",
    description: "Comentário público de quem atende. Notas internas nunca são enviadas.",
    heading: "Nova resposta no seu chamado",
    cta: "Responder",
  },
  requester_reply: {
    label: "Resposta do solicitante",
    description: "Comentário do solicitante no chamado.",
    heading: "O solicitante respondeu",
    cta: "Ver resposta",
  },
  status_changed: {
    label: "Mudança de status",
    description: "Qualquer mudança de status, exceto resolvido/fechado.",
    heading: "Status do chamado alterado",
    cta: "Ver chamado",
  },
  ticket_closed: {
    label: "Encerramento",
    description: "Chamado resolvido ou fechado, com o convite para avaliar o atendimento.",
    heading: "Chamado encerrado",
    cta: "Avaliar atendimento",
  },
};

export interface EmailEventSettings {
  enabled: boolean;
  recipients: EmailRecipient[];
  subject: string;
  body: string;
}

export interface EmailSettings {
  senderName: string;
  /** Vazio = o próprio remetente. */
  replyTo: string;
  events: Record<EmailEvent, EmailEventSettings>;
}

// O assunto padrão é igual para todos os eventos: o Gmail agrupa as mensagens de um mesmo
// chamado numa conversa só quando o assunto não muda.
const DEFAULT_SUBJECT = "[{{codigo}}] {{titulo}}";

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  senderName: "Chamados Pitzi",
  replyTo: "",
  events: {
    ticket_created: {
      enabled: true,
      recipients: ["solicitante"],
      subject: DEFAULT_SUBJECT,
      body: "Olá, {{solicitante}}.\n\nRecebemos o seu chamado {{codigo}} — {{titulo}}. A equipe vai analisar e você será avisado a cada atualização.\n\nGuarde o número do chamado para acompanhar o atendimento.",
    },
    ticket_assigned: {
      enabled: true,
      recipients: ["responsavel"],
      subject: DEFAULT_SUBJECT,
      body: "Olá, {{responsavel}}.\n\nO chamado {{codigo}} — {{titulo}}, aberto por {{solicitante}}, foi atribuído a você.",
    },
    agent_reply: {
      enabled: true,
      recipients: ["solicitante"],
      subject: DEFAULT_SUBJECT,
      body: "Olá, {{solicitante}}.\n\n{{responsavel}} respondeu ao seu chamado {{codigo}}:\n\n{{comentario}}",
    },
    requester_reply: {
      enabled: true,
      recipients: ["responsavel"],
      subject: DEFAULT_SUBJECT,
      body: "Olá, {{responsavel}}.\n\n{{solicitante}} respondeu no chamado {{codigo}}:\n\n{{comentario}}",
    },
    status_changed: {
      enabled: true,
      recipients: ["solicitante"],
      subject: DEFAULT_SUBJECT,
      body: "Olá, {{solicitante}}.\n\nO chamado {{codigo}} — {{titulo}} mudou para \"{{status}}\".",
    },
    ticket_closed: {
      enabled: true,
      recipients: ["solicitante"],
      subject: DEFAULT_SUBJECT,
      body: "Olá, {{solicitante}}.\n\nO chamado {{codigo}} — {{titulo}} foi encerrado ({{status}}).\n\nConte para a gente como foi o atendimento: a avaliação leva menos de um minuto.",
    },
  },
};

const eventSchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(z.enum(EMAIL_RECIPIENTS)).max(10),
  subject: z.string().trim().min(1, "Assunto obrigatório").max(200),
  body: z.string().trim().min(1, "Texto obrigatório").max(5000),
});

export const emailSettingsSchema = z.object({
  senderName: z.string().trim().min(1, "Nome do remetente obrigatório").max(80),
  replyTo: z.union([z.literal(""), z.string().trim().email("Responder para: e-mail inválido")]),
  events: z.object(Object.fromEntries(EMAIL_EVENTS.map((e) => [e, eventSchema])) as Record<EmailEvent, typeof eventSchema>),
});

/** Lê o JSON gravado e completa com os padrões (eventos novos, campos faltando, JSON inválido). */
export function parseEmailSettings(raw: string | null | undefined): EmailSettings {
  let stored: any = null;
  try {
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  const base = DEFAULT_EMAIL_SETTINGS;
  const events = {} as Record<EmailEvent, EmailEventSettings>;
  for (const event of EMAIL_EVENTS) {
    const merged = { ...base.events[event], ...(stored?.events?.[event] ?? {}) };
    const parsed = eventSchema.safeParse(merged);
    events[event] = parsed.success
      ? { ...parsed.data, recipients: Array.from(new Set(parsed.data.recipients)) }
      : base.events[event];
  }
  return {
    senderName: typeof stored?.senderName === "string" && stored.senderName.trim() ? stored.senderName.trim() : base.senderName,
    replyTo: typeof stored?.replyTo === "string" ? stored.replyTo.trim() : base.replyTo,
    events,
  };
}

export function validateEmailSettings(input: unknown):
  | { ok: true; settings: EmailSettings }
  | { ok: false; error: string } {
  const parsed = emailSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Configuração inválida" };
  const events = parsed.data.events as Record<EmailEvent, EmailEventSettings>;
  for (const event of EMAIL_EVENTS) events[event].recipients = Array.from(new Set(events[event].recipients));
  return { ok: true, settings: { senderName: parsed.data.senderName, replyTo: parsed.data.replyTo, events } };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Troca {{variavel}}; variável desconhecida ou vazia vira texto vazio. */
export function renderTemplateText(template: string, vars: EmailVariables): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, name: string) => (vars as Record<string, string | undefined>)[name] ?? "");
}

/** Versão HTML: o modelo e os valores são escapados; parágrafos por linha em branco. */
export function renderTemplateHtml(template: string, vars: EmailVariables): string {
  const escapedVars = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, escapeHtml(v ?? "")]),
  ) as EmailVariables;
  const html = renderTemplateText(escapeHtml(template), escapedVars);
  return html
    .split(/\n{2,}/)
    .map((p) => `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 14px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * Assunto final: garante o prefixo [CÓDIGO], que identifica o chamado na caixa de entrada
 * (e, na fase de respostas por e-mail, liga a resposta ao chamado).
 */
export function renderSubject(template: string, vars: EmailVariables): string {
  const subject = renderTemplateText(template, vars).replace(/[\r\n]+/g, " ").trim();
  const code = vars.codigo?.trim();
  if (!code || subject.includes(`[${code}]`)) return subject;
  return `[${code}] ${subject}`.trim();
}
