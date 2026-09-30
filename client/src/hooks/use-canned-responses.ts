// Respostas prontas: lista para a caixa de comentário e para Configurações.
import { useQuery } from "@tanstack/react-query";
import type { CannedResponse } from "@shared/schema";

export const CANNED_RESPONSES_QUERY_KEY = ["/api/canned-responses"] as const;

/** Respostas ativas do grupo do chamado (e as que valem para todos os grupos). */
export function useCannedResponses(groupKey?: string | null) {
  const query = useQuery<CannedResponse[]>({
    queryKey: [...CANNED_RESPONSES_QUERY_KEY, groupKey ?? ""],
    queryFn: async () => {
      const qs = groupKey ? `?group=${encodeURIComponent(groupKey)}` : "";
      const res = await fetch(`/api/canned-responses${qs}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, responses: query.data ?? [] };
}

/** Troca {{solicitante}}, {{codigo}} e {{titulo}} pelos dados do chamado. */
export function fillCannedResponse(
  body: string,
  ticket: { solicitante?: string | null; codigo?: string | null; titulo?: string | null },
): string {
  return body
    .replace(/\{\{\s*solicitante\s*\}\}/gi, ticket.solicitante ?? "")
    .replace(/\{\{\s*codigo\s*\}\}/gi, ticket.codigo ?? "")
    .replace(/\{\{\s*titulo\s*\}\}/gi, ticket.titulo ?? "");
}
