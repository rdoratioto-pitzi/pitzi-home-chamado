// worker/src/routes/slack.ts
//
// Slack → chamado:
//  - /chamado [texto]: abre a janela de abertura; o solicitante é quem digitou.
//  - atalho "Criar chamado" (callback transformar_em_chamado): cria na hora. Em thread, leva a
//    conversa inteira (raiz + respostas) e os anexos; o solicitante é quem começou a conversa.
//  - atalho "Criar chamado avançado": abre a janela; no envio leva a conversa e os anexos.
//  Só técnicos/admins transformam conversa iniciada por outra pessoa.
// Rotas públicas: a autenticidade vem da assinatura do Slack (SLACK_SIGNING_SECRET).
import { recordSlackThreadMessage } from "../lib/slack-thread-sync";
import { Hono } from "hono";
import type { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { mailContext } from "../lib/mailer";
import { createTicketFor } from "../lib/create-ticket";
import { notifyPerson, slackApi, isAllowedSlackTeam } from "../lib/slack-api";
import { resolveSlackPerson } from "../lib/slack-people";
import { fetchSlackThread, importSlackFiles, resolveSlackNames } from "../lib/slack-thread";
import { sanitizeRichText } from "../lib/sanitize-rich-text";
import type { Ticket } from "../../../shared/schema";
import { sameTenant } from "../../../shared/tenant";
import { canViewTicket } from "../../../server/services/ticket-queue.service";
import { tickets } from "../../../shared/schema";
import { fieldsForGroup } from "../../../shared/custom-fields";
import { ticketStatusLabel } from "../../../shared/ticket-options";
import { slaPauseUpdate } from "../../../shared/sla";
import { isTechnician } from "../../../shared/user-type";
import {
  DEFAULT_SLACK_IMPACT,
  SLACK_MODAL_CALLBACK_ID,
  SLACK_SHORTCUT_CALLBACK_ID,
  buildTicketModal,
  firstLine,
  generateSlackTicketTitle,
  parseModalMetadata,
  parseTicketModal,
  plainTextToHtml,
  slackTextToPlain,
  verifySlackSignature,
  buildConversationHtml,
  selectSlackFiles,
  slackAccessHint,
  slackMrkdwnToText,
  type SlackThreadMessage,
} from "../../../shared/slack-ticket";

export const slack = new Hono<AppEnv>();

const ephemeral = (text: string) => ({ response_type: "ephemeral", text });
const SLACK_ACTION_CLAIM = "chamado_assumir";
const SLACK_ACTION_IN_PROGRESS = "chamado_em_atendimento";
const SLACK_ACTION_RESOLVE = "chamado_resolver";

/** Corpo bruto + conferência da assinatura. null quando a requisição não é do Slack. */
async function readSignedBody(c: Context<AppEnv>): Promise<string | null> {
  const rawBody = await c.req.text();
  const valid = await verifySlackSignature({
    signingSecret: c.env.SLACK_SIGNING_SECRET,
    timestamp: c.req.header("X-Slack-Request-Timestamp"),
    signature: c.req.header("X-Slack-Signature"),
    rawBody,
  });
  if (!valid) console.warn("[slack-chamados] invalid signature", { path: c.req.path });
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
  if (!(await isAllowedSlackTeam(c.env, params.get("team_id")))) {
    return c.json(ephemeral("Este workspace do Slack não está autorizado a abrir chamados."));
  }
  const slackUserId = params.get("user_id") ?? "";
  const triggerId = params.get("trigger_id") ?? "";
  const text = slackTextToPlain(params.get("text"));
  const db = c.get("db");
  const storage = getStorage(db);

  const person = await resolveSlackPerson(db, c.env, slackUserId);
  if (!person.ok) return c.json(ephemeral(person.message));
  const groups = await activeGroups(storage, person.user.tenantId ?? null);

  const view = buildTicketModal({
    metadata: { teamId: params.get("team_id"), mode: "command", clickerSlackId: slackUserId, requesterSlackId: slackUserId, channelId: params.get("channel_id") },
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

  if (!(await isAllowedSlackTeam(c.env, payload.team?.id ?? payload.user?.team_id ?? null))) return c.text("Workspace não autorizado", 403);
  if (payload?.type === "message_action" && [SLACK_SHORTCUT_CALLBACK_ID, "criar_chamado_avancado"].includes(payload.callback_id)) {
    if (payload.callback_id === "criar_chamado_avancado") return handleShortcut(c, token, payload, true);
    await afterResponse(c, handleShortcut(c, token, payload));
    return c.body(null, 200);
  }
  if (payload?.type === "view_submission" && payload.view?.callback_id === SLACK_MODAL_CALLBACK_ID) {
    return handleSubmission(c, token, payload);
  }
  if (payload?.type === "block_actions") {
    await afterResponse(c, handleBlockActions(c, token, payload));
    return c.body(null, 200);
  }
  return c.body(null, 200);
});

async function findTicketBySlackMessage(db: any, teamId: string | null, channelId: string, messageTs: string) {
  const teamCondition = teamId ? eq(tickets.slackTeamId, teamId) : isNull(tickets.slackTeamId);
  const [ticket] = await db.select().from(tickets).where(and(
    teamCondition,
    eq(tickets.slackChannelId, channelId),
    eq(tickets.slackMessageTs, messageTs),
  )).limit(1);
  return ticket ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

async function defaultSlackGroup(storage: ReturnType<typeof getStorage>, tenantId: string | null) {
  const groups = await activeGroups(storage, tenantId);
  return groups.find((g) => ["suporte-ti", "ti", "sap"].includes(g.key)) ?? groups[0] ?? null;
}

function slackTicketDescription(input: {
  text: string;
  requesterName: string;
  requesterEmail?: string | null;
  channelId: string;
  channelName?: string | null;
  permalink?: string;
}) {
  const channel = input.channelName ? `#${input.channelName}` : input.channelId;
  return [
    input.text,
    "",
    "Origem: Slack",
    `Solicitante: ${input.requesterName}`,
    ...(input.requesterEmail ? [`E-mail: ${input.requesterEmail}`] : []),
    `Canal: ${channel}`,
    input.permalink ? `Mensagem original: ${input.permalink}` : "Mensagem original: permalink indisponível",
  ].join("\n");
}

function ticketReplyBlocks(ticket: { id: string; code: string; title: string; status: string; priority?: string | null }, link: string, created = true, assignee = "Não atribuído") {
  return [
    { type: "section", text: { type: "mrkdwn", text: `🎫 Chamado *${ticket.code}*${created ? " criado com sucesso" : ""}\n*${ticket.title}*\nStatus: ${ticketStatusLabel(ticket.status)}\nPrioridade: ${ticket.priority === "medium" ? "Normal" : ticket.priority ?? "Normal"}\nResponsável: ${assignee}` } },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "Assumir", emoji: true }, action_id: SLACK_ACTION_CLAIM, value: ticket.id },
        { type: "button", text: { type: "plain_text", text: "Em atendimento", emoji: true }, action_id: SLACK_ACTION_IN_PROGRESS, value: ticket.id },
        { type: "button", text: { type: "plain_text", text: "Resolver", emoji: true }, style: "primary", action_id: SLACK_ACTION_RESOLVE, value: ticket.id },
        { type: "button", text: { type: "plain_text", text: "Ver chamado", emoji: true }, url: link, action_id: "chamado_ver" },
      ],
    },
  ];
}

/** Resposta mais lenta que isso cai na mensagem única (o trigger_id da janela vale 3 s). */
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

type ThreadLookup = { ok: true; messages: SlackThreadMessage[] } | { ok: false; error: string } | null;

function slackOriginFooter(input: { requesterName: string; requesterEmail?: string | null; channelId: string; channelName?: string | null }) {
  const channel = input.channelName ? `#${input.channelName}` : input.channelId;
  return [
    "Origem: Slack",
    `Solicitante: ${input.requesterName}`,
    ...(input.requesterEmail ? [`E-mail: ${input.requesterEmail}`] : []),
    `Canal: ${channel}`,
  ].join("\n");
}

/** Confirmação na thread; se o app não estiver no canal, avisa quem clicou (efêmero ou DM). */
async function confirmInThread(token: string, input: {
  channelId: string; threadTs: string; clickerSlackId: string; text: string; blocks?: unknown; link: string; code: string;
}) {
  const reply = await slackApi(token, "chat.postMessage", {
    channel: input.channelId,
    thread_ts: input.threadTs,
    text: input.text,
    ...(input.blocks ? { blocks: JSON.stringify(input.blocks) } : {}),
    unfurl_links: false,
  });
  if (!reply.ok) {
    await notifyPerson(token, input.clickerSlackId,
      `Chamado *${input.code}* aberto ✅ <${input.link}|Ver chamado>.\nNão consegui responder na conversa: convide o app no canal com \`/invite @Chamados Pitzi\` para ver a confirmação na thread.`,
      input.channelId);
  }
}

/**
 * Anexos da conversa vão para o chamado depois que ele existe (R2, mesmo formato da tela).
 * Os que não entram ficam listados na descrição.
 */
async function attachConversationFiles(
  c: Context<AppEnv>, token: string, ticket: Ticket, messages: readonly SlackThreadMessage[], clickerSlackId: string, channelId: string,
) {
  const storage = getStorage(c.get("db"));
  const files = selectSlackFiles(messages);
  if (files.importable.length === 0 && files.skipped.length === 0) return;
  const imported = files.importable.length > 0
    ? await importSlackFiles(c.env, token, ticket, files.importable)
    : { saved: [], failed: [], missingScope: false };
  const notImported = [...files.skipped, ...imported.failed];
  const update: Partial<Ticket> = {};
  if (imported.saved.length > 0) update.attachments = JSON.stringify(imported.saved);
  if (notImported.length > 0) {
    const names = notImported.map((n) => n.replace(/[<>&"]/g, "")).join(", ");
    update.description = `${ticket.description ?? ""}<p><em>Anexos da conversa que não foram importados: ${names}. Veja no Slack.</em></p>`;
  }
  if (Object.keys(update).length > 0) await storage.updateTicket(ticket.id, update);
  if (imported.missingScope) {
    await notifyPerson(token, clickerSlackId,
      "Os anexos da conversa não vieram: o app precisa da permissão files:read. Peça ao admin do Slack para atualizar o manifesto e reinstalar o app.",
      channelId);
  }
}

/**
 * Conversão de conversa pelo Slack: o técnico/admin que clicou vira o responsável (mesmo com
 * solicitante de outra pessoa), substituindo o responsável automático. Usuário que converte a
 * própria mensagem não define responsável (vai para a fila/automático).
 */
function slackAssignment(clickerIsTechnician: boolean, clickerUserId: string) {
  return clickerIsTechnician ? { assigneeOverride: clickerUserId, actorId: clickerUserId } : { actorId: clickerUserId };
}

async function assigneeName(storage: ReturnType<typeof getStorage>, ticket: Ticket): Promise<string> {
  return ticket.assigneeId ? (await storage.getUser(ticket.assigneeId))?.name ?? "Não atribuído" : "Não atribuído";
}

/** Nota interna dizendo quem converteu a conversa em chamado. */
async function recordConversion(storage: ReturnType<typeof getStorage>, ticket: Ticket, clickerUserId: string, clickerName: string) {
  try {
    await storage.createTicketComment({
      ticketId: ticket.id, tenantId: ticket.tenantId, userId: clickerUserId,
      content: plainTextToHtml(`Chamado criado pelo Slack por ${clickerName}.`), isInternal: true, mentions: [],
    } as any);
  } catch (error) {
    console.error("[slack-chamados] nota de conversão não gravada", error);
  }
}

async function handleShortcut(c: Context<AppEnv>, token: string, payload: any, advanced = false) {
  const clickerSlackId: string = payload.user?.id ?? "";
  const teamId: string | null = payload.team?.id ?? payload.user?.team_id ?? null;
  if (!(await isAllowedSlackTeam(c.env, teamId))) {
    console.warn("[slack-chamados] workspace não autorizado", { teamId });
    return c.body(null, 200);
  }
  const channelId: string | null = payload.channel?.id ?? null;
  const channelName: string | null = payload.channel?.name ?? null;
  const message = payload.message ?? {};
  if (!channelId || !message.ts) {
    await notifyPerson(token, clickerSlackId, "Não consegui identificar a mensagem do Slack para abrir o chamado.", channelId);
    return c.body(null, 200);
  }
  // A conversa começa na raiz da thread (ou na própria mensagem, se não for resposta).
  const rootTs: string = message.thread_ts ?? message.ts;
  const isReply = Boolean(message.thread_ts && message.thread_ts !== message.ts);
  const hasReplies = isReply || Number(message.reply_count ?? 0) > 0;

  const db = c.get("db");
  const storage = getStorage(db);
  // Rápido: lê a conversa inteira já (roda depois da resposta ao Slack).
  // Avançado: só a raiz, com limite de tempo, para abrir a janela nos 3 s do trigger.
  const threadWork: Promise<ThreadLookup> = !hasReplies
    ? Promise.resolve(null)
    : advanced
      ? (isReply ? withTimeout<ThreadLookup>(fetchSlackThread(token, channelId, rootTs, 1), ROOT_LOOKUP_TIMEOUT_MS, { ok: false, error: "timeout" }) : Promise.resolve(null))
      : fetchSlackThread(token, channelId, rootTs);
  const [clicker, rootPermalink, threadLookup] = await Promise.all([
    resolveSlackPerson(db, c.env, clickerSlackId),
    slackApi(token, "chat.getPermalink", { channel: channelId, message_ts: rootTs }),
    threadWork,
  ]);
  if (!clicker.ok) {
    await notifyPerson(token, clickerSlackId, clicker.message, channelId);
    return c.body(null, 200);
  }

  // Sem acesso à conversa (app fora do canal / sem permissão): segue só com a mensagem clicada.
  // Conversa lida mas vazia (thread apagada etc.) também cai na mensagem clicada, sem aviso.
  const lookupFailed = Boolean(threadLookup && (!threadLookup.ok || threadLookup.messages.length === 0));
  if (threadLookup && !threadLookup.ok) {
    await notifyPerson(token, clickerSlackId, `${slackAccessHint(threadLookup.error)} Vai só a mensagem que você escolheu.`, channelId);
  }
  const conversation = hasReplies && !lookupFailed;
  const rootMessage: SlackThreadMessage | null = threadLookup?.ok ? threadLookup.messages[0] ?? null : isReply ? null : message;
  const starter: SlackThreadMessage = conversation && rootMessage ? rootMessage : message;
  const conversationMessages: SlackThreadMessage[] | null = !advanced && conversation && threadLookup?.ok ? threadLookup.messages : null;
  // A mesma conversa não vira dois chamados: a chave é a raiz quando vai a thread inteira.
  const keyTs: string = conversation ? rootTs : message.ts;
  const permalink: string | undefined = conversation || !isReply
    ? (rootPermalink.ok ? rootPermalink.permalink : undefined)
    : await slackApi(token, "chat.getPermalink", { channel: channelId, message_ts: message.ts }).then((r) => (r.ok ? r.permalink : undefined));

  const authorSlackId: string | undefined = starter.user;
  if (!authorSlackId || starter.bot_id || starter.subtype === "bot_message") {
    await notifyPerson(token, clickerSlackId, "Mensagens de bots ou de apps não viram chamado.", channelId);
    return c.body(null, 200);
  }
  const sameAuthor = authorSlackId === clickerSlackId;
  if (!sameAuthor && !isTechnician(clicker.user)) {
    await notifyPerson(token, clickerSlackId, conversation
      ? "Só técnicos podem transformar conversas iniciadas por outras pessoas em chamado."
      : "Só técnicos podem transformar mensagens de outras pessoas em chamado.", channelId);
    return c.body(null, 200);
  }
  const requester = sameAuthor ? clicker : await resolveSlackPerson(db, c.env, authorSlackId);
  if (!requester.ok) {
    await notifyPerson(token, clickerSlackId, `Não dá para abrir o chamado em nome ${conversation ? "de quem começou a conversa" : "do autor"}: ${requester.message}`, channelId);
    return c.body(null, 200);
  }

  if (!sameTenant(clicker.user.tenantId, requester.user.tenantId)) {
    await notifyPerson(token, clickerSlackId, "Sem permissão para abrir chamado para este solicitante.", channelId);
    return c.body(null, 200);
  }
  if (advanced) {
    const starterText = slackMrkdwnToText(starter.text);
    const replies = Number(rootMessage?.reply_count ?? message.reply_count ?? 0);
    const whatGoes = conversation
      ? `A conversa inteira${replies > 0 ? ` (${replies + 1} mensagens)` : ""}, o link e os anexos vão junto no chamado.`
      : hasReplies
        ? "Só a mensagem escolhida vai para o chamado (o app não conseguiu ler a conversa)."
        : "A mensagem, o link e os anexos vão junto no chamado.";
    const opened = await slackApi(token, "views.open", {
      trigger_id: payload.trigger_id,
      view: buildTicketModal({
        metadata: {
          teamId, mode: "shortcut", clickerSlackId, requesterSlackId: authorSlackId, channelId,
          messageTs: keyTs, threadTs: rootTs, channelName, permalink: permalink ?? null, conversation: conversation || !hasReplies,
        },
        title: generateSlackTicketTitle(starterText),
        description: starterText,
        groups: await activeGroups(storage, requester.user.tenantId ?? null),
        showImpact: isTechnician(clicker.user),
        context: `Solicitante: *${requester.user.name}* (${sameAuthor ? "você" : conversation ? "quem começou a conversa" : "autor da mensagem"})\n${whatGoes}`,
      }),
    });
    if (!opened.ok) await notifyPerson(token, clickerSlackId, "Não consegui abrir o formulário avançado. Tente novamente.", channelId);
    return c.body(null, 200);
  }
  await createQuickTicketFromShortcut(c, token, {
    teamId,
    channelId,
    channelName,
    clickerSlackId,
    requesterSlackId: authorSlackId,
    requesterUserId: requester.user.id,
    requesterName: requester.user.name,
    requesterEmail: requester.user.email,
    requesterTenantId: requester.user.tenantId ?? null,
    messageTs: keyTs,
    threadTs: rootTs,
    text: slackTextToPlain(starter.text),
    permalink,
    messages: conversationMessages,
    clickerUserId: clicker.user.id,
    clickerName: clicker.user.name,
    clickerIsTechnician: isTechnician(clicker.user),
  });
  return c.body(null, 200);
}

async function createQuickTicketFromShortcut(c: Context<AppEnv>, token: string, input: {
  teamId: string | null;
  channelId: string;
  channelName: string | null;
  clickerSlackId: string;
  requesterSlackId: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail?: string | null;
  requesterTenantId: string | null;
  messageTs: string;
  threadTs: string;
  text: string;
  permalink?: string;
  /** Conversa inteira (raiz + respostas); null = só a mensagem clicada. */
  messages?: SlackThreadMessage[] | null;
  clickerUserId: string;
  clickerName: string;
  clickerIsTechnician: boolean;
}) {
  const db = c.get("db");
  const storage = getStorage(db);
  const alreadyHas = async (code: string, threadTs: string | null) => {
    const text = `🎫 Esta conversa já possui o chamado *${code}*.`;
    const reply = await slackApi(token, "chat.postMessage", {
      channel: input.channelId, thread_ts: threadTs ?? input.threadTs, text, unfurl_links: false,
    });
    if (!reply.ok) await notifyPerson(token, input.clickerSlackId, text, input.channelId);
  };
  const existing = await findTicketBySlackMessage(db, input.teamId, input.channelId, input.messageTs);
  if (existing) {
    await alreadyHas(existing.code, existing.slackThreadTs);
    return;
  }

  const group = await defaultSlackGroup(storage, input.requesterTenantId);
  if (!group) {
    await notifyPerson(token, input.clickerSlackId, "Não encontrei nenhum grupo de atendimento ativo para abrir o chamado.", input.channelId);
    return;
  }

  let title = generateSlackTicketTitle(input.text);
  let description: string;
  if (input.messages && input.messages.length > 0) {
    const names = await resolveSlackNames(token, input.messages);
    title = generateSlackTicketTitle(slackMrkdwnToText(input.messages[0].text, names)) || title;
    description = sanitizeRichText(`${buildConversationHtml({
      channelName: input.channelName, permalink: input.permalink, messages: input.messages, names,
    })}${plainTextToHtml(slackOriginFooter(input))}`);
  } else {
    description = plainTextToHtml(slackTicketDescription({
      text: input.text,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      channelId: input.channelId,
      channelName: input.channelName,
      permalink: input.permalink,
    }));
  }

  let result;
  try {
    result = await createTicketFor(storage, mailContext(c), {
      userId: input.requesterUserId, isAdmin: false, tenantId: input.requesterTenantId,
    }, {
      code: "",
      title,
      description,
      category: group.key,
      type: "bug",
      impact: DEFAULT_SLACK_IMPACT,
      priority: "medium",
    }, {
      slackTeamId: input.teamId,
      slackChannelId: input.channelId,
      slackThreadTs: input.threadTs,
      slackMessageTs: input.messageTs,
      slackUserId: input.requesterSlackId,
      slackPermalink: input.permalink ?? null,
    }, slackAssignment(input.clickerIsTechnician, input.clickerUserId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await findTicketBySlackMessage(db, input.teamId, input.channelId, input.messageTs);
      if (duplicate) {
        await alreadyHas(duplicate.code, duplicate.slackThreadTs);
        return;
      }
    }
    console.error("[slack-chamados] quick ticket failed", error);
    await notifyPerson(token, input.clickerSlackId, "Não consegui abrir o chamado a partir dessa mensagem. Tente o fluxo avançado.", input.channelId);
    return;
  }

  if (!result.ok) {
    await notifyPerson(token, input.clickerSlackId, `Não consegui abrir o chamado: ${result.error}`, input.channelId);
    return;
  }

  const ticket = result.ticket;
  console.info("[slack-chamados] ticket created", { ticketId: ticket.id, code: ticket.code });
  await recordConversion(storage, ticket, input.clickerUserId, input.clickerName);
  if (input.messages && input.messages.length > 0) {
    await attachConversationFiles(c, token, ticket, input.messages, input.clickerSlackId, input.channelId);
  }
  const link = ticketLink(c.env.APP_URL, ticket.id);
  await confirmInThread(token, {
    channelId: input.channelId,
    threadTs: input.threadTs,
    clickerSlackId: input.clickerSlackId,
    code: ticket.code,
    link,
    text: `🎫 Chamado ${ticket.code} criado com sucesso\n${ticket.title}\nStatus: ${ticketStatusLabel(ticket.status)}\nResponsável: ${await assigneeName(storage, ticket)}\n${link}`,
    blocks: ticketReplyBlocks(ticket, link, true, await assigneeName(storage, ticket)),
  });
}

async function handleBlockActions(c: Context<AppEnv>, token: string, payload: any) {
  const action = payload.actions?.[0];
  const actionId = action?.action_id;
  if (![SLACK_ACTION_CLAIM, SLACK_ACTION_IN_PROGRESS, SLACK_ACTION_RESOLVE].includes(actionId)) return c.body(null, 200);

  const slackUserId: string = payload.user?.id ?? "";
  const teamId: string | null = payload.team?.id ?? payload.user?.team_id ?? null;
  if (!(await isAllowedSlackTeam(c.env, teamId))) {
    console.warn("[slack-chamados] workspace não autorizado", { teamId });
    return c.body(null, 200);
  }
  const channelId: string | null = payload.channel?.id ?? payload.container?.channel_id ?? null;
  const db = c.get("db");
  const storage = getStorage(db);
  const person = await resolveSlackPerson(db, c.env, slackUserId);
  if (!person.ok) {
    await notifyPerson(token, slackUserId, person.message, channelId);
    return c.body(null, 200);
  }
  if (!isTechnician(person.user)) {
    await notifyPerson(token, slackUserId, "Só técnicos podem atualizar chamados pelo Slack.", channelId);
    return c.body(null, 200);
  }

  const ticketId = String(action.value ?? "");
  const ticket = await storage.getTicket(ticketId);
  if (!ticket || ticket.slackTeamId !== teamId || ticket.slackChannelId !== channelId ||
      !(await canViewTicket(storage, { userId: person.user.id, isAdmin: person.user.isAdmin === true, tenantId: person.user.tenantId ?? null }, ticket))) {
    await notifyPerson(token, slackUserId, "Não encontrei esse chamado.", channelId);
    return c.body(null, 200);
  }
  if (actionId === SLACK_ACTION_RESOLVE && !ticket.assigneeId) {
    await notifyPerson(token, slackUserId, "Assuma o chamado antes de resolver.", channelId);
    return c.body(null, 200);
  }
  if (actionId === SLACK_ACTION_CLAIM) {
    await storage.updateTicket(ticket.id, { assigneeId: person.user.id });
    await notifyPerson(token, slackUserId, `Você assumiu o chamado *${ticket.code}*.`, channelId);
  } else if (actionId === SLACK_ACTION_IN_PROGRESS) {
    await storage.updateTicket(ticket.id, { status: "in_progress", dataResolucao: null, ...slaPauseUpdate(ticket, "in_progress") });
    await notifyPerson(token, slackUserId, `Chamado *${ticket.code}* movido para Em atendimento.`, channelId);
  } else if (actionId === SLACK_ACTION_RESOLVE) {
    await storage.updateTicket(ticket.id, { status: "resolved", dataResolucao: new Date(), ...slaPauseUpdate(ticket, "resolved") });
    await notifyPerson(token, slackUserId, `Chamado *${ticket.code}* resolvido.`, channelId);
  }
  const updated = await storage.getTicket(ticket.id);
  if (updated && payload.message?.ts && channelId) {
    const assignee = updated.assigneeId ? await storage.getUser(updated.assigneeId) : null;
    await slackApi(token, "chat.update", {
      channel: channelId, ts: payload.message.ts,
      text: `🎫 ${updated.code} — ${updated.title} — ${ticketStatusLabel(updated.status)}`,
      blocks: JSON.stringify(ticketReplyBlocks(updated, ticketLink(c.env.APP_URL, updated.id), false, assignee?.name ?? "Não atribuído")),
    });
  }
  return c.body(null, 200);
}

/**
 * Fluxo avançado: texto da janela + a conversa inteira lida no envio (assim entram também as
 * respostas mandadas enquanto a janela estava aberta).
 */
async function advancedDescription(
  token: string,
  meta: NonNullable<ReturnType<typeof parseModalMetadata>>,
  typed: string,
): Promise<{ html: string; messages: SlackThreadMessage[]; error?: string }> {
  const fallback = (error?: string) => ({
    html: plainTextToHtml(meta.permalink ? `${typed}\n\nMensagem original no Slack: ${meta.permalink}` : typed),
    messages: [] as SlackThreadMessage[],
    error,
  });
  if (!meta.conversation || !meta.channelId || !meta.threadTs) return fallback();
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
  const clicker = await resolveSlackPerson(c.get("db"), c.env, payload.user?.id ?? "");
  if (!clicker.ok) return c.text("Usuário não autorizado", 403);
  const meta = parseModalMetadata(payload.view?.private_metadata);
  if (!meta || meta.clickerSlackId !== payload.user?.id) return c.text("Usuário não autorizado", 403);
  meta.teamId = payload.team?.id ?? payload.user?.team_id;
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
  if (!clickerUser || !sameTenant(clickerUser.tenantId, requester.user.tenantId) ||
      (meta.clickerSlackId !== meta.requesterSlackId && !isTechnician(clickerUser))) return;
  // Gravidade: só técnico/admin escolhe; Usuário fica com "Médio" (mesma regra do formulário).
  const impact = clickerUser && isTechnician(clickerUser) && values.impact ? values.impact : DEFAULT_SLACK_IMPACT;

  if (meta.mode === "shortcut" && meta.channelId && meta.messageTs) {
    const existing = await findTicketBySlackMessage(db, meta.teamId ?? null, meta.channelId, meta.messageTs);
    if (existing) {
      await notifyPerson(token, meta.clickerSlackId, `🎫 Esta mensagem já possui o chamado ${existing.code}.`, meta.channelId);
      return;
    }
  }
  const fromSlack = meta.mode === "shortcut" ? await advancedDescription(token, meta, values.description) : null;
  if (fromSlack?.error) {
    await notifyPerson(token, meta.clickerSlackId, `${slackAccessHint(fromSlack.error)} O chamado vai com a mensagem escolhida.`, meta.channelId);
  }

  let result;
  try { result = await createTicketFor(storage, mailContext(c), {
    userId: requester.user.id, isAdmin: requester.user.isAdmin === true, tenantId: requester.user.tenantId ?? null,
  }, {
    code: "",
    title: values.title,
    description: fromSlack?.html ?? plainTextToHtml(values.description),
    category: values.category,
    type: values.type,
    impact,
    priority: "medium",
  }, meta.mode === "shortcut" ? {
    slackTeamId: meta.teamId, slackChannelId: meta.channelId, slackMessageTs: meta.messageTs,
    slackThreadTs: meta.threadTs ?? meta.messageTs, slackUserId: meta.requesterSlackId,
    slackPermalink: meta.permalink ?? null,
  } : {}, meta.mode === "shortcut" ? slackAssignment(isTechnician(clickerUser), clickerUser.id) : {});
  } catch (error) {
    if (isUniqueViolation(error) && meta.channelId && meta.messageTs) {
      const existing = await findTicketBySlackMessage(db, meta.teamId ?? null, meta.channelId, meta.messageTs);
      if (existing) {
        await notifyPerson(token, meta.clickerSlackId, `🎫 Esta mensagem já possui o chamado ${existing.code}.`, meta.channelId);
        return;
      }
    }
    console.error("[slack-chamados] advanced ticket failed", error);
    await notifyPerson(token, meta.clickerSlackId, "Não consegui criar o chamado. Tente novamente.", meta.channelId);
    return;
  }
  if (!result.ok) {
    await notifyPerson(token, meta.clickerSlackId, `Não consegui abrir o chamado: ${result.error}`, meta.channelId);
    return;
  }

  const ticket = result.ticket;
  console.info("[slack-chamados] ticket created", { ticketId: ticket.id, code: ticket.code });
  const link = ticketLink(c.env.APP_URL, ticket.id);
  if (meta.mode === "shortcut" && meta.channelId) {
    await recordConversion(storage, ticket, clickerUser.id, clickerUser.name);
    if (fromSlack && fromSlack.messages.length > 0) {
      await attachConversationFiles(c, token, ticket, fromSlack.messages, meta.clickerSlackId, meta.channelId);
    }
    await confirmInThread(token, {
      channelId: meta.channelId,
      threadTs: meta.threadTs ?? meta.messageTs ?? "",
      clickerSlackId: meta.clickerSlackId,
      code: ticket.code,
      link,
      text: `Virou o chamado *${ticket.code}*: <${link}|${ticket.title}>\nResponsável: ${await assigneeName(storage, ticket)}`,
      blocks: ticketReplyBlocks(ticket, link, true, await assigneeName(storage, ticket)),
    });
    return;
  }
  await notifyPerson(token, meta.clickerSlackId, `Chamado *${ticket.code}* aberto ✅ <${link}|Ver chamado>`, meta.channelId);
}

// Event API: signature and workspace checks also apply to URL verification.
slack.post("/api/slack/events", async (c) => {
  const raw = await readSignedBody(c);
  if (raw === null) return c.text("Assinatura inválida", 401);
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return c.text("payload inválido", 400); }
  if (payload.type === "url_verification") return c.json({ challenge: payload.challenge });
  if (!(await isAllowedSlackTeam(c.env, payload.team_id))) return c.text("Workspace não autorizado", 403);
  if (payload.type === "event_callback" && c.env.SLACK_THREAD_SYNC_ENABLED === "true") {
    await afterResponse(c, recordSlackThreadMessage(c.get("db"), c.env, payload.team_id, payload.event));
  }
  return c.body(null, 200);
});
