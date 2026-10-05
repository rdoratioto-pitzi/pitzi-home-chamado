// worker/src/routes/slack.ts
//
// Slack → chamado (fase 1):
//  - /chamado [texto]: abre a janela de abertura; o solicitante é quem digitou.
//  - atalho de mensagem "Transformar em chamado": mesma janela com o texto e o link da
//    mensagem; o solicitante é o AUTOR da mensagem. Só técnicos/admins usam em mensagem de
//    outra pessoa. Depois de criado, o app responde na thread da mensagem.
// Rotas públicas: a autenticidade vem da assinatura do Slack (SLACK_SIGNING_SECRET).
import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../index";
import type { Ticket } from "../../../shared/schema";
import { getStorage } from "../lib/storage";
import { mailContext } from "../lib/mailer";
import { createTicketFor } from "../lib/create-ticket";
import { notifyPerson, slackApi } from "../lib/slack-api";
import { resolveSlackPerson } from "../lib/slack-people";
import { fetchSlackThread, importSlackFiles, resolveSlackNames } from "../lib/slack-thread";
import { sanitizeRichText } from "../lib/sanitize-rich-text";
import { fieldsForGroup } from "../../../shared/custom-fields";
import { isTechnician } from "../../../shared/user-type";
import {
  DEFAULT_SLACK_IMPACT,
  SLACK_MODAL_CALLBACK_ID,
  SLACK_SHORTCUT_CALLBACK_ID,
  buildTicketModal,
  firstLine,
  parseModalMetadata,
  parseTicketModal,
  buildConversationHtml,
  plainTextToHtml,
  selectSlackFiles,
  slackAccessHint,
  slackMrkdwnToText,
  slackTextToPlain,
  verifySlackSignature,
  type SlackThreadMessage,
} from "../../../shared/slack-ticket";

export const slack = new Hono<AppEnv>();

const ephemeral = (text: string) => ({ response_type: "ephemeral", text });

/** Corpo bruto + conferência da assinatura. null quando a requisição não é do Slack. */
async function readSignedBody(c: Context<AppEnv>): Promise<string | null> {
  const rawBody = await c.req.text();
  const valid = await verifySlackSignature({
    signingSecret: c.env.SLACK_SIGNING_SECRET,
    timestamp: c.req.header("X-Slack-Request-Timestamp"),
    signature: c.req.header("X-Slack-Signature"),
    rawBody,
  });
  return valid ? rawBody : null;
}

/** Roda depois da resposta ao Slack (que exige resposta em até 3 s). */
async function afterResponse(c: Context<AppEnv>, work: Promise<unknown>): Promise<void> {
  const safe = work.catch((error) => console.error("[slack-chamados]", error));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    await safe; // testes / ambiente sem executionCtx
  }
}

async function activeGroups(storage: ReturnType<typeof getStorage>, tenantId: string | null) {
  const groups = await storage.getSupportGroups(tenantId);
  return groups.filter((g) => g.active).map((g) => ({ key: g.key, name: g.name }));
}

function ticketLink(appUrl: string | undefined, ticketId: string): string {
  return `${(appUrl || "").replace(/\/$/, "")}/chamados/${ticketId}`;
}

// ─── /chamado ─────────────────────────────────────────────────────────────────

slack.post("/api/slack/commands", async (c) => {
  const rawBody = await readSignedBody(c);
  if (rawBody === null) return c.text("Assinatura inválida", 401);
  const token = c.env.SLACK_BOT_TOKEN;
  if (!token) return c.json(ephemeral("A integração com os chamados ainda não está configurada."));

  const params = new URLSearchParams(rawBody);
  const slackUserId = params.get("user_id") ?? "";
  const triggerId = params.get("trigger_id") ?? "";
  const text = slackTextToPlain(params.get("text"));
  const db = c.get("db");
  const storage = getStorage(db);

  const person = await resolveSlackPerson(db, c.env, slackUserId);
  if (!person.ok) return c.json(ephemeral(person.message));
  const groups = await activeGroups(storage, person.user.tenantId ?? null);

  const view = buildTicketModal({
    metadata: { mode: "command", clickerSlackId: slackUserId, requesterSlackId: slackUserId, channelId: params.get("channel_id") },
    title: firstLine(text),
    description: text,
    groups,
    showImpact: isTechnician(person.user),
  });
  const opened = await slackApi(token, "views.open", { trigger_id: triggerId, view });
  if (!opened.ok) return c.json(ephemeral(`Não consegui abrir a janela do chamado (${opened.error ?? "erro"}). Tente de novo.`));
  return c.body(null, 200);
});

// ─── Interações: atalho de mensagem e envio da janela ─────────────────────────

slack.post("/api/slack/interactions", async (c) => {
  const rawBody = await readSignedBody(c);
  if (rawBody === null) return c.text("Assinatura inválida", 401);
  const token = c.env.SLACK_BOT_TOKEN;
  if (!token) return c.body(null, 200);

  let payload: any;
  try {
    payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "");
  } catch {
    return c.text("payload inválido", 400);
  }

  if (payload?.type === "message_action" && payload.callback_id === SLACK_SHORTCUT_CALLBACK_ID) {
    return handleShortcut(c, token, payload);
  }
  if (payload?.type === "view_submission" && payload.view?.callback_id === SLACK_MODAL_CALLBACK_ID) {
    return handleSubmission(c, token, payload);
  }
  return c.body(null, 200);
});

/** Resposta mais lenta que isso cai no comportamento de mensagem única (o trigger vale 3 s). */
const ROOT_LOOKUP_TIMEOUT_MS = 1_200;

async function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handleShortcut(c: Context<AppEnv>, token: string, payload: any) {
  const clickerSlackId: string = payload.user?.id ?? "";
  const channelId: string | null = payload.channel?.id ?? null;
  const channelName: string | null = payload.channel?.name ?? null;
  const message = payload.message ?? {};
  // A conversa começa na mensagem raiz da thread (ou na própria mensagem, se não for resposta).
  const rootTs: string | null = message.thread_ts ?? message.ts ?? null;
  const isReply = Boolean(message.thread_ts && message.thread_ts !== message.ts);

  const db = c.get("db");
  const storage = getStorage(db);
  // Em paralelo para caber nos 3 s do trigger: quem clicou, o link e (se for resposta) a raiz.
  const [clicker, permalink, rootLookup] = await Promise.all([
    resolveSlackPerson(db, c.env, clickerSlackId),
    channelId && rootTs ? slackApi(token, "chat.getPermalink", { channel: channelId, message_ts: rootTs }) : Promise.resolve(null),
    channelId && rootTs && isReply
      ? withTimeout(fetchSlackThread(token, channelId, rootTs, 1), ROOT_LOOKUP_TIMEOUT_MS, { ok: false as const, error: "timeout" })
      : Promise.resolve(null),
  ]);
  if (!clicker.ok) {
    await notifyPerson(token, clickerSlackId, clicker.message, channelId);
    return c.body(null, 200);
  }

  // Sem acesso à conversa (app fora do canal / sem permissão): segue só com a mensagem clicada.
  const rootMessage: SlackThreadMessage | null = rootLookup?.ok ? rootLookup.messages[0] ?? null : isReply ? null : message;
  const conversation = !isReply || Boolean(rootLookup?.ok);
  if (rootLookup && !rootLookup.ok) {
    await notifyPerson(token, clickerSlackId, `${slackAccessHint(rootLookup.error)} Vai só a mensagem que você escolheu.`, channelId);
  }
  const starter = rootMessage ?? message;
  const authorSlackId: string | undefined = starter.user ?? message.user;
  if (!authorSlackId) {
    await notifyPerson(token, clickerSlackId, "Mensagens de bots ou de apps não viram chamado.", channelId);
    return c.body(null, 200);
  }
  const sameAuthor = authorSlackId === clickerSlackId;
  if (!sameAuthor && !isTechnician(clicker.user)) {
    await notifyPerson(token, clickerSlackId, "Só técnicos podem transformar conversas iniciadas por outras pessoas em chamado.", channelId);
    return c.body(null, 200);
  }
  const requester = sameAuthor ? clicker : await resolveSlackPerson(db, c.env, authorSlackId);
  if (!requester.ok) {
    await notifyPerson(token, clickerSlackId, `Não dá para abrir o chamado em nome de quem começou a conversa: ${requester.message}`, channelId);
    return c.body(null, 200);
  }

  const text = slackMrkdwnToText(starter.text);
  const replies = Number(rootMessage?.reply_count ?? message.reply_count ?? 0);
  const link: string | null = permalink?.ok ? permalink.permalink : null;
  const whatGoes = conversation
    ? replies > 0
      ? `A conversa inteira (${replies + 1} mensagens), o link e os anexos vão junto no chamado.`
      : "A mensagem, o link e os anexos vão junto no chamado."
    : "Só a mensagem escolhida vai para o chamado (o app não conseguiu ler a conversa).";
  const view = buildTicketModal({
    metadata: {
      mode: "shortcut", clickerSlackId, requesterSlackId: authorSlackId, channelId,
      messageTs: message.ts ?? null, threadTs: conversation ? rootTs : message.ts ?? null,
      channelName, permalink: link, conversation,
    },
    title: firstLine(text),
    description: text,
    groups: await activeGroups(storage, requester.user.tenantId ?? null),
    showImpact: isTechnician(clicker.user),
    context: `Solicitante: *${requester.user.name}* (${sameAuthor ? "você" : "quem começou a conversa"})\n${whatGoes}`,
  });
  const opened = await slackApi(token, "views.open", { trigger_id: payload.trigger_id, view });
  if (!opened.ok) {
    await notifyPerson(token, clickerSlackId, `Não consegui abrir a janela do chamado (${opened.error ?? "erro"}).`, channelId);
  }
  return c.body(null, 200);
}

/**
 * Descrição do chamado aberto pelo atalho: o texto da janela + a conversa inteira lida agora
 * (assim entram também as respostas enviadas enquanto a janela estava aberta).
 */
async function shortcutDescription(
  token: string,
  meta: NonNullable<ReturnType<typeof parseModalMetadata>>,
  typed: string,
): Promise<{ html: string; messages: SlackThreadMessage[]; error?: string }> {
  const fallback = (error?: string) => ({
    html: plainTextToHtml(meta.permalink ? `${typed}\n\nMensagem original no Slack: ${meta.permalink}` : typed),
    messages: [] as SlackThreadMessage[],
    error,
  });
  if (!meta.channelId || !meta.threadTs) return fallback();
  const thread = await fetchSlackThread(token, meta.channelId, meta.threadTs);
  if (!thread.ok) return fallback(thread.error);
  if (thread.messages.length === 0) return fallback();
  const names = await resolveSlackNames(token, thread.messages);
  const conversation = buildConversationHtml({
    channelName: meta.channelName, permalink: meta.permalink, messages: thread.messages, names,
  });
  return { html: sanitizeRichText(`${plainTextToHtml(typed)}${conversation}`), messages: thread.messages };
}

async function handleSubmission(c: Context<AppEnv>, token: string, payload: any) {
  const meta = parseModalMetadata(payload.view?.private_metadata);
  if (!meta) return c.body(null, 200);
  const values = parseTicketModal(payload.view);
  const db = c.get("db");
  const storage = getStorage(db);

  // Validações rápidas que voltam para a janela (o Slack dá 3 s para responder).
  if (!values.title || !values.description) {
    return c.json({ response_action: "errors", errors: { [values.title ? "descricao" : "titulo"]: "Campo obrigatório" } });
  }
  if (!(await storage.getActiveSupportGroupByKey(values.category))) {
    return c.json({ response_action: "errors", errors: { grupo: "Escolha um grupo de atendimento ativo." } });
  }
  const required = fieldsForGroup(await storage.getTicketCustomFields(), values.category).filter((f) => f.required);
  if (required.length > 0) {
    return c.json({
      response_action: "errors",
      errors: { grupo: `Este grupo pede campos obrigatórios (${required.map((f) => f.label).join(", ")}) que ainda não dá para preencher pelo Slack. Abra este chamado pelo sistema.` },
    });
  }

  // A janela fecha já; a criação e as respostas seguem em segundo plano.
  await afterResponse(c, createFromSlack(c, token, meta, values));
  return c.body(null, 200);
}

async function createFromSlack(
  c: Context<AppEnv>,
  token: string,
  meta: NonNullable<ReturnType<typeof parseModalMetadata>>,
  values: ReturnType<typeof parseTicketModal>,
) {
  const db = c.get("db");
  const storage = getStorage(db);
  const [requester, clicker] = await Promise.all([
    resolveSlackPerson(db, c.env, meta.requesterSlackId),
    meta.clickerSlackId === meta.requesterSlackId ? Promise.resolve(null) : resolveSlackPerson(db, c.env, meta.clickerSlackId),
  ]);
  if (!requester.ok) {
    await notifyPerson(token, meta.clickerSlackId, `Não consegui abrir o chamado: ${requester.message}`, meta.channelId);
    return;
  }
  const clickerUser = clicker ? (clicker.ok ? clicker.user : null) : requester.user;
  // Gravidade: só técnico/admin escolhe; Usuário fica com "Médio" (mesma regra do formulário).
  const impact = clickerUser && isTechnician(clickerUser) && values.impact ? values.impact : DEFAULT_SLACK_IMPACT;

  const fromConversation = meta.mode === "shortcut"
    ? await shortcutDescription(token, meta, values.description)
    : null;
  if (fromConversation?.error) {
    await notifyPerson(token, meta.clickerSlackId, `${slackAccessHint(fromConversation.error)} O chamado vai com a mensagem escolhida.`, meta.channelId);
  }

  const result = await createTicketFor(storage, mailContext(c), {
    userId: requester.user.id, isAdmin: requester.user.isAdmin === true, tenantId: requester.user.tenantId ?? null,
  }, {
    code: "",
    title: values.title,
    description: fromConversation?.html ?? plainTextToHtml(values.description),
    category: values.category,
    type: values.type,
    impact,
    priority: "medium",
  });
  if (!result.ok) {
    await notifyPerson(token, meta.clickerSlackId, `Não consegui abrir o chamado: ${result.error}`, meta.channelId);
    return;
  }

  const ticket = result.ticket;
  const link = ticketLink(c.env.APP_URL, ticket.id);
  if (meta.mode === "shortcut" && meta.channelId) {
    // Anexos da conversa: vão para o chamado depois que ele existe (R2, mesmo formato da tela).
    const files = selectSlackFiles(fromConversation?.messages ?? []);
    const imported = files.importable.length > 0
      ? await importSlackFiles(c.env, token, ticket, files.importable)
      : { saved: [], failed: [], missingScope: false };
    const notImported = [...files.skipped, ...imported.failed];
    const update: Partial<Ticket> = {
      slackChannelId: meta.channelId, slackThreadTs: meta.threadTs ?? null, slackMessageTs: meta.messageTs ?? null,
    };
    if (imported.saved.length > 0) update.attachments = JSON.stringify(imported.saved);
    if (notImported.length > 0) {
      const names = notImported.map((n) => n.replace(/[<>&"]/g, "")).join(", ");
      update.description = `${ticket.description ?? ""}<p><em>Anexos da conversa que não foram importados: ${names}. Veja no Slack.</em></p>`;
    }
    await storage.updateTicket(ticket.id, update);
    if (imported.missingScope) {
      await notifyPerson(token, meta.clickerSlackId,
        "Os anexos da conversa não vieram: o app precisa da permissão files:read. Peça ao admin do Slack para atualizar o manifesto e reinstalar o app.",
        meta.channelId);
    }
    const reply = await slackApi(token, "chat.postMessage", {
      channel: meta.channelId,
      thread_ts: meta.threadTs ?? meta.messageTs ?? undefined,
      text: `Virou o chamado *${ticket.code}*: <${link}|${ticket.title}>`,
      unfurl_links: false,
    });
    if (!reply.ok) {
      // Canal privado sem o app: avisa só quem clicou.
      await notifyPerson(token, meta.clickerSlackId,
        `Chamado *${ticket.code}* aberto ✅ <${link}|Ver chamado>. Não consegui responder na conversa: convide o app *Chamados Pitzi* neste canal.`,
        meta.channelId);
    }
    return;
  }
  await notifyPerson(token, meta.clickerSlackId, `Chamado *${ticket.code}* aberto ✅ <${link}|Ver chamado>`, meta.channelId);
}
