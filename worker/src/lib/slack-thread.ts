// Conversa inteira do Slack para o chamado: lê a thread (conversations.replies), busca os nomes
// de quem escreveu e importa os anexos para o R2, como os anexos das respostas por e-mail.
import type { Ticket } from "../../../shared/schema";
import {
  SLACK_MAX_FILE_BYTES,
  slackUserIdsIn,
  type SlackFile,
  type SlackThreadMessage,
} from "../../../shared/slack-ticket";
import { slackApi } from "./slack-api";

/** Teto de mensagens lidas de uma thread. */
export const SLACK_THREAD_LIMIT = 200;

export type SlackThreadResult =
  | { ok: true; messages: SlackThreadMessage[] }
  | { ok: false; error: string };

/** Mensagens da thread, da raiz à última resposta (paginado, até SLACK_THREAD_LIMIT). */
export async function fetchSlackThread(
  token: string,
  channel: string,
  rootTs: string,
  limit = SLACK_THREAD_LIMIT,
): Promise<SlackThreadResult> {
  const messages: SlackThreadMessage[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await slackApi(token, "conversations.replies", {
      channel, ts: rootTs, limit: Math.min(200, limit - messages.length), cursor,
    });
    if (!page.ok) return { ok: false, error: page.error ?? "erro" };
    messages.push(...((page.messages ?? []) as SlackThreadMessage[]));
    cursor = page.response_metadata?.next_cursor || undefined;
    if (cursor && seen.has(cursor)) return { ok: false, error: "invalid_pagination" };
    if (cursor) seen.add(cursor);
  } while (cursor && messages.length < limit);
  return { ok: true, messages: messages.slice(0, limit) };
}

/** Nome de cada usuário citado (autor ou menção); quem não for encontrado fica de fora. */
export async function resolveSlackNames(token: string, messages: readonly SlackThreadMessage[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  await Promise.all(slackUserIdsIn(messages).slice(0, 40).map(async (id) => {
    const info = await slackApi(token, "users.info", { user: id });
    const profile = info.user?.profile ?? {};
    const name = String(profile.real_name || profile.display_name || info.user?.real_name || info.user?.name || "").trim();
    if (info.ok && name) names.set(id, name);
  }));
  return names;
}

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "arquivo";
}

export interface SavedAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

/**
 * Baixa os anexos com o token do bot (precisa de files:read) e grava no R2, no mesmo formato
 * dos anexos do chamado. Sem files:read o Slack devolve a página de login (HTML): conta como falha.
 */
export async function importSlackFiles(
  env: { ATTACHMENTS?: R2Bucket },
  token: string,
  ticket: Pick<Ticket, "tenantId">,
  files: readonly SlackFile[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ saved: SavedAttachment[]; failed: string[]; missingScope: boolean }> {
  const saved: SavedAttachment[] = [];
  const failed: string[] = [];
  let missingScope = false;
  for (const f of files) {
    const name = safeFileName(f.name || f.title || "arquivo");
    const url = f.url_private_download || f.url_private;
    if (!env.ATTACHMENTS || !url) {
      failed.push(name);
      continue;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.hostname !== "files.slack.com" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
        failed.push(name);
        continue;
      }
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || type.startsWith("text/html")) {
        if (type.startsWith("text/html")) missingScope = true;
        failed.push(name);
        continue;
      }
      if (Number(res.headers.get("content-length")) > SLACK_MAX_FILE_BYTES || !res.body) {
        await res.body?.cancel();
        failed.push(name);
        continue;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > SLACK_MAX_FILE_BYTES) {
            await reader.cancel();
            throw new Error("attachment_too_large");
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const contentType = f.mimetype || type || "application/octet-stream";
      const key = `${ticket.tenantId}/uploads/${crypto.randomUUID()}-${name}`;
      await env.ATTACHMENTS.put(key, bytes, { httpMetadata: { contentType } });
      saved.push({ name, url: `/objects/${key}`, size: bytes.byteLength, type: contentType });
    } catch (error) {
      console.warn("[slack-chamados] anexo não importado:", name);
      failed.push(name);
    }
  }
  return { saved, failed, missingScope };
}
