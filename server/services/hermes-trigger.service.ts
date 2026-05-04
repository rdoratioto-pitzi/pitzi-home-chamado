/**
 * server/services/hermes-trigger.service.ts
 *
 * Dispara a Routine Hermes via HTTP POST quando um chamado novo entra no
 * escopo de execução do agente. Roda no Express (dev local).
 *
 * Regras de gating:
 *  - Só dispara se applicationKey ∈ HERMES_EXECUTION_SCOPE
 *  - Só dispara se type === 'bug'
 *  - applicationKey 'pitzi-duda' (cliente externo) é bloqueada explicitamente
 *  - Demais aplicações: log estruturado mas não dispara
 *
 * Falha silenciosa: nenhum erro de rede propaga; logs com prefixo
 * "[hermes-trigger]" para grep.
 *
 * Espelhado em worker/src/services/hermes-trigger.service.ts.
 */

import type { Ticket } from "../../shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de escopo (fonte de verdade)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplicações para as quais Hermes pode triagem/executar.
 * Manter sincronizada com worker/src/services/hermes-trigger.service.ts.
 */
export const HERMES_EXECUTION_SCOPE = ["renov-home", "renov-hub", "venus"] as const;

/**
 * Aplicações explicitamente bloqueadas (clientes externos).
 */
export const HERMES_BLOCKED_APPLICATIONS = ["pitzi-duda"] as const;

const HERMES_TIMEOUT_MS = 5_000;
const HERMES_BETA_HEADER = "experimental-cc-routine-2026-04-01";
const HERMES_ANTHROPIC_VERSION = "2023-06-01";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type HermesEnv = {
  HERMES_ROUTINE_URL?: string;
  HERMES_ROUTINE_TOKEN?: string;
  APP_URL?: string;
  NODE_ENV?: string;
};

export type HermesFireResult =
  | { disparado: true }
  | {
      disparado: false;
      motivo:
        | "fora-de-escopo"
        | "tipo-incompativel"
        | "aplicacao-bloqueada"
        | "config-ausente"
        | "erro-rede";
    };

type HermesPayload = {
  text: string;
};

type Solicitante = { name: string };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectAmbiente(env: HermesEnv): "dev" | "prod" {
  const appUrl = env.APP_URL || "";
  if (appUrl.includes("home-dev") || appUrl.includes("localhost")) return "dev";
  if (env.NODE_ENV === "development") return "dev";
  return "prod";
}

function buildPayload(
  ticket: Ticket,
  solicitanteNome: string,
  ambiente: "dev" | "prod",
): HermesPayload {
  const linhas = [
    "Analise o chamado:",
    `- chamado_id: ${ticket.id}`,
    `- código: ${ticket.code}`,
    `- título: ${ticket.title}`,
    `- descrição: ${ticket.description}`,
    `- aplicação: ${ticket.applicationKey ?? "—"}`,
    `- prioridade: ${ticket.priority}`,
    `- solicitante: ${solicitanteNome}`,
    `- ambiente: ${ambiente}`,
  ];
  return { text: linhas.join("\n") };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

function isBlocked(applicationKey: string): boolean {
  return (HERMES_BLOCKED_APPLICATIONS as readonly string[]).includes(applicationKey);
}

function isInScope(applicationKey: string): boolean {
  return (HERMES_EXECUTION_SCOPE as readonly string[]).includes(applicationKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide se um ticket entra no escopo do Hermes e, em caso positivo, dispara a
 * Routine via webhook outbound. Falha silenciosamente em qualquer erro de rede
 * ou config — NUNCA propaga exceção.
 */
export async function fireFor(
  env: HermesEnv,
  ticket: Ticket,
  solicitante?: Solicitante | null,
): Promise<HermesFireResult> {
  const applicationKey = ticket.applicationKey;

  if (!applicationKey) {
    console.log(
      `[hermes-trigger] ${ticket.code}: applicationKey nulo — fora de escopo`,
    );
    return { disparado: false, motivo: "fora-de-escopo" };
  }

  if (isBlocked(applicationKey)) {
    console.log(
      `[hermes-trigger] ${ticket.code}: applicationKey '${applicationKey}' bloqueada (cliente externo)`,
    );
    return { disparado: false, motivo: "aplicacao-bloqueada" };
  }

  if (!isInScope(applicationKey)) {
    console.log(
      `[hermes-trigger] ${ticket.code}: applicationKey '${applicationKey}' fora do escopo Hermes`,
    );
    return { disparado: false, motivo: "fora-de-escopo" };
  }

  if (ticket.type !== "bug") {
    console.log(
      `[hermes-trigger] ${ticket.code}: type '${ticket.type}' incompatível (Hermes só processa bugs)`,
    );
    return { disparado: false, motivo: "tipo-incompativel" };
  }

  if (!env.HERMES_ROUTINE_URL || !env.HERMES_ROUTINE_TOKEN) {
    console.warn(
      `[hermes-trigger] ${ticket.code}: HERMES_ROUTINE_URL/TOKEN ausentes — pulando disparo`,
    );
    return { disparado: false, motivo: "config-ausente" };
  }

  const ambiente = detectAmbiente(env);
  const payload = buildPayload(
    ticket,
    solicitante?.name ?? "não informado",
    ambiente,
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HERMES_TIMEOUT_MS);

  try {
    const response = await fetch(env.HERMES_ROUTINE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HERMES_ROUTINE_TOKEN}`,
        "anthropic-version": HERMES_ANTHROPIC_VERSION,
        "anthropic-beta": HERMES_BETA_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[hermes-trigger] ${ticket.code}: Routine retornou HTTP ${response.status}`,
      );
      return { disparado: false, motivo: "erro-rede" };
    }

    console.log(
      `[hermes-trigger] ${ticket.code} disparado (ambiente=${ambiente}, app=${applicationKey})`,
    );
    return { disparado: true };
  } catch (error: unknown) {
    console.error(
      `[hermes-trigger] ${ticket.code} falhou:`,
      getErrorMessage(error),
    );
    return { disparado: false, motivo: "erro-rede" };
  } finally {
    clearTimeout(timeoutId);
  }
}
