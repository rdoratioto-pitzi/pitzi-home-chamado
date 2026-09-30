// Campos editáveis dos chamados (Configurações → Campos do chamado).
import { useQuery } from "@tanstack/react-query";
import { REQUEST_OBJECTS, type RequestObjectTree } from "@shared/request-objects";
import type { TicketCustomField } from "@shared/schema";

export const REQUEST_OBJECTS_QUERY_KEY = ["/api/ticket-fields/request-objects"] as const;
export const CUSTOM_FIELDS_QUERY_KEY = ["/api/ticket-fields/custom"] as const;

/** Árvore do Objeto da Requisição; enquanto carrega (ou se falhar) usa a lista padrão. */
export function useRequestObjectTree(): RequestObjectTree {
  const { data } = useQuery<RequestObjectTree>({
    queryKey: REQUEST_OBJECTS_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
  });
  return Array.isArray(data) ? data : REQUEST_OBJECTS;
}

/** Todos os campos personalizados (de todos os grupos, ativos e inativos). */
export function useCustomFields() {
  const query = useQuery<TicketCustomField[]>({
    queryKey: CUSTOM_FIELDS_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, fields: query.data ?? [] };
}

/** Mensagem legível de um erro de apiRequest ("400: {"error":"..."}" → "..."). */
export function apiErrorMessage(err: unknown, fallback = "Erro ao salvar"): string {
  const message = err instanceof Error ? err.message : "";
  const json = message.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // não era JSON
  }
  return json || fallback;
}
