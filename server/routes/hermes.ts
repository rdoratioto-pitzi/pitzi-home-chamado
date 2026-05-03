/**
 * server/routes/hermes.ts
 *
 * Endpoints da Fase 3 do Hermes:
 *  - POST /api/integrations/hermes/thread-registered
 *      Hermes (Routine) chama após postar mensagem-mãe no Slack para registrar
 *      o mapping chamado <-> thread. Auth: Bearer token de service account.
 *  - POST /api/integrations/slack/interactions
 *      Slack chama quando o humano clica num botão (block_actions) ou submete
 *      o modal de ajuste (view_submission). Auth: signature HMAC-SHA256.
 *
 * Espelhado em worker/src/routes/hermes.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db as maybeDb } from "../db";
import { users, tickets, hermesSlackThreads } from "@shared/schema";

// db é tipado como nullable em server/db.ts pra suportar DEV sem Postgres,
// mas em runtime o serviço só sobe com DATABASE_URL setada — non-null aqui é
// consistente com server/storage.ts.
const db = maybeDb!;

// ─────────────────────────────────────────────────────────────────────────────
// Bearer-token auth para service accounts (ex.: hermes@renov.com)
// ─────────────────────────────────────────────────────────────────────────────

async function authenticateServiceAccount(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.apiTokenHash, hash));
  if (!user) return null;
  if (user.authMethod !== "token") return null;
  if (user.apiTokenExpiresAt && user.apiTokenExpiresAt.getTime() < Date.now()) {
    return null;
  }
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack signature verification — HMAC-SHA256("v0:" + ts + ":" + body)
// ─────────────────────────────────────────────────────────────────────────────

function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  if (!signingSecret || !rawBody || !timestamp || !signature) return false;

  // Replay protection: reject timestamps mais velhos que 5 min
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > 60 * 5) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed =
    "v0=" +
    createHmac("sha256", signingSecret).update(baseString).digest("hex");

  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack helpers (post message)
// ─────────────────────────────────────────────────────────────────────────────

async function postSlackThreadReply(
  botToken: string,
  channel: string,
  threadTs: string,
  text: string,
): Promise<void> {
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, thread_ts: threadTs, text }),
    });
    const data = (await response.json().catch(() => ({}))) as any;
    if (!response.ok || !data?.ok) {
      console.error(
        "[hermes-interactions] Falha ao postar reply Slack:",
        response.status,
        data?.error || "",
      );
    }
  } catch (err) {
    console.error("[hermes-interactions] Erro de rede ao postar reply:", err);
  }
}

async function openSlackModal(
  botToken: string,
  triggerId: string,
  chamadoId: string,
  channelId: string,
  threadTs: string,
): Promise<void> {
  // private_metadata carrega o contexto necessário pra correlacionar
  // o view_submission de volta com a thread/chamado.
  const privateMetadata = JSON.stringify({
    chamado_id: chamadoId,
    channel_id: channelId,
    thread_ts: threadTs,
  });

  const view = {
    type: "modal",
    callback_id: "hermes_ajuste_modal",
    private_metadata: privateMetadata,
    title: { type: "plain_text", text: "Solicitar ajuste" },
    submit: { type: "plain_text", text: "Enviar" },
    close: { type: "plain_text", text: "Cancelar" },
    blocks: [
      {
        type: "input",
        block_id: "feedback_block",
        label: {
          type: "plain_text",
          text: "O que precisa ser ajustado na análise do Hermes?",
        },
        element: {
          type: "plain_text_input",
          action_id: "feedback_input",
          multiline: true,
        },
      },
    ],
  };

  try {
    const response = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger_id: triggerId, view }),
    });
    const data = (await response.json().catch(() => ({}))) as any;
    if (!response.ok || !data?.ok) {
      console.error(
        "[hermes-interactions] Falha ao abrir modal Slack:",
        response.status,
        data?.error || "",
      );
    }
  } catch (err) {
    console.error("[hermes-interactions] Erro de rede ao abrir modal:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const threadRegisteredSchema = z.object({
  chamado_id: z.string().uuid(),
  thread_ts: z.string().min(1),
  channel_id: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Rotas
// ─────────────────────────────────────────────────────────────────────────────

export function registerHermesRoutes(router: Router) {
  // ── POST /api/integrations/hermes/thread-registered ─────────────────────
  router.post("/api/integrations/hermes/thread-registered", async (req, res) => {
    try {
      const user = await authenticateServiceAccount(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ error: "Bearer token inválido ou ausente" });
      }

      const parsed = threadRegisteredSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: parsed.error.errors });
      }
      const { chamado_id, thread_ts, channel_id } = parsed.data;

      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(eq(tickets.id, chamado_id));
      if (!ticket) {
        return res.status(404).json({ error: "Chamado não encontrado" });
      }

      // Upsert: se já existe linha pra esse chamado, atualiza thread/channel
      const now = new Date();
      const [existing] = await db
        .select()
        .from(hermesSlackThreads)
        .where(eq(hermesSlackThreads.chamadoId, chamado_id));

      let row;
      if (existing) {
        const [updated] = await db
          .update(hermesSlackThreads)
          .set({ threadTs: thread_ts, channelId: channel_id, updatedAt: now })
          .where(eq(hermesSlackThreads.chamadoId, chamado_id))
          .returning();
        row = updated;
      } else {
        const [inserted] = await db
          .insert(hermesSlackThreads)
          .values({
            chamadoId: chamado_id,
            threadTs: thread_ts,
            channelId: channel_id,
          })
          .returning();
        row = inserted;
      }

      console.log(
        `[hermes-thread-registered] chamado=${chamado_id} thread=${thread_ts} channel=${channel_id} actor=${user.email}`,
      );

      return res.status(201).json({
        id: row.id,
        chamado_id: row.chamadoId,
        thread_ts: row.threadTs,
        channel_id: row.channelId,
      });
    } catch (error) {
      console.error("[hermes-thread-registered] erro:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/integrations/slack/interactions ──────────────────────────
  router.post("/api/integrations/slack/interactions", async (req, res) => {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    const botToken = process.env.SLACK_BOT_TOKEN;

    if (!signingSecret) {
      console.error("[hermes-interactions] SLACK_SIGNING_SECRET ausente");
      return res.status(500).send("");
    }

    const rawBody =
      (req as any).rawBody instanceof Buffer
        ? ((req as any).rawBody as Buffer).toString("utf8")
        : "";
    const timestamp = req.headers["x-slack-request-timestamp"] as string | undefined;
    const signature = req.headers["x-slack-signature"] as string | undefined;

    if (!verifySlackSignature(signingSecret, rawBody, timestamp || "", signature || "")) {
      return res.status(401).send("");
    }

    let payload: any;
    try {
      // O body chega URL-encoded com campo "payload"=<json>. O Express já
      // parseou em req.body via urlencoded middleware.
      const payloadStr =
        (req.body && req.body.payload) ||
        new URLSearchParams(rawBody).get("payload");
      if (!payloadStr) return res.status(400).send("");
      payload = JSON.parse(payloadStr);
    } catch (err) {
      console.error("[hermes-interactions] payload inválido:", err);
      return res.status(400).send("");
    }

    // Slack tem timeout de 3s — retornar 200 imediato e processar async.
    res.status(200).send("");

    handleSlackInteraction(payload, botToken).catch((err) => {
      console.error("[hermes-interactions] erro async:", err);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler async das interactions (compartilhado conceitualmente com Worker)
// ─────────────────────────────────────────────────────────────────────────────

async function handleSlackInteraction(
  payload: any,
  botToken: string | undefined,
): Promise<void> {
  const userId: string = payload?.user?.id || "desconhecido";
  const userName: string = payload?.user?.username || payload?.user?.name || userId;

  if (payload?.type === "block_actions") {
    const action = payload.actions?.[0];
    if (!action) return;
    const actionId: string = action.action_id;
    const chamadoId: string = action.value;
    const threadTs: string = payload.message?.ts || "";
    const channelId: string = payload.channel?.id || "";

    // Lookup do mapping pra anti-spoof: confirmar que thread/channel batem
    const [mapping] = await db
      .select()
      .from(hermesSlackThreads)
      .where(eq(hermesSlackThreads.chamadoId, chamadoId));
    if (!mapping) {
      console.warn(
        `[hermes-interactions] mapping não encontrado p/ chamado=${chamadoId}`,
      );
      return;
    }
    if (mapping.threadTs !== threadTs || mapping.channelId !== channelId) {
      console.warn(
        `[hermes-interactions] thread/channel mismatch chamado=${chamadoId} ` +
          `expected=${mapping.threadTs}/${mapping.channelId} ` +
          `got=${threadTs}/${channelId}`,
      );
      return;
    }

    if (actionId === "hermes_ajustar") {
      // Abre modal pedindo o feedback
      if (botToken && payload.trigger_id) {
        await openSlackModal(
          botToken,
          payload.trigger_id,
          chamadoId,
          channelId,
          threadTs,
        );
      }
      return;
    }

    let decision: "aprovado" | "cancelado" | null = null;
    if (actionId === "hermes_aprovado") decision = "aprovado";
    if (actionId === "hermes_cancelar") decision = "cancelado";
    if (!decision) {
      console.warn(`[hermes-interactions] action_id desconhecido: ${actionId}`);
      return;
    }

    await db
      .update(hermesSlackThreads)
      .set({
        decision,
        decisionByUserId: userId,
        decisionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hermesSlackThreads.chamadoId, chamadoId));

    console.log(
      `[hermes-interactions] chamado=${chamadoId} decision=${decision} by=${userId}`,
    );

    if (botToken) {
      const text =
        decision === "aprovado"
          ? `✅ Aprovado por <@${userId}>. Hermes irá executar nos próximos passos.`
          : `❌ Cancelado por <@${userId}>. Atendimento encerrado.`;
      await postSlackThreadReply(botToken, channelId, threadTs, text);
    }
    return;
  }

  if (payload?.type === "view_submission") {
    const view = payload.view;
    if (!view || view.callback_id !== "hermes_ajuste_modal") return;
    let meta: { chamado_id?: string; channel_id?: string; thread_ts?: string } = {};
    try {
      meta = JSON.parse(view.private_metadata || "{}");
    } catch {
      return;
    }
    const chamadoId = meta.chamado_id;
    const channelId = meta.channel_id;
    const threadTs = meta.thread_ts;
    if (!chamadoId || !channelId || !threadTs) return;

    const feedback: string =
      view.state?.values?.feedback_block?.feedback_input?.value || "";

    await db
      .update(hermesSlackThreads)
      .set({
        decision: "ajustar",
        decisionByUserId: userId,
        decisionAt: new Date(),
        ajusteFeedback: feedback,
        updatedAt: new Date(),
      })
      .where(eq(hermesSlackThreads.chamadoId, chamadoId));

    console.log(
      `[hermes-interactions] chamado=${chamadoId} decision=ajustar by=${userId} feedback_len=${feedback.length}`,
    );

    if (botToken) {
      const text = `⏸ Ajuste solicitado por <@${userId}>: ${feedback}`;
      await postSlackThreadReply(botToken, channelId, threadTs, text);
    }
    void userName;
    return;
  }
}
