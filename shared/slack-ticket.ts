// Slack → chamado (fase 1): assinatura das requisições do Slack, janela (modal) de abertura
// e leitura do que a pessoa enviou. Funções puras, usadas pelo Worker (worker/src/routes/slack.ts).

import { TICKET_TYPES } from "./ticket-options";
import { IMPACT_OPTIONS } from "./automations";

export const SLACK_MODAL_CALLBACK_ID = "chamado_slack_modal";
export const SLACK_SHORTCUT_CALLBACK_ID = "transformar_em_chamado";
/** O Slack recusa requisições assinadas há mais de 5 minutos (proteção contra repetição). */
export const SLACK_SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

// ─── Assinatura ───────────────────────────────────────────────────────────────

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Confere `X-Slack-Signature` = "v0=" + HMAC-SHA256(secret, "v0:{timestamp}:{corpo bruto}").
 * O corpo precisa ser exatamente o que chegou (sem reparse).
 */
export async function verifySlackSignature(input: {
  signingSecret: string | undefined;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  rawBody: string;
  nowSeconds?: number;
}): Promise<boolean> {
  const { signingSecret, timestamp, signature, rawBody } = input;
  if (!signingSecret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SLACK_SIGNATURE_MAX_AGE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${rawBody}`));
  return constantTimeEqual(`v0=${toHex(mac)}`, signature);
}

// ─── Texto ────────────────────────────────────────────────────────────────────

/** Converte o mrkdwn do Slack em texto simples: <url|rótulo> → rótulo (url), <@U1> some. */
export function slackTextToPlain(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/<mailto:([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<[@#!][^>]*\|([^>]+)>/g, "$1")
    .replace(/<[@#!][^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .trim();
}

/** Primeira linha não vazia, cortada em `max` caracteres (título sugerido). */
export function firstLine(text: string, max = 80): string {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function normalizedText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Título curto e determinístico para o fluxo rápido do Slack. */
export function generateSlackTicketTitle(text: string): string {
  const normalized = normalizedText(text);
  if (/\bvpn\b/.test(normalized) && /(conect|acess|entra|login)/.test(normalized)) {
    return "Problema de acesso à VPN";
  }
  if (/\bnotebook\b/.test(normalized) && /(nao liga|nao inicia)/.test(normalized)) {
    return "Notebook não liga";
  }
  if (/(google drive|\bdrive\b)/.test(normalized) && /(acess|entra|abr|consigo)/.test(normalized)) {
    return "Problema de acesso ao Google Drive";
  }
  return firstLine(text, 90) || "Problema relatado via Slack";
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Texto simples → HTML de parágrafos, no formato das descrições feitas pelo sistema. */
export function plainTextToHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

// ─── Janela (modal) ───────────────────────────────────────────────────────────

/** O que a janela leva escondido até o envio (private_metadata, limite de 3000 caracteres). */
export interface SlackModalMetadata {
  mode: "command" | "shortcut";
  teamId?: string | null;
  /** Quem abriu a janela (quem digitou o comando ou clicou no atalho). */
  clickerSlackId: string;
  /** Quem vai ser o solicitante: no comando é quem digitou; no atalho, o autor da mensagem. */
  requesterSlackId: string;
  channelId?: string | null;
  messageTs?: string | null;
  threadTs?: string | null;
  /** Atalho: nome do canal e link da raiz, para montar a conversa no envio. */
  channelName?: string | null;
  permalink?: string | null;
  /** Atalho: true quando o app conseguiu ler a conversa (vai a thread inteira no envio). */
  conversation?: boolean;
}

export interface SlackModalOptions {
  metadata: SlackModalMetadata;
  title: string;
  description: string;
  groups: readonly { key: string; name: string }[];
  /** Gravidade só aparece para técnicos e admins; quem abre como Usuário fica com "Médio". */
  showImpact: boolean;
  /** Texto de contexto no topo (ex.: "Mensagem de Fulana em #canal"). */
  context?: string;
}

export const DEFAULT_SLACK_IMPACT = "medio";

const plain = (text: string) => ({ type: "plain_text" as const, text, emoji: true });
const option = (value: string, text: string) => ({ text: plain(text.slice(0, 75)), value });

export function buildTicketModal(options: SlackModalOptions) {
  const blocks: unknown[] = [];
  if (options.context) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: options.context.slice(0, 2900) }] });
  }
  blocks.push(
    {
      type: "input", block_id: "titulo", label: plain("Título"),
      element: {
        type: "plain_text_input", action_id: "valor", max_length: 150,
        ...(options.title ? { initial_value: options.title.slice(0, 150) } : {}),
      },
    },
    {
      type: "input", block_id: "descricao", label: plain("Descrição"),
      element: {
        type: "plain_text_input", action_id: "valor", multiline: true, max_length: 3000,
        ...(options.description ? { initial_value: options.description.slice(0, 3000) } : {}),
      },
    },
    {
      type: "input", block_id: "grupo", label: plain("Grupo de atendimento"),
      element: {
        type: "static_select", action_id: "valor", placeholder: plain("Escolha o grupo"),
        options: options.groups.slice(0, 100).map((g) => option(g.key, g.name)),
      },
    },
    {
      type: "input", block_id: "tipo", label: plain("Tipo"),
      element: {
        type: "static_select", action_id: "valor",
        initial_option: option(TICKET_TYPES[0].value, TICKET_TYPES[0].label),
        options: TICKET_TYPES.map((t) => option(t.value, t.label)),
      },
    },
  );
  if (options.showImpact) {
    const medio = IMPACT_OPTIONS.find((i) => i.value === DEFAULT_SLACK_IMPACT) ?? IMPACT_OPTIONS[0];
    blocks.push({
      type: "input", block_id: "gravidade", label: plain("Gravidade"),
      element: {
        type: "static_select", action_id: "valor",
        initial_option: option(medio.value, medio.label),
        options: IMPACT_OPTIONS.map((i) => option(i.value, i.label)),
      },
    });
  }
  return {
    type: "modal",
    callback_id: SLACK_MODAL_CALLBACK_ID,
    private_metadata: JSON.stringify(options.metadata),
    title: plain("Abrir chamado"),
    submit: plain("Abrir chamado"),
    close: plain("Cancelar"),
    blocks,
  };
}

export interface SlackModalSubmission {
  title: string;
  description: string;
  category: string;
  type: string;
  impact: string | null;
}

/** Lê os valores da janela enviada (view.state.values). */
export function parseTicketModal(view: { state?: { values?: Record<string, Record<string, any>> } }): SlackModalSubmission {
  const values = view.state?.values ?? {};
  const text = (block: string) => String(values[block]?.valor?.value ?? "").trim();
  const selected = (block: string) => values[block]?.valor?.selected_option?.value ?? null;
  return {
    title: text("titulo"),
    description: text("descricao"),
    category: selected("grupo") ?? "",
    type: selected("tipo") ?? TICKET_TYPES[0].value,
    impact: selected("gravidade"),
  };
}

export function parseModalMetadata(raw: string | null | undefined): SlackModalMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.mode === "command" || parsed.mode === "shortcut") && parsed.clickerSlackId && parsed.requesterSlackId) {
      return parsed as SlackModalMetadata;
    }
  } catch {
    // inválido
  }
  return null;
}

// ─── Conversa inteira (thread) ────────────────────────────────────────────────

export interface SlackFile {
  id?: string;
  name?: string;
  title?: string;
  mimetype?: string;
  size?: number;
  url_private_download?: string;
  url_private?: string;
}

export interface SlackThreadMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  username?: string;
  bot_profile?: { name?: string };
  subtype?: string;
  text?: string;
  files?: SlackFile[];
  reply_count?: number;
}

/** Até quantos caracteres a conversa entra na descrição do chamado. */
export const SLACK_CONVERSATION_MAX_CHARS = 30_000;
export const SLACK_MAX_FILES = 10;
export const SLACK_MAX_FILE_BYTES = 10 * 1024 * 1024;
const SLACK_IMPORTABLE_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain|text\/csv|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/(msword|vnd\.ms-excel))$/i;

/** Mensagens que não são da conversa (entrou no canal, saiu etc.). */
const SYSTEM_SUBTYPES = new Set(["channel_join", "channel_leave", "group_join", "group_leave", "channel_topic", "channel_purpose", "channel_name"]);

/**
 * mrkdwn do Slack → texto simples, com nomes: <@U1> → @Nome, <#C1|geral> → #geral,
 * <url|rótulo> → rótulo (url), <!here> → @here; decodifica &amp; &lt; &gt;.
 */
export function slackMrkdwnToText(text: string | null | undefined, names: ReadonlyMap<string, string> = new Map()): string {
  if (!text) return "";
  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|([^>]+))?>/g, (_m, id: string, label?: string) => `@${names.get(id) ?? label ?? "usuário"}`)
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, (_m, name: string) => `#${name || "canal"}`)
    .replace(/<#[A-Z0-9]+>/g, "#canal")
    .replace(/<!(here|channel|everyone)(?:\|[^>]*)?>/g, "@$1")
    .replace(/<!subteam\^[A-Z0-9]+(?:\|([^>]+))?>/g, (_m, label?: string) => label ?? "@grupo")
    .replace(/<!date\^[^|>]*\|([^>]+)>/g, "$1")
    .replace(/<mailto:([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .trim();
}

/** "dd/mm HH:mm" no horário de Brasília (UTC-3 fixo desde 2019). */
export function formatSlackTs(ts: string): string {
  const ms = Math.floor(Number(ts) * 1000);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms - 3 * 60 * 60 * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** IDs de usuários citados como autores ou menções, para buscar os nomes. */
export function slackUserIdsIn(messages: readonly SlackThreadMessage[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.user) ids.add(m.user);
    for (const match of (m.text ?? "").matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g)) ids.add(match[1]);
  }
  return [...ids];
}

export function conversationMessages(messages: readonly SlackThreadMessage[]): SlackThreadMessage[] {
  return messages.filter((m) => !m.subtype || !SYSTEM_SUBTYPES.has(m.subtype));
}

function authorName(m: SlackThreadMessage, names: ReadonlyMap<string, string>): string {
  if (m.user) return names.get(m.user) ?? "Usuário do Slack";
  return m.bot_profile?.name || m.username || "App";
}

/**
 * Conversa em HTML (parágrafos, como as descrições do sistema): cabeçalho com canal, número de
 * mensagens e link, depois "<strong>Nome</strong> (dd/mm HH:mm): texto" na ordem. Corta em
 * `maxChars` avisando quantas mensagens ficaram de fora.
 */
export function buildConversationHtml(input: {
  channelName?: string | null;
  permalink?: string | null;
  messages: readonly SlackThreadMessage[];
  names: ReadonlyMap<string, string>;
  maxChars?: number;
}): string {
  const maxChars = input.maxChars ?? SLACK_CONVERSATION_MAX_CHARS;
  const messages = conversationMessages(input.messages);
  const where = input.channelName ? `#${input.channelName}, ` : "";
  const count = `${messages.length} ${messages.length === 1 ? "mensagem" : "mensagens"}`;
  const parts: string[] = [`<p><strong>Conversa no Slack</strong> (${escapeHtml(where)}${count})</p>`];
  if (input.permalink) {
    const safe = escapeHtml(input.permalink);
    parts.push(`<p>Link da conversa: <a href="${safe}">${safe}</a></p>`);
  }
  let size = parts.join("").length;
  let included = 0;
  for (const m of messages) {
    const files = (m.files ?? []).map((f) => f.name || f.title).filter(Boolean);
    const body = [slackMrkdwnToText(m.text, input.names), files.length ? `[anexo: ${files.join(", ")}]` : ""]
      .filter(Boolean).join("\n");
    const html = `<p><strong>${escapeHtml(authorName(m, input.names))}</strong> (${formatSlackTs(m.ts)}): ${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
    if (size + html.length > maxChars) break;
    parts.push(html);
    size += html.length;
    included++;
  }
  const left = messages.length - included;
  if (left > 0) {
    parts.push(`<p><em>Conversa cortada: ${left} ${left === 1 ? "mensagem não coube" : "mensagens não couberam"} aqui. Veja a conversa completa no link acima.</em></p>`);
  }
  return parts.join("");
}

/** Anexos da conversa que podem ir para o chamado (tipos aceitos, até 10 de até 10 MB). */
export function selectSlackFiles(messages: readonly SlackThreadMessage[]): { importable: SlackFile[]; skipped: string[] } {
  const importable: SlackFile[] = [];
  const skipped: string[] = [];
  for (const m of conversationMessages(messages)) {
    for (const f of m.files ?? []) {
      const name = f.name || f.title || "arquivo";
      const url = f.url_private_download || f.url_private;
      if (!url || !f.mimetype || !SLACK_IMPORTABLE_TYPES.test(f.mimetype) || (f.size ?? 0) > SLACK_MAX_FILE_BYTES || importable.length >= SLACK_MAX_FILES) {
        skipped.push(name);
        continue;
      }
      importable.push(f);
    }
  }
  return { importable, skipped };
}

/** Explica, para quem clicou, o que falta para o app ler a conversa. */
export function slackAccessHint(error: string | undefined): string {
  if (error === "not_in_channel" || error === "channel_not_found") {
    return "O app não está neste canal: convide com `/invite @Chamados Pitzi` para levar a conversa inteira.";
  }
  if (error === "missing_scope") {
    return "O app ainda não tem permissão para ler conversas (channels:history, groups:history, im:history, mpim:history). Peça ao admin do Slack para atualizar o manifesto e reinstalar o app.";
  }
  return `Não consegui ler a conversa (${error ?? "erro"}).`;
}
