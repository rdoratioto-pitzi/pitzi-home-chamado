// worker/src/routes/slack.ts
//
// Slack → chamado (fase 1):
//  - /chamado [texto]: abre a janela de abertura; o solicitante é quem digitou.
//  - atalho de mensagem "Transformar em chamado": cria o chamado direto com texto, autor e
//    thread da mensagem. Só técnicos/admins usam em mensagem de outra pessoa.
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
  const authorSlackId: string | undefined = message.user;
  if (!authorSlackId || message.bot_id || message.subtype === "bot_message") {
    await notifyPerson(token, clickerSlackId, "Mensagens de bots ou de apps não viram chamado.", channelId);
    return c.body(null, 200);
  }
  if (!channelId || !message.ts) {
    await notifyPerson(token, clickerSlackId, "Não consegui identificar a mensagem do Slack para abrir o chamado.", channelId);
    return c.body(null, 200);
  }

  const db = c.get("db");
  const storage = getStorage(db);
  const sameAuthor = authorSlackId === clickerSlackId;
  const [clicker, author, permalink] = await Promise.all([
    resolveSlackPerson(db, c.env, clickerSlackId),
    sameAuthor ? Promise.resolve(null) : resolveSlackPerson(db, c.env, authorSlackId),
    channelId ? slackApi(token, "chat.getPermalink", { channel: channelId, message_ts: message.ts }) : Promise.resolve(null),
  ]);
  if (!clicker.ok) {
    await notifyPerson(token, clickerSlackId, clicker.message, channelId);
    return c.body(null, 200);
  }
  if (!sameAuthor && !isTechnician(clicker.user)) {
    await notifyPerson(token, clickerSlackId, "Só técnicos podem transformar mensagens de outras pessoas em chamado.", channelId);
    return c.body(null, 200);
  }
  const requester = sameAuthor ? clicker : author!;
  if (!requester.ok) {
    await notifyPerson(token, clickerSlackId, `Não dá para abrir o chamado em nome do autor: ${requester.message}`, channelId);
    return c.body(null, 200);
  }

  if (!sameTenant(clicker.user.tenantId, requester.user.tenantId)) {
    await notifyPerson(token, clickerSlackId, "Sem permissão para abrir chamado para este solicitante.", channelId);
    return c.body(null, 200);
  }
  if (advanced) {
    const opened = await slackApi(token, "views.open", {
      trigger_id: payload.trigger_id,
      view: buildTicketModal({
        metadata: { teamId, mode: "shortcut", clickerSlackId, requesterSlackId: authorSlackId, channelId, messageTs: message.ts, threadTs: message.thread_ts ?? message.ts },
        title: generateSlackTicketTitle(slackTextToPlain(message.text)),
        description: slackTextToPlain(message.text),
        groups: await activeGroups(storage, requester.user.tenantId ?? null),
        showImpact: isTechnician(clicker.user),
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
    messageTs: message.ts,
    threadTs: message.thread_ts ?? message.ts,
    text: slackTextToPlain(message.text),
    permalink: permalink?.ok ? permalink.permalink : undefined,
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
}) {
  const db = c.get("db");
  const storage = getStorage(db);
  const existing = await findTicketBySlackMessage(db, input.teamId, input.channelId, input.messageTs);
  if (existing) {
    await slackApi(token, "chat.postMessage", {
      channel: input.channelId,
      thread_ts: existing.slackThreadTs ?? input.threadTs,
      text: `🎫 Esta mensagem já possui o chamado *${existing.code}*.`,
      unfurl_links: false,
    });
    return;
  }

  const group = await defaultSlackGroup(storage, input.requesterTenantId);
  if (!group) {
    await notifyPerson(token, input.clickerSlackId, "Não encontrei nenhum grupo de atendimento ativo para abrir o chamado.", input.channelId);
    return;
  }

  const title = generateSlackTicketTitle(input.text);
  let result;
  try {
    result = await createTicketFor(storage, mailContext(c), {
      userId: input.requesterUserId, isAdmin: false, tenantId: input.requesterTenantId,
    }, {
      code: "",
      title,
      description: plainTextToHtml(slackTicketDescription({
        text: input.text,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        channelId: input.channelId,
        channelName: input.channelName,
        permalink: input.permalink,
      })),
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
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await findTicketBySlackMessage(db, input.teamId, input.channelId, input.messageTs);
      if (duplicate) {
        await slackApi(token, "chat.postMessage", {
          channel: input.channelId,
          thread_ts: duplicate.slackThreadTs ?? input.threadTs,
          text: `🎫 Esta mensagem já possui o chamado *${duplicate.code}*.`,
          unfurl_links: false,
        });
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
  const link = ticketLink(c.env.APP_URL, ticket.id);
  const reply = await slackApi(token, "chat.postMessage", {
    channel: input.channelId,
    thread_ts: input.threadTs,
    text: `🎫 Chamado ${ticket.code} criado com sucesso\n${ticket.title}\nStatus: ${ticketStatusLabel(ticket.status)}\n${link}`,
    blocks: JSON.stringify(ticketReplyBlocks(ticket, link, true, ticket.assigneeId ? (await storage.getUser(ticket.assigneeId))?.name ?? "Não atribuído" : "Não atribuído")),
    unfurl_links: false,
  });
  if (!reply.ok) {
    await notifyPerson(token, input.clickerSlackId,
      `Chamado *${ticket.code}* aberto ✅ <${link}|Ver chamado>. Não consegui responder na conversa: convide o app *Chamados Pitzi* neste canal.`,
      input.channelId);
  }
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
  let result;
  try { result = await createTicketFor(storage, mailContext(c), {
    userId: requester.user.id, isAdmin: requester.user.isAdmin === true, tenantId: requester.user.tenantId ?? null,
  }, {
    code: "",
    title: values.title,
    description: plainTextToHtml(values.description),
    category: values.category,
    type: values.type,
    impact,
    priority: "medium",
  }, meta.mode === "shortcut" ? {
    slackTeamId: meta.teamId, slackChannelId: meta.channelId, slackMessageTs: meta.messageTs,
    slackThreadTs: meta.threadTs ?? meta.messageTs, slackUserId: meta.requesterSlackId,
  } : {});
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
    await storage.updateTicket(ticket.id, {
      slackChannelId: meta.channelId, slackThreadTs: meta.threadTs ?? null, slackMessageTs: meta.messageTs ?? null,
    });
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
