// worker/src/routes/hermes.ts
//
// Endpoints da Fase 3 do Hermes — espelha server/routes/hermes.ts.
//
// - POST /api/integrations/hermes/thread-registered
//     Bearer token de service account (validado contra api_token_hash em users).
// - POST /api/integrations/slack/interactions
//     Slack signature HMAC-SHA256 (validada in-route).
//
// Ambas precisam estar em PUBLIC_ROUTES de worker/src/middleware/auth.ts.

import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users, tickets, hermesSlackThreads } from "../../../shared/schema";
import type { AppEnv } from "../index";
import { fireExecutor } from "../services/hermes-executor-trigger.service";

const HEX_TABLE = "0123456789abcdef";

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += HEX_TABLE[byte >> 4] + HEX_TABLE[byte & 0x0f];
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bytesToHex(new Uint8Array(sig));
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function authenticateServiceAccount(
  db: AppEnv["Variables"]["db"],
  authHeader: string | undefined,
) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const hash = await sha256Hex(token);
  const [user] = await db.select().from(users).where(eq(users.apiTokenHash, hash));
  if (!user) return null;
  if (user.authMethod !== "token") return null;
  if (user.apiTokenExpiresAt && new Date(user.apiTokenExpiresAt).getTime() < Date.now()) {
    return null;
  }
  return user;
}

async function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  if (!signingSecret || !rawBody || !timestamp || !signature) return false;
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > 60 * 5) return false;
  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed = "v0=" + (await hmacSha256Hex(signingSecret, baseString));
  return timingSafeEqualStr(computed, signature);
}

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
        "[hermes-interactions] reply Slack falhou:",
        response.status,
        data?.error || "",
      );
    }
  } catch (err) {
    console.error("[hermes-interactions] erro de rede ao postar reply:", err);
  }
}

async function openSlackModal(
  botToken: string,
  triggerId: string,
  chamadoId: string,
  channelId: string,
  threadTs: string,
): Promise<void> {
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
        "[hermes-interactions] views.open falhou:",
        response.status,
        data?.error || "",
      );
    }
  } catch (err) {
    console.error("[hermes-interactions] erro de rede ao abrir modal:", err);
  }
}

const threadRegisteredSchema = z.object({
  chamado_id: z.string().uuid(),
  thread_ts: z.string().min(1),
  channel_id: z.string().min(1),
  execution_plan: z.string().min(1).optional(),
});

const executionUpdateSchema = z
  .object({
    chamado_id: z.string().uuid(),
    status: z.enum(["success", "failed"]),
    pr_url: z.string().url().optional(),
    pr_number: z.number().int().optional(),
    error: z.string().optional(),
  })
  .refine(
    (data) => data.status !== "failed" || (data.error && data.error.length > 0),
    { message: "error é obrigatório quando status='failed'", path: ["error"] },
  );

export const hermes = new Hono<AppEnv>();

hermes.post("/api/integrations/hermes/thread-registered", async (c) => {
  try {
    const db = c.get("db");
    const user = await authenticateServiceAccount(db, c.req.header("authorization"));
    if (!user) {
      return c.json({ error: "Bearer token inválido ou ausente" }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = threadRegisteredSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.errors },
        400,
      );
    }
    const { chamado_id, thread_ts, channel_id, execution_plan } = parsed.data;

    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, chamado_id));
    if (!ticket) {
      return c.json({ error: "Chamado não encontrado" }, 404);
    }

    const [existing] = await db
      .select()
      .from(hermesSlackThreads)
      .where(eq(hermesSlackThreads.chamadoId, chamado_id));

    let row;
    if (existing) {
      const [updated] = await db
        .update(hermesSlackThreads)
        .set({
          threadTs: thread_ts,
          channelId: channel_id,
          updatedAt: new Date(),
          ...(execution_plan ? { executionPlan: execution_plan } : {}),
        })
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
          ...(execution_plan ? { executionPlan: execution_plan } : {}),
        })
        .returning();
      row = inserted;
    }

    console.log(
      `[hermes-thread-registered] chamado=${chamado_id} thread=${thread_ts} channel=${channel_id} actor=${user.email}`,
    );

    return c.json(
      {
        id: row.id,
        chamado_id: row.chamadoId,
        thread_ts: row.threadTs,
        channel_id: row.channelId,
      },
      201,
    );
  } catch (error) {
    console.error("[hermes-thread-registered] erro:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

hermes.post("/api/integrations/hermes/execution-update", async (c) => {
  try {
    const db = c.get("db");
    const user = await authenticateServiceAccount(db, c.req.header("authorization"));
    if (!user) {
      return c.json({ error: "Bearer token inválido ou ausente" }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = executionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.errors },
        400,
      );
    }
    const { chamado_id, status, pr_url, pr_number, error } = parsed.data;

    const [mapping] = await db
      .select()
      .from(hermesSlackThreads)
      .where(eq(hermesSlackThreads.chamadoId, chamado_id));
    if (!mapping) {
      return c.json({ error: "Mapping não encontrado" }, 404);
    }

    const now = new Date();
    const [updated] = await db
      .update(hermesSlackThreads)
      .set({
        executionStatus: status,
        executionCompletedAt: now,
        ...(pr_url ? { executionPrUrl: pr_url } : {}),
        ...(pr_number !== undefined ? { executionPrNumber: pr_number } : {}),
        ...(error ? { executionError: error } : {}),
        updatedAt: now,
      })
      .where(eq(hermesSlackThreads.chamadoId, chamado_id))
      .returning();

    console.log(
      `[hermes-execution-update] chamado=${chamado_id} status=${status} pr=${pr_url ?? "—"} actor=${user.email}`,
    );

    return c.json(
      {
        ok: true,
        chamado_id,
        execution_status: updated?.executionStatus,
        execution_completed_at: updated?.executionCompletedAt,
      },
      200,
    );
  } catch (err) {
    console.error("[hermes-execution-update] erro:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

hermes.post("/api/integrations/slack/interactions", async (c) => {
  const signingSecret = c.env.SLACK_SIGNING_SECRET;
  const botToken = c.env.SLACK_BOT_TOKEN;

  if (!signingSecret) {
    console.error("[hermes-interactions] SLACK_SIGNING_SECRET ausente");
    return c.text("", 500);
  }

  const rawBody = await c.req.text();
  const timestamp = c.req.header("x-slack-request-timestamp") || "";
  const signature = c.req.header("x-slack-signature") || "";

  const ok = await verifySlackSignature(
    signingSecret,
    rawBody,
    timestamp,
    signature,
  );
  if (!ok) {
    return c.text("", 401);
  }

  let payload: any;
  try {
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");
    if (!payloadStr) return c.text("", 400);
    payload = JSON.parse(payloadStr);
  } catch (err) {
    console.error("[hermes-interactions] payload inválido:", err);
    return c.text("", 400);
  }

  // Worker: usar c.executionCtx?.waitUntil pra processar async sem reter o response.
  const db = c.get("db");
  const executorEnv = {
    HERMES_EXECUTOR_URL: c.env.HERMES_EXECUTOR_URL,
    HERMES_EXECUTOR_TOKEN: c.env.HERMES_EXECUTOR_TOKEN,
    APP_URL: (c.env as { APP_URL?: string }).APP_URL,
  };
  const work = handleSlackInteraction(db, payload, botToken, executorEnv).catch((err) => {
    console.error("[hermes-interactions] erro async:", err);
  });
  try {
    c.executionCtx?.waitUntil?.(work);
  } catch {
    // Ambiente local pode não expor executionCtx — apenas ignora
  }
  return c.text("", 200);
});

async function handleSlackInteraction(
  db: AppEnv["Variables"]["db"],
  payload: any,
  botToken: string | undefined,
  executorEnv: {
    HERMES_EXECUTOR_URL?: string;
    HERMES_EXECUTOR_TOKEN?: string;
    APP_URL?: string;
  },
): Promise<void> {
  const userId: string = payload?.user?.id || "desconhecido";

  if (payload?.type === "block_actions") {
    const action = payload.actions?.[0];
    if (!action) return;
    const actionId: string = action.action_id;
    const chamadoId: string = action.value;
    const threadTs: string = payload.message?.ts || "";
    const channelId: string = payload.channel?.id || "";

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
        `[hermes-interactions] thread/channel mismatch chamado=${chamadoId}`,
      );
      return;
    }

    if (actionId === "hermes_ajustar") {
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

    // Fase 4 — disparar Routine Executor quando aprovado
    if (decision === "aprovado") {
      const executionPlan = mapping.executionPlan ?? "";
      if (!executionPlan || executionPlan.trim().length === 0) {
        console.warn(
          `[hermes-executor-trigger] chamado=${chamadoId}: execution_plan ausente — fallback manual`,
        );
        if (botToken) {
          await postSlackThreadReply(
            botToken,
            channelId,
            threadTs,
            "⚠️ Plano não encontrado para execução automática. Marcelo, intervenção manual necessária.",
          );
        }
      } else {
        const appUrl = executorEnv.APP_URL || "";
        const ambiente: "dev" | "prod" =
          appUrl.includes("home-dev") || appUrl.includes("localhost")
            ? "dev"
            : "prod";

        await fireExecutor(
          db,
          {
            HERMES_EXECUTOR_URL: executorEnv.HERMES_EXECUTOR_URL,
            HERMES_EXECUTOR_TOKEN: executorEnv.HERMES_EXECUTOR_TOKEN,
          },
          {
            chamado_id: chamadoId,
            thread_ts: threadTs,
            channel_id: channelId,
            execution_plan: executionPlan,
            approved_by: userId,
            ambiente,
          },
        );
      }
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
  }
}
