// Montagem de mensagens de e-mail (RFC 5322 / MIME) para envio pela API do Gmail.
// Puro (sem dependências de runtime): roda no Worker, no Express e nos testes.

export interface MailAddress {
  name?: string | null;
  email: string;
}

export interface MimeMessageInput {
  from: MailAddress;
  to: MailAddress;
  replyTo?: MailAddress | null;
  subject: string;
  html: string;
  text: string;
  /** Message-ID desta mensagem, com os sinais < >. */
  messageId: string;
  /** Mensagem raiz da conversa (In-Reply-To/References), para agrupar a thread. */
  threadRootId?: string | null;
  date?: Date;
}

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64Utf8(value: string): string {
  return bytesToBase64(encoder.encode(value));
}

/** base64url sem padding, como a API do Gmail espera no campo `raw`. */
export function base64UrlUtf8(value: string): string {
  return base64Utf8(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/**
 * Cabeçalho com acentos no formato RFC 2047 (=?UTF-8?B?...?=). Quebra em palavras de até
 * ~45 bytes de origem para respeitar o limite de 75 caracteres por palavra codificada,
 * sem partir caracteres multibyte.
 */
export function encodeHeaderValue(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ");
  if (PRINTABLE_ASCII.test(clean)) return clean;
  const words: string[] = [];
  let chunk = "";
  for (const char of clean) {
    if (encoder.encode(chunk + char).length > 45) {
      words.push(`=?UTF-8?B?${base64Utf8(chunk)}?=`);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(`=?UTF-8?B?${base64Utf8(chunk)}?=`);
  return words.join("\r\n ");
}

export function formatAddress(address: MailAddress): string {
  const email = address.email.replace(/[\r\n<>]/g, "");
  const name = address.name?.replace(/[\r\n"]/g, "").trim();
  if (!name) return email;
  return PRINTABLE_ASCII.test(name) ? `"${name}" <${email}>` : `${encodeHeaderValue(name)} <${email}>`;
}

/** Quebra base64 em linhas de 76 caracteres (RFC 2045). */
function wrap76(value: string): string {
  return value.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
}

function randomBoundary(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `pitzi-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Monta a mensagem completa (multipart/alternative: texto + HTML, ambos em UTF-8/base64). */
export function buildMimeMessage(input: MimeMessageInput, boundary: string = randomBoundary()): string {
  const headers = [
    `From: ${formatAddress(input.from)}`,
    `To: ${formatAddress(input.to)}`,
    ...(input.replyTo ? [`Reply-To: ${formatAddress(input.replyTo)}`] : []),
    `Subject: ${encodeHeaderValue(input.subject)}`,
    `Date: ${(input.date ?? new Date()).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${input.messageId}`,
    ...(input.threadRootId && input.threadRootId !== input.messageId
      ? [`In-Reply-To: ${input.threadRootId}`, `References: ${input.threadRootId}`]
      : []),
    "Auto-Submitted: auto-generated",
    "X-Auto-Response-Suppress: All",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(base64Utf8(body)),
  ].join("\r\n");

  return [
    headers.join("\r\n"),
    "",
    part("text/plain", input.text),
    part("text/html", input.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Message-ID raiz de um chamado: todas as mensagens dele apontam para ele (mesma thread). */
export function ticketThreadRootId(ticketId: string, domain: string): string {
  return `<ticket-${ticketId}@${domain}>`;
}

export function newMessageId(domain: string, prefix = "msg"): string {
  return `<${prefix}-${crypto.randomUUID()}@${domain}>`;
}

export function emailDomain(email: string): string {
  return email.split("@")[1] || "localhost";
}
