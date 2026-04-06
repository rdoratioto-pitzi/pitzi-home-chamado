import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Grade = "A" | "B" | "C";

export interface TradeInAvaliacao {
  tradeInId: string;
  imei: string;
  modelo: string;
  categoria: string;
  dataTradeIn: string;
  precoMaximo: number;
  gradeIaDisplay: Grade | null;
  gradeIaCarcaca: Grade | null;
  gradeHumanoDisplay: Grade | null;
  gradeHumanoCarcaca: Grade | null;
  avaliadorHumanoId: string | null;
  avaliadorHumanoNome: string | null;
  imagemFrontal: string | null;
  imagemTraseira: string | null;
  imagemLateral1: string | null;
  imagemLateral2: string | null;
  imagemDetalhe: string | null;
  foiCurado: boolean;
}

export interface MetricasResumo {
  acuraciaIa: number;
  acuraciaHumano: number;
  custoErroIa: number;
  custoErroHumano: number;
  totalCurados: number;
  totalDisponiveis: number;
  trendAcuraciaIa: number;
  trendAcuraciaHumano: number;
}

export interface EvolucaoPonto {
  data: string;
  acuraciaIa: number;
  acuraciaHumano: number;
  totalCurados: number;
}

export interface RankingAvaliador {
  avaliadorId: string;
  avaliadorNome: string;
  totalAvaliacoes: number;
  acuraciaDisplay: number;
  acuraciaCarcaca: number;
  acuraciaGeral: number;
  trend: number;
}

export interface CustoErroResult {
  custoTotalIa: number;
  custoTotalHumano: number;
  breakdownPorTipoErro: Array<{ transicao: string; quantidade: number; custoTotal: number }>;
  topModelosCustoErro: Array<{ modelo: string; custoTotal: number; quantidade: number }>;
}

export interface MatrizConfusaoResult {
  matriz: Array<{ atribuido: Grade; correto: Grade; quantidade: number; percentual: number }>;
  totalAvaliacoes: number;
  acuraciaGeral: number;
}

export interface Avaliador {
  id: string;
  nome: string;
}

export interface AvaliacoesFilters {
  dataInicio?: string;
  dataFim?: string;
  categoria?: string;
  area?: "display" | "carcaca" | "ambas";
  avaliadorId?: string;
  granularidade?: "diaria" | "semanal" | "mensal";
  tipo?: "ia" | "humano";
}

export interface CuradoriaPayload {
  tradeInId: string;
  gradeCorretaDisplay?: Grade | null;
  gradeCorretaCarcaca?: Grade | null;
  revisaoAvaliador?: boolean;
  revisaoTipo?: string | null;
  observacao?: string | null;
  imei?: string | null;
  modelo?: string | null;
  categoria?: string | null;
  gradeIaDisplay?: Grade | null;
  gradeIaCarcaca?: Grade | null;
  gradeHumanoDisplay?: Grade | null;
  gradeHumanoCarcaca?: Grade | null;
  avaliadorHumanoId?: string | null;
  precoMaximo?: number | null;
  dataTradeIn?: string | null;
  imagemFrontal?: string | null;
  imagemTraseira?: string | null;
  imagemLateral1?: string | null;
  imagemLateral2?: string | null;
  imagemDetalhe?: string | null;
}

export interface ConfiguracaoPayload {
  percentualAmostragem?: number;
  modoPrioridade?: string;
}

// ─── Query key helpers ────────────────────────────────────────────────────────

const KEYS = {
  tradeIns: (f: AvaliacoesFilters, page: number, limit: number) => ["/api/avaliacoes/trade-ins", f, page, limit],
  tradeInById: (id: string) => ["/api/avaliacoes/trade-ins", id],
  avaliadores: () => ["/api/avaliacoes/avaliadores"],
  curadoria: (f: Record<string, string>, page: number, limit: number) => ["/api/avaliacoes/curadoria", f, page, limit],
  curadoriaPendentes: () => ["/api/avaliacoes/curadoria/pendentes"],
  configuracoes: () => ["/api/avaliacoes/configuracoes"],
  resumo: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/resumo", f],
  evolucao: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/evolucao", f],
  ranking: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/ranking-avaliadores", f],
  custoErro: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/custo-erro", f],
  matrizConfusao: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/matriz-confusao", f],
} as const;

// ─── Helper: build query string ───────────────────────────────────────────────

function buildParams(obj: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && v !== "") p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTradeInsAvaliacoes(filtros: AvaliacoesFilters = {}, page = 1, limit = 50) {
  return useQuery<{ success: boolean; data: TradeInAvaliacao[]; total: number; page: number; totalPages: number }>({
    queryKey: KEYS.tradeIns(filtros, page, limit),
    queryFn: async () => {
      const qs = buildParams({
        data_inicio: filtros.dataInicio,
        data_fim: filtros.dataFim,
        categoria: filtros.categoria,
        avaliador_id: filtros.avaliadorId,
        page: String(page),
        limit: String(limit),
      });
      const res = await apiRequest("GET", `/api/avaliacoes/trade-ins${qs}`);
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

export function useTradeInAvaliacao(tradeInId: string) {
  return useQuery<{ success: boolean; data: TradeInAvaliacao }>({
    queryKey: KEYS.tradeInById(tradeInId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/avaliacoes/trade-ins/${tradeInId}`);
      return res.json();
    },
    enabled: Boolean(tradeInId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAvaliadores() {
  return useQuery<{ success: boolean; data: Avaliador[] }>({
    queryKey: KEYS.avaliadores(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/avaliacoes/avaliadores");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useCuradorias(
  filtros: { dataInicio?: string; dataFim?: string; curadorId?: string } = {},
  page = 1,
  limit = 50
) {
  return useQuery({
    queryKey: KEYS.curadoria({ data_inicio: filtros.dataInicio ?? "", data_fim: filtros.dataFim ?? "", curador_id: filtros.curadorId ?? "" }, page, limit),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim, curador_id: filtros.curadorId, page: String(page), limit: String(limit) });
      const res = await apiRequest("GET", `/api/avaliacoes/curadoria${qs}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useCuradoriaPendentes() {
  return useQuery<{ success: boolean; data: TradeInAvaliacao[]; total: number }>({
    queryKey: KEYS.curadoriaPendentes(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/avaliacoes/curadoria/pendentes");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAvaliacoesConfiguracoes() {
  return useQuery<{ success: boolean; data: { percentualAmostragem: string; modoPrioridade: string } }>({
    queryKey: KEYS.configuracoes(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/avaliacoes/configuracoes");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useAvaliacoesResumo(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: MetricasResumo }>({
    queryKey: KEYS.resumo(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim, categoria: filtros.categoria, area: filtros.area });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/resumo${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAvaliacoesEvolucao(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: EvolucaoPonto[] }>({
    queryKey: KEYS.evolucao(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim, granularidade: filtros.granularidade });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/evolucao${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useRankingAvaliadores(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: RankingAvaliador[] }>({
    queryKey: KEYS.ranking(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/ranking-avaliadores${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCustoErro(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: CustoErroResult }>({
    queryKey: KEYS.custoErro(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/custo-erro${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useMatrizConfusao(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: MatrizConfusaoResult }>({
    queryKey: KEYS.matrizConfusao(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim, tipo: filtros.tipo, area: filtros.area, categoria: filtros.categoria });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/matriz-confusao${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useSaveCuradoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CuradoriaPayload) => {
      const res = await apiRequest("POST", "/api/avaliacoes/curadoria", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/curadoria"] });
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/metricas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/trade-ins"] });
    },
  });
}

export function useUpdateConfiguracoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConfiguracaoPayload) => {
      const res = await apiRequest("PUT", "/api/avaliacoes/configuracoes", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.configuracoes() });
    },
  });
}
