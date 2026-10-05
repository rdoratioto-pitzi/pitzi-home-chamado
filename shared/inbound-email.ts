// Respostas por e-mail: regras puras (sem rede nem banco) usadas pelo processador do Worker
// (worker/src/lib/inbound-email.ts). Identifica o chamado, descarta mensagens automáticas e
// limpa o histórico citado para que só o texto novo vire comentário.

export type MailHeaders = Record<string, string>;

/** Cabeçalhos com nome em minúsculas (a API do Gmail devolve com a grafia original). */
export function normalizeHeaders(list: ReadonlyArray<{ name: string; value: string }>): MailHeaders {
  const headers: MailHeaders = {};
  for (const { name, value } of list) {
    const key = name.toLowerCase();
    // Mantém a primeira ocorrência (ex.: Received aparece várias vezes; não usamos).
    if (!(key in headers)) headers[key] = value;
  }
  return headers;
}

/** "Fulano <fulano@x.com>" → "fulano@x.com" (minúsculas). */
export function parseEmailAddress(value: string | null | undefined): string {
  if (!value) return "";
  const angle = value.match(/<([^>]+)>/);
  const raw = (angle ? angle[1] : value).trim();
  const email = raw.match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return email ? email[0].toLowerCase() : "";
}

export interface AutomatedCheck {
  automated: boolean;
  reason?: string;
}

/**
 * Mensagens que não podem virar comentário: as nossas próprias (evita loop), respostas
 * automáticas (férias, fora do escritório), devoluções e listas de e-mail.
 */
export function detectAutomatedMessage(headers: MailHeaders, fromEmail: string, ownSender: string): AutomatedCheck {
  const own = ownSender.trim().toLowerCase();
  if (!fromEmail) return { automated: true, reason: "Sem remetente" };
  if (own && fromEmail === own) return { automated: true, reason: "Enviada pela própria caixa de chamados" };
  const local = fromEmail.split("@")[0];
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce[s]?)$/i.test(local)) {
    return { automated: true, reason: "Remetente automático" };
  }
  const autoSubmitted = headers["auto-submitted"];
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== "no") {
    return { automated: true, reason: "Resposta automática (Auto-Submitted)" };
  }
  if (headers["x-autoreply"] || headers["x-autorespond"] || headers["x-autoresponder"]) {
    return { automated: true, reason: "Resposta automática" };
  }
  const precedence = headers["precedence"]?.trim().toLowerCase();
  if (precedence && ["bulk", "junk", "list", "auto_reply"].includes(precedence)) {
    return { automated: true, reason: `Precedence: ${precedence}` };
  }
  if (headers["return-path"]?.trim() === "<>") return { automated: true, reason: "Devolução (bounce)" };
  if (headers["list-id"]) return { automated: true, reason: "Lista de e-mail" };
  return { automated: false };
}

export interface TicketReference {
  /** Message-IDs citados em In-Reply-To/References, com os sinais < >. */
  messageIds: string[];
  /** Ids de chamado vindos da raiz da conversa `<ticket-{id}@dominio>`. */
  ticketIds: string[];
  /** Código no assunto, ex.: CHA-0007 (último recurso). */
  code: string | null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function extractTicketReference(headers: MailHeaders): TicketReference {
  const refs = `${headers["in-reply-to"] ?? ""} ${headers["references"] ?? ""}`;
  const messageIds = Array.from(new Set(refs.match(/<[^<>\s]+>/g) ?? []));
  const ticketIds = Array.from(new Set(
    messageIds
      .map((id) => id.match(new RegExp(`^<ticket-(${UUID})@`, "i"))?.[1]?.toLowerCase())
      .filter((v): v is string => !!v),
  ));
  const code = headers["subject"]?.match(/\[(CHA-\d+)\]/i)?.[1]?.toUpperCase() ?? null;
  return { messageIds, ticketIds, code };
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return ENTITIES[lower] ?? match;
  });
}

/** HTML → texto simples (só para quando a mensagem não tem parte text/plain). */
export function htmlToText(html: string): string {
  let text = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    // Bloco de citação do Gmail e do Outlook: tudo a partir dele é histórico.
    .replace(/<div[^>]*class="?gmail_quote[\s\S]*$/i, "")
    .replace(/<div[^>]*id="?(divRplyFwdMsg|appendonsend)[\s\S]*$/i, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  text = decodeHtmlEntities(text);
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Linha que abre o histórico citado. Em PT/EN o "escreveu:/wrote:" pode cair na linha seguinte.
const QUOTE_HEADER_START = /^(Em|On|Le|El)\s.+/i;
const QUOTE_HEADER_END = /(escreveu|wrote|a écrit|escribió)\s*:\s*$/i;
const SEPARATORS = [
  /^-{2,}\s*(Original Message|Mensagem original|Mensaje original)\s*-{2,}\s*$/i,
  /^_{10,}\s*$/,
  /^-{2,}\s*(Forwarded message|Mensagem encaminhada)\s*-{2,}\s*$/i,
];
const HEADER_BLOCK_FIRST = /^\*?(De|From)\s*:\*?\s+/i;
const HEADER_BLOCK_NEXT = /^\*?(Enviado|Enviada|Sent|Para|To|Assunto|Subject|Data|Date|Cc)\s*:/i;
const MOBILE_SIGNATURE = /^(Enviado do meu|Sent from my|Enviado de meu|Get Outlook for)\b/i;

/** Mantém só o texto novo da resposta: corta histórico citado, citações ">" e assinatura "-- ". */
export function stripQuotedReply(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (QUOTE_HEADER_START.test(trimmed)) {
      const window = [trimmed, lines[i + 1]?.trim() ?? "", lines[i + 2]?.trim() ?? ""];
      if (QUOTE_HEADER_END.test(window[0]) || QUOTE_HEADER_END.test(`${window[0]} ${window[1]}`) ||
          QUOTE_HEADER_END.test(`${window[0]} ${window[1]} ${window[2]}`)) {
        break;
      }
    }
    if (SEPARATORS.some((re) => re.test(trimmed))) break;
    if (HEADER_BLOCK_FIRST.test(trimmed)) {
      const next = lines.slice(i + 1, i + 4).map((l) => l.trim());
      if (next.some((l) => HEADER_BLOCK_NEXT.test(l))) break;
    }
    if (trimmed === "--" || line === "-- ") break;
    if (trimmed.startsWith(">")) continue;
    if (MOBILE_SIGNATURE.test(trimmed)) continue;
    kept.push(line.replace(/\s+$/, ""));
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto da resposta → HTML do comentário (parágrafos; nada do e-mail vira tag). */
export function textToCommentHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

export const ATTACHMENTS_NOT_IMPORTED_NOTE = "(anexos enviados por e-mail não foram importados)";
