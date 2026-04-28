/**
 * server/services/slack.service.ts
 *
 * Camada de comunicação com a Slack Web API.
 * Funções puras (sem dependência de singleton) — recebem `env` por parâmetro
 * para permitir uso tanto no Express (process.env) quanto no Cloudflare
 * Worker (c.env). Toda interação com Slack passa por este service.
 *
 * Princípios:
 *  - NUNCA quebra fluxo principal: se Slack falhar, log e segue.
 *  - Idempotência onde possível (ex: addReaction ignora "already_reacted").
 *  - Feature flag SLACK_INTEGRATION_ENABLED desliga tudo (rollback rápido).
 *  - Singleton de WebClient por token (cache em módulo).
 */

import { WebClient, type KnownBlock, type Block } from "@slack/web-api";

export type SlackEnv = {
  SLACK_BOT_TOKEN?: string;
  SLACK_INTEGRATION_ENABLED?: string;
  SLACK_CHANNEL_DEVS?: string;
  // SLACK_SIGNING_SECRET é usado apenas na Fase 2 (eventos inbound).
};

export type SlackBlock = KnownBlock | Block;

/** Cache de instâncias WebClient por token (singleton por token). */
const clientCache = new Map<string, WebClient>();

/**
 * Verifica se a integração está habilitada e o bot token está presente.
 * Retorna true apenas quando seguro chamar a API.
 */
export function isSlackEnabled(env: SlackEnv): boolean {
  if (env.SLACK_INTEGRATION_ENABLED === "false") return false;
  if (!env.SLACK_BOT_TOKEN) return false;
  return true;
}

/**
 * Retorna um WebClient configurado, ou null se a integração estiver
 * desabilitada / token ausente. Reusa instâncias por token.
 */
export function initSlackClient(env: SlackEnv): WebClient | null {
  if (!isSlackEnabled(env)) {
    if (env.SLACK_INTEGRATION_ENABLED !== "false") {
      // Habilitada mas sem token — log warning (1x por processo idealmente,
      // mas o cache do Map evita spam quando reutilizamos).
      console.warn("[slack] SLACK_BOT_TOKEN ausente — notificações desabilitadas.");
    }
    return null;
  }
  const token = env.SLACK_BOT_TOKEN!;
  let client = clientCache.get(token);
  if (!client) {
    client = new WebClient(token, {
      // logLevel default — Slack SDK usa silencioso por padrão.
      retryConfig: { retries: 2 }, // 2 retries em erros transientes
    });
    clientCache.set(token, client);
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envio de mensagens
// ─────────────────────────────────────────────────────────────────────────────

export type SendChannelMessageParams = {
  channel: string;
  text: string; // fallback acessível (notificações mobile, leitores de tela)
  blocks?: SlackBlock[];
};

/**
 * Envia mensagem-mãe em um canal. Retorna `{ ts }` (thread_ts) ou null se
 * desabilitado/erro.
 */
export async function sendChannelMessage(
  env: SlackEnv,
  params: SendChannelMessageParams,
): Promise<{ ts: string } | null> {
  const client = initSlackClient(env);
  if (!client) return null;

  try {
    const result = await client.chat.postMessage({
      channel: params.channel,
      text: params.text,
      blocks: params.blocks,
      // unfurl_links/media off para mensagens compactas
      unfurl_links: false,
      unfurl_media: false,
    });
    if (!result.ok || !result.ts) {
      console.warn("[slack] postMessage retornou ok=false:", result.error);
      return null;
    }
    return { ts: result.ts };
  } catch (error: unknown) {
    console.error("[slack] sendChannelMessage falhou:", getErrorMessage(error));
    return null;
  }
}

export type SendThreadReplyParams = {
  channel: string;
  thread_ts: string;
  text: string;
  blocks?: SlackBlock[];
};

/** Reply em uma thread existente. */
export async function sendThreadReply(
  env: SlackEnv,
  params: SendThreadReplyParams,
): Promise<{ ts: string } | null> {
  const client = initSlackClient(env);
  if (!client) return null;

  try {
    const result = await client.chat.postMessage({
      channel: params.channel,
      thread_ts: params.thread_ts,
      text: params.text,
      blocks: params.blocks,
      unfurl_links: false,
      unfurl_media: false,
    });
    if (!result.ok || !result.ts) {
      console.warn("[slack] thread reply retornou ok=false:", result.error);
      return null;
    }
    return { ts: result.ts };
  } catch (error: unknown) {
    console.error("[slack] sendThreadReply falhou:", getErrorMessage(error));
    return null;
  }
}

export type AddReactionParams = {
  channel: string;
  timestamp: string;
  emoji: string; // sem ":", ex: "white_check_mark"
};

/**
 * Adiciona reação a uma mensagem. Idempotente: ignora "already_reacted".
 */
export async function addReaction(
  env: SlackEnv,
  params: AddReactionParams,
): Promise<boolean> {
  const client = initSlackClient(env);
  if (!client) return false;

  try {
    await client.reactions.add({
      channel: params.channel,
      timestamp: params.timestamp,
      name: params.emoji,
    });
    return true;
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg.includes("already_reacted")) return true; // idempotente
    console.error("[slack] addReaction falhou:", msg);
    return false;
  }
}

export type SendDirectMessageParams = {
  slackUserId: string;
  text: string;
  blocks?: SlackBlock[];
};

/**
 * Envia DM a um usuário. Abre o canal IM (conversations.open) e posta.
 */
export async function sendDirectMessage(
  env: SlackEnv,
  params: SendDirectMessageParams,
): Promise<{ ts: string } | null> {
  const client = initSlackClient(env);
  if (!client) return null;

  try {
    const im = await client.conversations.open({ users: params.slackUserId });
    if (!im.ok || !im.channel?.id) {
      console.warn("[slack] conversations.open falhou:", im.error);
      return null;
    }
    return await sendChannelMessage(env, {
      channel: im.channel.id,
      text: params.text,
      blocks: params.blocks,
    });
  } catch (error: unknown) {
    console.error("[slack] sendDirectMessage falhou:", getErrorMessage(error));
    return null;
  }
}

/**
 * Resolve um Slack user ID a partir de um email corporativo.
 * Em caso de sucesso, o caller deve persistir em `users.slack_user_id`
 * para evitar lookups repetidos.
 */
export async function resolveSlackUserIdByEmail(
  env: SlackEnv,
  email: string,
): Promise<string | null> {
  const client = initSlackClient(env);
  if (!client) return null;

  if (!email || !email.includes("@")) return null;

  try {
    const result = await client.users.lookupByEmail({ email });
    if (!result.ok || !result.user?.id) {
      // "users_not_found" é comum se o email do Renov ≠ email do Slack
      return null;
    }
    return result.user.id;
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg.includes("users_not_found")) return null;
    console.error("[slack] resolveSlackUserIdByEmail falhou:", msg);
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}
