/**
 * Hooks TanStack Query para o módulo de Estoques.
 *
 * Camada de acesso a dados do frontend — centraliza query keys,
 * staleTime e lógica de parâmetros para todas as telas de estoque.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EstoqueResumo {
  qtdeEstoque: number;
  valorEstoque: number;
  custoMedioUnitario: number;
  qtdeEmTransito: number;
  qtdeVendidosMes: number;
  ticketMedio: number;
}

export interface EstoqueItem {
  codigoErp: string;
  descricao: string;
  categoria: string;
  marca: string;
  modelo: string;
  unidade: string;
  estoqueDisponivel: number;
  custoUnitario: number;
  valorVenda: number;
  custoTotal: number;
  markup: number;
}

export interface EstoqueTotais {
  qtdeTotal: number;
  valorTotal: number;
  custoMedioUnitario: number;
}

export interface EstoqueFiltros {
  categoria?: string;
  marca?: string;
  modelo?: string;
  codigoErp?: string;
  imei?: string;
  capacidade?: string;
  page?: number;
  limit?: number;
}

export interface CurvaABCClasse {
  classificacao: "A" | "B" | "C";
  qtdeItens: number;
  percentualValor: number;
  percentualItens: number;
  itens: EstoqueItem[];
}

export interface CurvaABCData {
  resumo: {
    classeA: { itens: number; percentualItens: number; percentualValor: number };
    classeB: { itens: number; percentualItens: number; percentualValor: number };
    classeC: { itens: number; percentualItens: number; percentualValor: number };
    valorTotal: number;
    totalItens: number;
  };
  classes: CurvaABCClasse[];
  grafico: Array<{ classificacao: string; valor: number; percentual: number; acumulado: number }>;
}

export interface GiroEstoqueData {
  giroMensal: number;
  cobertura: number;
  meta: number;
  porCategoria: Array<{ categoria: string; giro: number; dias: number; estoqueAtual: number }>;
  tendencia: Array<{ mes: string; giro: number }>;
}

export interface DashboardVolumeData {
  processados: { atual: number; anterior: number; variacao: number };
  vendidos:    { atual: number; anterior: number; variacao: number };
  emTransito:  { atual: number; anterior: number; variacao: number };
  emEstoque:   { atual: number; anterior: number; variacao: number };
  periodo: string;
}

export interface DashboardFinanceiroData {
  valorEstoque:      { valor: number; variacao: number };
  valorTransito:     { valor: number; variacao: number };
  ticketMedio:       { valor: number; variacao: number };
  custoMedioUnit:    { valor: number; variacao: number };
  periodo: string;
}

export interface AgingEstoqueData {
  faixas: Array<{ label: string; quantidade: number; valor: number; percentual: number }>;
  mediaGeral: number;
  mediaMes: Array<{ mes: string; media: number }>;
  topAntigos: Array<{ descricao: string; diasEstimados: number; custoTotal: number }>;
  totais: { quantidade: number; valor: number };
}

// ─── Hooks — KPIs consolidados ────────────────────────────────────────────────

/** KPIs consolidados de estoque (resumo do módulo) */
export function useEstoqueResumo() {
  return useQuery<{ success: boolean; data: EstoqueResumo }>({
    queryKey: ["/api/estoques/resumo"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/resumo");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ─── Hooks — Posição de Estoques ──────────────────────────────────────────────

/** Lista paginada de itens em estoque com filtros */
export function usePosicaoEstoque(filtros: EstoqueFiltros = {}) {
  const params = new URLSearchParams();
  if (filtros.categoria && filtros.categoria !== "all") params.set("categoria", filtros.categoria);
  if (filtros.marca && filtros.marca !== "all") params.set("marca", filtros.marca);
  if (filtros.modelo && filtros.modelo !== "all") params.set("modelo", filtros.modelo);
  if (filtros.codigoErp) params.set("codigoErp", filtros.codigoErp);
  if (filtros.imei) params.set("imei", filtros.imei);
  if (filtros.capacidade) params.set("capacidade", filtros.capacidade);

  return useQuery<{ success: boolean; data: EstoqueItem[]; total: number }>({
    queryKey: ["/api/estoques/posicao", filtros],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/posicao?${params.toString()}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Totalizadores de estoque (qtde, valor, custo médio) */
export function usePosicaoTotais() {
  return useQuery<{ success: boolean; data: EstoqueTotais }>({
    queryKey: ["/api/estoques/posicao/totais"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/posicao/totais");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ─── Hooks — Curva ABC e Giro ─────────────────────────────────────────────────

/** Classificação ABC dos itens em estoque */
export function useCurvaABC() {
  return useQuery<{ success: boolean; data: CurvaABCData }>({
    queryKey: ["/api/estoques/curva-abc"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/curva-abc");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Métricas de giro de estoque */
export function useGiroEstoque() {
  return useQuery<{ success: boolean; data: GiroEstoqueData }>({
    queryKey: ["/api/estoques/giro"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/giro");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ─── Hooks — Dashboard ────────────────────────────────────────────────────────

/** KPIs de volume (processados, triados, em trânsito, em estoque) */
export function useDashboardVolume(periodo = "30d") {
  return useQuery<{ success: boolean; data: DashboardVolumeData }>({
    queryKey: ["/api/estoques/dashboard/volume", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/dashboard/volume?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** KPIs financeiros (valor estoque, trânsito, ticket médio, custo médio) */
export function useDashboardFinanceiro(periodo = "30d") {
  return useQuery<{ success: boolean; data: DashboardFinanceiroData }>({
    queryKey: ["/api/estoques/dashboard/financeiro", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/dashboard/financeiro?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** KPIs de tempo (ciclo total, pré-estoque, aging, giro) */
export function useDashboardTempo(periodo = "30d") {
  return useQuery({
    queryKey: ["/api/estoques/dashboard/tempo", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/dashboard/tempo?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** KPIs de eficiência */
export function useDashboardEficiencia(periodo = "30d") {
  return useQuery({
    queryKey: ["/api/estoques/dashboard/eficiencia", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/dashboard/eficiencia?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Gráficos executivos (distribuição por etapa, histórico) */
export function useDashboardGraficos(periodo = "30d") {
  return useQuery({
    queryKey: ["/api/estoques/dashboard/graficos", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/dashboard/graficos?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Aging de estoque por faixa de dias */
export function useAgingEstoque() {
  return useQuery<{ success: boolean; data: AgingEstoqueData }>({
    queryKey: ["/api/estoques/dashboard/aging-estoque"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/dashboard/aging-estoque");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/** Tendência de estoque (últimos 6-12 meses) */
export function useTendencias(periodo = "30d") {
  return useQuery({
    queryKey: ["/api/estoques/dashboard/tendencias", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/dashboard/tendencias?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

/** Dados do funil de dispositivos por etapa */
export function usePipeline() {
  return useQuery({
    queryKey: ["/api/estoques/pipeline"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/pipeline");
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Itens de uma etapa específica do pipeline (drill-down) */
export function usePipelineEtapa(etapa: string | null, page = 1, limite = 50, filtroMes?: string) {
  return useQuery({
    queryKey: ["/api/estoques/pipeline/etapa", etapa, page, filtroMes],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limite: String(limite) });
      if (filtroMes) params.set("filtroMes", filtroMes);
      const res = await apiRequest("GET", `/api/estoques/pipeline/${etapa}?${params}`);
      return res.json();
    },
    enabled: !!etapa,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

// ─── Lead Time ───────────────────────────────────────────────────────────────

/** Métricas de lead time por etapa (ciclos + estatísticas) */
export function useLeadTime(periodo = "30d") {
  return useQuery({
    queryKey: ["/api/estoques/lead-time", periodo],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/estoques/lead-time?periodo=${periodo}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Tendência histórica semanal de lead time */
export function useLeadTimeTendencia() {
  return useQuery({
    queryKey: ["/api/estoques/lead-time/tendencia"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/lead-time/tendencia");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

// ─── Aging Report ────────────────────────────────────────────────────────────

/** Matriz de aging pré-estoque (faixa × etapa) */
export function useAgingMatriz() {
  return useQuery({
    queryKey: ["/api/estoques/aging/matriz"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/aging/matriz");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Aging de dispositivos em estoque (dias desde triagem finalizada) */
export function useAgingEmEstoque() {
  return useQuery({
    queryKey: ["/api/estoques/aging/estoque"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/aging/estoque");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Lista FIFO de dispositivos mais antigos (paginada) */
export function useAgingFifo(pagina = 1, etapa?: string, faixa?: string) {
  return useQuery({
    queryKey: ["/api/estoques/aging/fifo", pagina, etapa, faixa],
    queryFn: async () => {
      const params = new URLSearchParams({ pagina: String(pagina), limite: "50" });
      if (etapa) params.set("etapa", etapa);
      if (faixa) params.set("faixa", faixa);
      const res = await apiRequest("GET", `/api/estoques/aging/fifo?${params}`);
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Configuração de alertas de aging por etapa */
export function useAgingAlertasConfig() {
  return useQuery({
    queryKey: ["/api/estoques/aging/alertas/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estoques/aging/alertas/config");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
