/**
 * server/services/hermes-executor-trigger.service.ts
 *
 * Fase 4 — dispara a Routine "Hermes Executor" via HTTP POST quando uma
 * decisão 'aprovado' é gravada em hermes_slack_threads.
 *
 * - Atualiza hermes_slack_threads (execution_status='running',
 *   execution_started_at=now(), execution_plan=<plano>) ANTES do POST.
 * - POST com payload textual contendo o plano /prompt-renov aprovado e o
 *   contexto de Slack pra reply.
 * - Falha silenciosa: erros de rede ou config logam mas não jogam exceção.
 *
 * Espelhado em worker/src/services/hermes-executor-trigger.service.ts.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as maybeDb } from "../db";
import { hermesSlackThreads } from "@shared/schema";

const db = maybeDb!;

const HERMES_EXECUTOR_TIMEOUT_MS = 5_000;
const HERMES_BETA_HEADER = "experimental-cc-routine-2026-04-01";
const HERMES_ANTHROPIC_VERSION = "2023-06-01";

export type HermesExecutorEnv = {
  HERMES_EXECUTOR_URL?: string;
  HERMES_EXECUTOR_TOKEN?: string;
};

export type FireExecutorParams = {
  chamado_id: string;
  thread_ts: string;
  channel_id: string;
  execution_plan: string;
  approved_by: string;
  ambiente: "dev" | "prod";
};

export type FireExecutorResult =
  | { disparado: true }
  | {
      disparado: false;
      motivo: "config-ausente" | "erro-rede" | "plano-vazio";
    };

// Schema do payload outbound — o body é apenas { text } pra encaixar no
// formato de Routine trigger (mesmo padrão da Triagem na Fase 2).
export const executorPayloadSchema = z.object({
  text: z.string().min(1),
});
export type ExecutorPayload = z.infer<typeof executorPayloadSchema>;

function buildPayloadText(params: FireExecutorParams): string {
  return [
    "Execute o plano aprovado:",
    "",
    `- chamado_id: ${params.chamado_id}`,
    `- thread_ts: ${params.thread_ts}`,
    `- channel_id: ${params.channel_id}`,
    `- approved_by: ${params.approved_by}`,
    `- ambiente: ${params.ambiente}`,
    "",
    "--- PLANO APROVADO ---",
    "",
    params.execution_plan,
  ].join("\n");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export async function fireExecutor(
  env: HermesExecutorEnv,
  params: FireExecutorParams,
): Promise<FireExecutorResult> {
  if (!params.execution_plan || params.execution_plan.trim().length === 0) {
    console.warn(
      `[hermes-executor-trigger] chamado=${params.chamado_id}: plano vazio — abortando`,
    );
    return { disparado: false, motivo: "plano-vazio" };
  }

  // 1. Marcar execução como 'running' antes do disparo (mesmo se falhar — o
  //    update via execution-update endpoint vai consertar pra 'failed').
  const now = new Date();
  try {
    await db
      .update(hermesSlackThreads)
      .set({
        executionStatus: "running",
        executionStartedAt: now,
        executionPlan: params.execution_plan,
        updatedAt: now,
      })
      .where(eq(hermesSlackThreads.chamadoId, params.chamado_id));
  } catch (err) {
    console.error(
      `[hermes-executor-trigger] chamado=${params.chamado_id}: falha ao marcar running:`,
      getErrorMessage(err),
    );
  }

  if (!env.HERMES_EXECUTOR_URL || !env.HERMES_EXECUTOR_TOKEN) {
    console.warn(
      `[hermes-executor-trigger] chamado=${params.chamado_id}: HERMES_EXECUTOR_URL/TOKEN ausentes — pulando disparo`,
    );
    return { disparado: false, motivo: "config-ausente" };
  }

  const payload: ExecutorPayload = { text: buildPayloadText(params) };

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    HERMES_EXECUTOR_TIMEOUT_MS,
  );

  try {
    const response = await fetch(env.HERMES_EXECUTOR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HERMES_EXECUTOR_TOKEN}`,
        "anthropic-version": HERMES_ANTHROPIC_VERSION,
        "anthropic-beta": HERMES_BETA_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[hermes-executor-trigger] chamado=${params.chamado_id}: HTTP ${response.status}`,
      );
      return { disparado: false, motivo: "erro-rede" };
    }

    console.log(
      `[hermes-executor-trigger] chamado=${params.chamado_id} disparado (ambiente=${params.ambiente}, approved_by=${params.approved_by})`,
    );
    return { disparado: true };
  } catch (error) {
    console.error(
      `[hermes-executor-trigger] chamado=${params.chamado_id} falhou:`,
      getErrorMessage(error),
    );
    return { disparado: false, motivo: "erro-rede" };
  } finally {
    clearTimeout(timeoutId);
  }
}
