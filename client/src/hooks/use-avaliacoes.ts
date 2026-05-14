import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Grade = "A" | "B" | "C";

export type FotoArea = "display" | "carcaca";

export interface FotoAvaliacao {
  slot: number;              // 1-7
  tipo: string;              // "Foto da Tela com IMEI", etc.
  area: FotoArea;
  url: string | null;
  notaIa: Grade | null;
  notaHumana: Grade | null;
  tagsIa: string | null;
  tagsHumana: string | null;
}

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
  linkFotos: string | null;
  fotos: FotoAvaliacao[];
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

export interface ImpactoFinanceiroErro {
  overGrading: number;
  underGrading: number;
  liquidoImpacto: number;
}

export interface ImpactoFinanceiroResult {
  erroIa: ImpactoFinanceiroErro;
  erroHumano: ImpactoFinanceiroErro;
  totalCuradorias: number;
  usouEstimativa: boolean;
}

export interface RankingAvaliadorCompleto {
  avaliadorNome: string;
  totalDispositivos: number;
  acertos: number;
  erros: number;
  assertividade: number;
  isAutomatica: boolean;
  trend: number;
}

export interface AvaliadorEvolucaoPonto {
  periodo: string;
  total: number;
  acertos: number;
  assertividade: number;
}

export interface AvaliadorEvolucaoItem {
  nome: string;
  isAutomatica: boolean;
  dados: AvaliadorEvolucaoPonto[];
}

export interface AvaliadorEvolucaoResult {
  avaliadores: AvaliadorEvolucaoItem[];
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
  imei?: string;
}

export interface CuradoriaPayload {
  tradeInId: string;
  gradeCorretaDisplay?: Grade | null;
  gradeCorretaCarcaca?: Grade | null;
  gradesPorFoto?: Record<string, Grade> | null;
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
  impactoFinanceiro: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/impacto-financeiro", f],
  rankingCompleto: (f: AvaliacoesFilters) => ["/api/avaliacoes/metricas/ranking-avaliadores-completo", f],
  avaliadoresEvolucao: (f: AvaliacoesFilters & { granularidade?: string }) => ["/api/avaliacoes/metricas/avaliadores-evolucao", f],
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

export interface CuradoriaHistoricoFiltros {
  dataInicio?: string;
  dataFim?: string;
  curadorId?: string;
  imei?: string;
  divergentesOnly?: boolean;
}

export interface CuradoriaKpis {
  totalCuradorias: number;
  taxaConcordancia: number;
  curadoriasHoje: number;
  topCurador: string | null;
}

export interface CuradoriaHistoricoItem {
  id: string;
  tradeInId: string;
  imei: string | null;
  modelo: string | null;
  categoria: string | null;
  gradeIaDisplay: string | null;
  gradeIaCarcaca: string | null;
  gradeCorretaDisplay: string | null;
  gradeCorretaCarcaca: string | null;
  curadorId: string | null;
  observacao: string | null;
  dataCuradoria: string | null;
  imagemFrontal: string | null;
  imagemTraseira: string | null;
  imagemLateral1: string | null;
  imagemLateral2: string | null;
  imagemDetalhe: string | null;
  gradesPorFoto: Record<string, string> | null;
  revisaoAvaliador: boolean;
  revisaoTipo: string | null;
}

export function useCuradorias(
  filtros: CuradoriaHistoricoFiltros = {},
  page = 1,
  limit = 50
) {
  return useQuery<{ success: boolean; data: CuradoriaHistoricoItem[]; total: number; page: number; totalPages: number; kpis: CuradoriaKpis }>({
    queryKey: KEYS.curadoria({
      data_inicio: filtros.dataInicio ?? "",
      data_fim: filtros.dataFim ?? "",
      curador_id: filtros.curadorId ?? "",
      imei: filtros.imei ?? "",
      divergentes_only: filtros.divergentesOnly ? "true" : "",
    }, page, limit),
    queryFn: async () => {
      const qs = buildParams({
        data_inicio: filtros.dataInicio,
        data_fim: filtros.dataFim,
        curador_id: filtros.curadorId,
        imei: filtros.imei,
        divergentes_only: filtros.divergentesOnly ? "true" : undefined,
        page: String(page),
        limit: String(limit),
      });
      const res = await apiRequest("GET", `/api/avaliacoes/curadoria${qs}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export interface CuradoriaFiltros {
  startDate?: string;
  endDate?: string;
  categoria?: string;
  imei?: string;
  voucher?: string;
}

export function useCuradoriaPendentes(filtros: CuradoriaFiltros = {}) {
  return useQuery<{ success: boolean; data: TradeInAvaliacao[]; total: number }>({
    queryKey: ["/api/avaliacoes/curadoria/pendentes", filtros],
    queryFn: async () => {
      const qs = buildParams({
        start_date: filtros.startDate,
        end_date: filtros.endDate,
        categoria: filtros.categoria,
        imei: filtros.imei,
        voucher: filtros.voucher,
      });
      const res = await apiRequest("GET", `/api/avaliacoes/curadoria/pendentes${qs}`);
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

// ─── Proxy API Types (Pitzi) ─────────────────────────────────────────────

export interface ResumoIAItem {
  Grade_Humano_Real: string;
  Percentual_Assertividade: number;
  Qtd_Acertos_IA: number;
  Total_Avaliados: number;
  Erros_Comuns_IA: string | null;
}

export interface EvolucaoIAItem {
  Mes: string;
  Acuracia_Mensal: number;
  Qtd_Acertos: number;
  Total_Avaliados: number;
}

export interface DispositivoIAItem {
  Dispositivo: string;
  Acuracia: number;
  Qtd_Acertos: number;
  Qtd_Erros: number;
  Total_Avaliados: number;
}

export interface CategoriaIAItem {
  Categoria: string;
  Acuracia: number;
  Qtd_Acertos: number;
  Total_Avaliados: number;
}

// ─── Proxy API Hooks ─────────────────────────────────────────────────────────

function buildProxyParams(filtros: AvaliacoesFilters): string {
  const p = new URLSearchParams();
  if (filtros.dataInicio) p.set("start_date", filtros.dataInicio);
  if (filtros.dataFim) p.set("end_date", filtros.dataFim);
  if (filtros.categoria) p.set("categories", filtros.categoria);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useResumoIA(filtros: AvaliacoesFilters = {}) {
  return useQuery<ResumoIAItem[]>({
    queryKey: ["/api/avaliacoes-ia/resumo", filtros],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/avaliacoes-ia/resumo${buildProxyParams(filtros)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useEvolucaoIA(filtros: AvaliacoesFilters = {}) {
  return useQuery<EvolucaoIAItem[]>({
    queryKey: ["/api/avaliacoes-ia/evolucao", filtros],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/avaliacoes-ia/evolucao${buildProxyParams(filtros)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useDispositivosIA(filtros: AvaliacoesFilters = {}) {
  return useQuery<DispositivoIAItem[]>({
    queryKey: ["/api/avaliacoes-ia/dispositivos", filtros],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/avaliacoes-ia/dispositivos${buildProxyParams(filtros)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCategoriasIA(filtros: AvaliacoesFilters = {}) {
  return useQuery<CategoriaIAItem[]>({
    queryKey: ["/api/avaliacoes-ia/categorias", filtros],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/avaliacoes-ia/categorias${buildProxyParams(filtros)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Assertividade por Tipo de Foto (from proxy API) ────────────────────────

export interface AssertividadeFotoItem {
  Nome_da_Tela: string;
  Total_Fotos: number;
  Acertos: number;
  Percentual_Assertividade: number;
  Mes_Avaliacao?: string;
}

export function useAssertividadeFotos(filtros: AvaliacoesFilters = {}) {
  return useQuery<AssertividadeFotoItem[]>({
    queryKey: ["/api/avaliacoes-ia/assertividade-fotos", filtros],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filtros.dataInicio) p.set("start_date", filtros.dataInicio);
      if (filtros.dataFim) p.set("end_date", filtros.dataFim);
      if (filtros.categoria) p.set("categories", filtros.categoria);
      const qs = p.toString();
      const res = await apiRequest("GET", `/api/avaliacoes-ia/assertividade-fotos${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Evolução por Categoria (proxy API) ──────────────────────────────────────

export interface EvolucaoCategoriaIAItem {
  Categoria: string;
  Mes: string;
  Acuracia_Mensal: number;
  Qtd_Acertos: number;
  Total_Avaliados: number;
}

export function useEvolucaoCategoriaIA(filtros: AvaliacoesFilters = {}) {
  return useQuery<EvolucaoCategoriaIAItem[]>({
    queryKey: ["/api/avaliacoes-ia/evolucao-categoria", filtros],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/avaliacoes-ia/evolucao-categoria${buildProxyParams(filtros)}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── IMEI lookup (proxy API, lazy — habilitar sob demanda) ───────────────────

export interface AvaliacaoImeiItem {
  Imei: string;
  Codigo_Voucher: string | null;
  Criacao_Pedido: string;
  Descricao_Captura: string;
  Nota_Ia: string | null;
  Nota_Humana: string | null;
  Tags_Ia: string | null;
  Tags_Humana: string | null;
  Url_Captura: string | null;
  Auto_Avaliada: boolean;
  Id_Avaliacao: string | null;
  Id_Captura: string | null;
}

export function useImeiIA(startDate: string, enabled = false) {
  return useQuery<AvaliacaoImeiItem[]>({
    queryKey: ["/api/avaliacoes-ia/imei", startDate],
    queryFn: async () => {
      const qs = startDate ? `?start_date=${startDate}` : "";
      const res = await apiRequest("GET", `/api/avaliacoes-ia/imei${qs}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Impacto Financeiro (valor real do voucher) ─────────────────────────────

export function useImpactoFinanceiro(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: ImpactoFinanceiroResult }>({
    queryKey: KEYS.impactoFinanceiro(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/impacto-financeiro${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Ranking Completo (nomes reais + flag automática) ───────────────────────

export function useRankingAvaliadorCompleto(filtros: AvaliacoesFilters = {}) {
  return useQuery<{ success: boolean; data: RankingAvaliadorCompleto[] }>({
    queryKey: KEYS.rankingCompleto(filtros),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/ranking-avaliadores-completo${qs}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Evolução Avaliadores (gráfico de linhas) ──────────────────────────────

export function useAvaliadorEvolucao(filtros: AvaliacoesFilters = {}, granularidade: "dia" | "mes" = "dia") {
  return useQuery<{ success: boolean; data: AvaliadorEvolucaoResult }>({
    queryKey: KEYS.avaliadoresEvolucao({ ...filtros, granularidade }),
    queryFn: async () => {
      const qs = buildParams({ data_inicio: filtros.dataInicio, data_fim: filtros.dataFim, granularidade });
      const res = await apiRequest("GET", `/api/avaliacoes/metricas/avaliadores-evolucao${qs}`);
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

// ─── Versão IA ────────────────────────────────────────────────────────────────

export interface VersaoIA {
  data: string;    // "YYYY-MM-DD"
  versao: string;  // "v2.3"
  descricao: string;
}

export function useVersoesIA() {
  return useQuery<{ success: boolean; data: VersaoIA[] }>({
    queryKey: ["/api/avaliacoes/configuracoes/versoes-ia"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/avaliacoes/configuracoes/versoes-ia");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useVersaoIAAtual() {
  return useQuery<{ success: boolean; data: VersaoIA | null }>({
    queryKey: ["/api/avaliacoes/configuracoes/versao-ia"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/avaliacoes/configuracoes/versao-ia");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAddVersaoIA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VersaoIA) => {
      const res = await apiRequest("PUT", "/api/avaliacoes/configuracoes/versao-ia", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/configuracoes/versoes-ia"] });
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/configuracoes/versao-ia"] });
    },
  });
}

export function useDeleteVersaoIA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (index: number) => {
      const res = await apiRequest("DELETE", `/api/avaliacoes/configuracoes/versoes-ia/${index}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/configuracoes/versoes-ia"] });
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes/configuracoes/versao-ia"] });
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
