/**
 * server/services/slack-notifier.service.ts
 *
 * Orquestração entre eventos do Renov Home e o Slack. Esta é a camada que
 * os hooks das rotas chamam (em Express e em Cloudflare Worker). Lida com:
 *  - Buscar/criar mapping na tabela slack_thread_mapping (idempotência)
 *  - Decidir entre mensagem-mãe vs reply em thread
 *  - Aplicar regras de visibilidade (projetos `private` NÃO vão para o canal)
 *  - Resolver Slack user IDs on-demand a partir do email corporativo
 *
 * Regras de design:
 *  - Funções puras do ponto de vista de runtime: recebem `{ db, env }` por
 *    parâmetro. Funcionam tanto no Express (NodePgDatabase) quanto no
 *    Worker (NeonHttpDatabase) porque a API Drizzle é a mesma.
 *  - TODAS as funções têm try/catch interno que NUNCA propaga erro.
 *    Slack indisponível ⇒ silencioso, fluxo principal segue normal.
 *  - Logs com prefixo "[slack-notifier]" para grep fácil.
 *  - Caller (rota) é responsável por agendar fire-and-forget:
 *      * Express: setImmediate(() => notify…)
 *      * Worker:  c.executionCtx.waitUntil(notify…)
 */

import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../shared/schema";
import {
  slackThreadMapping,
  tickets,
  projects,
  kanbanCards,
  users,
} from "../../shared/schema";
import type {
  Ticket,
  Project,
  KanbanCard,
  User,
  SlackEntityType,
} from "../../shared/schema";
import {
  sendChannelMessage,
  sendThreadReply,
  sendDirectMessage,
  addReaction,
  resolveSlackUserIdByEmail,
  isSlackEnabled,
  type SlackEnv,
} from "./slack.service";
import {
  buildChamadoCriadoBlocks,
  buildProjetoCriadoBlocks,
  buildAtividadeCriadaBlocks,
  buildChamadoFechadoText,
  buildAtribuicaoText,
  buildAtividadeMovidaText,
  buildAtividadeConcluidaText,
  buildAlertaCriticoText,
  buildDmAtribuicaoChamado,
  buildDmAtividadeUrgente,
} from "./slack-templates.service";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drizzle DB instance — Express usa NodePgDatabase, Worker usa NeonHttpDatabase.
 * Ambos expõem a mesma API de query builder.
 */
export type SlackDb =
  | NodePgDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

export type NotifierDeps = {
  db: SlackDb;
  env: SlackEnv;
};

// Mapeamento PT-BR para status de atividades (display em Slack).
const STATUS_PT_BR: Record<string, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluído",
  blocked: "Bloqueado",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos (DB)
// ─────────────────────────────────────────────────────────────────────────────

async function getThreadMapping(
  db: SlackDb,
  entityType: SlackEntityType,
  entityId: string,
): Promise<{ slackChannel: string; slackThreadTs: string } | null> {
  const rows = await db
    .select()
    .from(slackThreadMapping)
    .where(
      and(
        eq(slackThreadMapping.entityType, entityType),
        eq(slackThreadMapping.entityId, entityId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { slackChannel: row.slackChannel, slackThreadTs: row.slackThreadTs };
}

async function saveThreadMapping(
  db: SlackDb,
  input: {
    entityType: SlackEntityType;
    entityId: string;
    entityCode: string;
    slackChannel: string;
    slackThreadTs: string;
  },
): Promise<void> {
  await db.insert(slackThreadMapping).values(input);
}

async function getUserById(db: SlackDb, id: string): Promise<User | null> {
  if (!id) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] || null;
}

async function getTicket(db: SlackDb, id: string): Promise<Ticket | null> {
  const rows = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return rows[0] || null;
}

async function getProject(db: SlackDb, id: string): Promise<Project | null> {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] || null;
}

async function getKanbanCard(db: SlackDb, id: string): Promise<KanbanCard | null> {
  const rows = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id)).limit(1);
  return rows[0] || null;
}

/**
 * Resolve Slack user ID para um usuário Renov. Cacheia em users.slack_user_id
 * após primeira resolução bem-sucedida.
 */
async function resolveSlackIdForUser(
  deps: NotifierDeps,
  user: Pick<User, "id" | "email" | "slackUserId">,
): Promise<string | null> {
  if (user.slackUserId) return user.slackUserId;
  if (!user.email) return null;
  const slackId = await resolveSlackUserIdByEmail(deps.env, user.email);
  if (!slackId) return null;
  // Cache para próximas chamadas. Falha silenciosa (não-crítica).
  try {
    await deps.db.update(users).set({ slackUserId: slackId }).where(eq(users.id, user.id));
  } catch (error: unknown) {
    console.warn("[slack-notifier] Falha ao cachear slackUserId:", getErrorMessage(error));
  }
  return slackId;
}

function getChannel(env: SlackEnv): string | null {
  const channel = env.SLACK_CHANNEL_DEVS;
  if (!channel) {
    console.warn("[slack-notifier] SLACK_CHANNEL_DEVS não configurado.");
    return null;
  }
  return channel;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública — eventos de chamados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notifica criação de novo chamado no canal #devs-renov.
 * Cria mensagem-mãe + salva mapping. Se prioridade=critical, envia
 * mensagem adicional com @here.
 */
export async function notifyChamadoCriado(
  deps: NotifierDeps,
  chamadoId: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const channel = getChannel(deps.env);
    if (!channel) return;

    const chamado = await getTicket(deps.db, chamadoId);
    if (!chamado) {
      console.warn(`[slack-notifier] notifyChamadoCriado: chamado ${chamadoId} não encontrado`);
      return;
    }
    // Idempotência: se já tem mapping (re-execução), pula.
    const existing = await getThreadMapping(deps.db, "chamado", chamadoId);
    if (existing) {
      console.log(`[slack-notifier] notifyChamadoCriado: ${chamado.code} já mapeado, pulando`);
      return;
    }

    const autor = chamado.requesterId
      ? await getUserById(deps.db, chamado.requesterId)
      : null;

    const { text, blocks } = buildChamadoCriadoBlocks({ chamado, autor });
    const sent = await sendChannelMessage(deps.env, { channel, text, blocks });
    if (!sent) return;

    await saveThreadMapping(deps.db, {
      entityType: "chamado",
      entityId: chamado.id,
      entityCode: chamado.code,
      slackChannel: channel,
      slackThreadTs: sent.ts,
    });
    console.log(`[slack-notifier] Chamado ${chamado.code} → Slack thread ${sent.ts}`);

    // Alerta crítico em mensagem separada (na thread, com @here)
    if (chamado.priority === "critical") {
      await sendThreadReply(deps.env, {
        channel,
        thread_ts: sent.ts,
        text: buildAlertaCriticoText(chamado.code),
      });
    }
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyChamadoCriado falhou:", getErrorMessage(error));
  }
}

/**
 * Notifica atribuição de chamado a um responsável.
 * Posta reply na thread, adiciona reação 🙋 na mensagem-mãe e DM ao responsável.
 */
export async function notifyChamadoAtribuido(
  deps: NotifierDeps,
  chamadoId: string,
  novoResponsavelId: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const mapping = await getThreadMapping(deps.db, "chamado", chamadoId);
    if (!mapping) {
      // Chamado criado antes da integração ou sem mapping — nada a fazer.
      return;
    }
    const [chamado, responsavel] = await Promise.all([
      getTicket(deps.db, chamadoId),
      getUserById(deps.db, novoResponsavelId),
    ]);
    if (!chamado || !responsavel) return;

    // Reply + reação na thread/mensagem-mãe.
    await Promise.all([
      sendThreadReply(deps.env, {
        channel: mapping.slackChannel,
        thread_ts: mapping.slackThreadTs,
        text: buildAtribuicaoText(chamado.code, responsavel),
      }),
      addReaction(deps.env, {
        channel: mapping.slackChannel,
        timestamp: mapping.slackThreadTs,
        emoji: "raising_hand",
      }),
    ]);

    // DM ao responsável (best-effort).
    const slackId = await resolveSlackIdForUser(deps, responsavel);
    if (slackId) {
      const dm = buildDmAtribuicaoChamado({
        chamadoCode: chamado.code,
        titulo: chamado.title,
      });
      await sendDirectMessage(deps.env, {
        slackUserId: slackId,
        text: dm.text,
        blocks: dm.blocks,
      });
    }
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyChamadoAtribuido falhou:", getErrorMessage(error));
  }
}

/**
 * Notifica fechamento de chamado.
 * Reply na thread + reação ✅ na mensagem-mãe.
 */
export async function notifyChamadoFechado(
  deps: NotifierDeps,
  chamadoId: string,
  fechadoPorId: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const mapping = await getThreadMapping(deps.db, "chamado", chamadoId);
    if (!mapping) return;

    const [chamado, fechadoPor] = await Promise.all([
      getTicket(deps.db, chamadoId),
      getUserById(deps.db, fechadoPorId),
    ]);
    if (!chamado) return;

    await Promise.all([
      sendThreadReply(deps.env, {
        channel: mapping.slackChannel,
        thread_ts: mapping.slackThreadTs,
        text: buildChamadoFechadoText(chamado, fechadoPor),
      }),
      addReaction(deps.env, {
        channel: mapping.slackChannel,
        timestamp: mapping.slackThreadTs,
        emoji: "white_check_mark",
      }),
    ]);
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyChamadoFechado falhou:", getErrorMessage(error));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública — eventos de projetos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notifica criação de novo projeto.
 * IMPORTANTE: projetos com visibility='private' NÃO são postados no canal.
 * (Política de visibilidade — projetos privados não vazam para devs-renov.)
 */
export async function notifyProjetoCriado(
  deps: NotifierDeps,
  projetoId: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const channel = getChannel(deps.env);
    if (!channel) return;

    const projeto = await getProject(deps.db, projetoId);
    if (!projeto) {
      console.warn(`[slack-notifier] notifyProjetoCriado: projeto ${projetoId} não encontrado`);
      return;
    }

    // Política de visibilidade — private fica fora do canal público.
    if (projeto.visibility === "private") {
      console.log(`[slack-notifier] Projeto ${projeto.code} é private — não postando no canal`);
      return;
    }

    const existing = await getThreadMapping(deps.db, "projeto", projetoId);
    if (existing) {
      console.log(`[slack-notifier] notifyProjetoCriado: ${projeto.code} já mapeado, pulando`);
      return;
    }

    const owner = projeto.ownerId
      ? await getUserById(deps.db, projeto.ownerId)
      : null;

    const { text, blocks } = buildProjetoCriadoBlocks({ projeto, owner });
    const sent = await sendChannelMessage(deps.env, { channel, text, blocks });
    if (!sent) return;

    await saveThreadMapping(deps.db, {
      entityType: "projeto",
      entityId: projeto.id,
      entityCode: projeto.code,
      slackChannel: channel,
      slackThreadTs: sent.ts,
    });
    console.log(`[slack-notifier] Projeto ${projeto.code} → Slack thread ${sent.ts}`);
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyProjetoCriado falhou:", getErrorMessage(error));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública — eventos de atividades (kanban_cards)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notifica criação de nova atividade.
 * Atividades NUNCA criam mensagem-mãe — sempre replicam na thread do projeto pai.
 * Se o projeto pai não tem mapping (private ou criado antes da integração),
 * a notificação é silenciosamente pulada.
 *
 * Atividades com prioridade urgente/muito_urgente também enviam DM ao responsável.
 */
export async function notifyAtividadeCriada(
  deps: NotifierDeps,
  cardId: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const card = await getKanbanCard(deps.db, cardId);
    if (!card) return;

    const projeto = await getProject(deps.db, card.projectId);
    if (!projeto) return;

    const mapping = await getThreadMapping(deps.db, "projeto", projeto.id);
    if (!mapping) {
      // Projeto sem mapping — private, ou criado antes da integração.
      return;
    }

    const responsavel = card.assigneeId
      ? await getUserById(deps.db, card.assigneeId)
      : null;

    const { text, blocks } = buildAtividadeCriadaBlocks({
      atividade: card,
      projeto,
      responsavel,
    });

    await sendThreadReply(deps.env, {
      channel: mapping.slackChannel,
      thread_ts: mapping.slackThreadTs,
      text,
      blocks,
    });

    // DM se urgente/muito_urgente e há responsável.
    const isUrgent = ["urgente", "muito_urgente", "critica", "critical"].includes(
      (card.priority || "").toLowerCase(),
    );
    if (isUrgent && responsavel) {
      const slackId = await resolveSlackIdForUser(deps, responsavel);
      if (slackId) {
        const dm = buildDmAtividadeUrgente({
          atividadeCode: card.code,
          titulo: card.title,
          projetoCode: projeto.code,
        });
        await sendDirectMessage(deps.env, {
          slackUserId: slackId,
          text: dm.text,
          blocks: dm.blocks,
        });
      }
    }
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyAtividadeCriada falhou:", getErrorMessage(error));
  }
}

/**
 * Notifica movimentação de atividade no kanban (mudança de status).
 * Reply curta na thread do projeto pai.
 */
export async function notifyAtividadeMovida(
  deps: NotifierDeps,
  cardId: string,
  novoStatus: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const card = await getKanbanCard(deps.db, cardId);
    if (!card) return;
    const mapping = await getThreadMapping(deps.db, "projeto", card.projectId);
    if (!mapping) return;

    const statusPtBr = STATUS_PT_BR[novoStatus] || novoStatus;
    await sendThreadReply(deps.env, {
      channel: mapping.slackChannel,
      thread_ts: mapping.slackThreadTs,
      text: buildAtividadeMovidaText(card, statusPtBr),
    });
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyAtividadeMovida falhou:", getErrorMessage(error));
  }
}

/**
 * Notifica conclusão de atividade.
 * Reply na thread do projeto pai (sem reação na mensagem-mãe — a reação ✅
 * fica reservada para quando o projeto inteiro for fechado).
 */
export async function notifyAtividadeConcluida(
  deps: NotifierDeps,
  cardId: string,
): Promise<void> {
  if (!isSlackEnabled(deps.env)) return;
  try {
    const card = await getKanbanCard(deps.db, cardId);
    if (!card) return;
    const mapping = await getThreadMapping(deps.db, "projeto", card.projectId);
    if (!mapping) return;

    await sendThreadReply(deps.env, {
      channel: mapping.slackChannel,
      thread_ts: mapping.slackThreadTs,
      text: buildAtividadeConcluidaText(card),
    });
  } catch (error: unknown) {
    console.error("[slack-notifier] notifyAtividadeConcluida falhou:", getErrorMessage(error));
  }
}
