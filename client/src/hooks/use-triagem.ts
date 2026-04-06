import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriagemResumo {
  recebidosHoje: number;
  emTriagem: number;
  bloqueados: number;
  emManutencao: number;
  divergentes: number;
  recebimentosPorDia: Array<{ data: string; quantidade: number }>;
  topRedes: Array<{ rede: string; quantidade: number }>;
}

export interface RecebimentoItem {
  imei: string;
  modelo: string;
  marca?: string;
  categoria: string;
  rede: string;
  status: string;
  dataRecebimento: string | null;
  responsavel: string;
  diasNoStatus?: number;
}

export interface RecebimentosResult {
  items: RecebimentoItem[];
  total: number;
  page: number;
  limit: number;
}

export interface DesvioItem {
  imei: string;
  modelo: string;
  categoria: string;
  rede: string;
  tipoDesvio: "bloqueado" | "manutencao" | "divergente";
  dataEntrada: string | null;
}

export interface RecebimentosFilters {
  imei?: string;
  categoria?: string;
  status?: string;
  rede?: string;
  dataInicio?: string;
  dataFim?: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTriagemResumo() {
  return useQuery<{ success: boolean; data: TriagemResumo }>({
    queryKey: ["/api/triagem/resumo"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/triagem/resumo");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useTriagemRecebimentos(
  filters: RecebimentosFilters = {},
  page = 1,
  limit = 50
) {
  return useQuery<RecebimentosResult & { success: boolean }>({
    queryKey: ["/api/triagem/recebimentos", filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (filters.imei) params.set("imei", filters.imei);
      if (filters.categoria) params.set("categoria", filters.categoria);
      if (filters.status) params.set("status", filters.status);
      if (filters.rede) params.set("rede", filters.rede);
      if (filters.dataInicio) params.set("dataInicio", filters.dataInicio);
      if (filters.dataFim) params.set("dataFim", filters.dataFim);
      const res = await apiRequest("GET", `/api/triagem/recebimentos?${params.toString()}`);
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useTriagemFila() {
  return useQuery<{ success: boolean; data: RecebimentoItem[]; total: number }>({
    queryKey: ["/api/triagem/fila"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/triagem/fila");
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useTriagemDesvios() {
  return useQuery<{ success: boolean; data: DesvioItem[]; total: number }>({
    queryKey: ["/api/triagem/desvios"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/triagem/desvios");
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
