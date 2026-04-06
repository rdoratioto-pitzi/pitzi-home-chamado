/**
 * Serviço de agregação de dados de triagem
 * Consome os endpoints da API Admin Logística (dash.renovsmart.com.br/api)
 */

const PIPELINE_RS_BASE = "https://dash.renovsmart.com.br/api";
const PIPELINE_RS_TOKEN = "Renov123";

// ─── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchPipelineApi(path: string, params: Record<string, string> = {}): Promise<any[]> {
  const qs = new URLSearchParams(params).toString();
  const url = `${PIPELINE_RS_BASE}${path}${qs ? "?" + qs : ""}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${PIPELINE_RS_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API ${path} error: ${response.status}`);
  const data = await response.json() as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

// ─── Field extractors ─────────────────────────────────────────────────────────

function extractItemDate(item: any): string | null {
  const candidates = [
    "data_recebimento", "data_triagem", "data_utilizacao", "used_at", "voucher_used_at",
    "dt_voucher_use", "data_coleta", "data_entrada", "created_at", "data", "date",
  ];
  for (const f of candidates) {
    if (item[f]) return String(item[f]);
  }
  return null;
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function isToday(dateStr: string | null): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function formatDateKey(dateStr: string | null): string {
  const d = parseDate(dateStr);
  if (!d) return "N/D";
  return d.toISOString().slice(0, 10);
}

function extrairImei(item: any): string {
  return item.imei || item.IMEI || item.imei_number || "";
}

function extrairModelo(item: any): string {
  return item.modelo || item.model || item.device_model || item.description || item.Modelo || item.product || "";
}

function extrairCategoria(item: any): string {
  return item.category || item.categoria || item.Categoria || item.device_category || "";
}

function extrairRede(item: any): string {
  return item.network || item.rede || item.Rede || item.network_name || "";
}

function extrairStatus(item: any): string {
  return item.status_recebimento || item.status || item.Status || "";
}

function extrairResponsavel(item: any): string {
  return item.responsavel_triagem || item.responsavel || item.responsible || "";
}

function extrairMarca(item: any): string {
  return item.brand || item.marca || item.Marca || item.device_brand || item.manufacturer || "";
}

function calcDiasNoStatus(dateStr: string | null): number {
  const d = parseDate(dateStr);
  if (!d) return 0;
  const diffMs = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

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

// ─── Aggregation functions ────────────────────────────────────────────────────

export async function getTriagemResumo(): Promise<TriagemResumo> {
  const [recebimentosR, triagemR, bloqueadosR, manutencaoR, divergentesR] =
    await Promise.allSettled([
      fetchPipelineApi("/adm_logistica/recebimentos"),
      fetchPipelineApi("/adm_logistica/triagem"),
      fetchPipelineApi("/adm_logistica/bloqueados"),
      fetchPipelineApi("/adm_logistica/manutencao"),
      fetchPipelineApi("/adm_logistica/divergentes"),
    ]);

  const get = (r: PromiseSettledResult<any[]>) => r.status === "fulfilled" ? r.value : [];

  const recebimentos = get(recebimentosR);
  const triagem = get(triagemR);
  const bloqueados = get(bloqueadosR);
  const manutencao = get(manutencaoR);
  const divergentes = get(divergentesR);

  // KPIs
  const recebidosHoje = recebimentos.filter(r => isToday(extractItemDate(r))).length;

  // Recebimentos por dia — últimos 30 dias
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const countByDay: Record<string, number> = {};
  for (const item of recebimentos) {
    const d = parseDate(extractItemDate(item));
    if (d && d >= cutoff) {
      const key = formatDateKey(extractItemDate(item));
      countByDay[key] = (countByDay[key] || 0) + 1;
    }
  }

  const recebimentosPorDia = Object.entries(countByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, quantidade]) => ({ data, quantidade }));

  // Top redes por volume de recebimento
  const redeCount: Record<string, number> = {};
  for (const item of recebimentos) {
    const r = extrairRede(item);
    if (r) redeCount[r] = (redeCount[r] || 0) + 1;
  }
  const topRedes = Object.entries(redeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([rede, quantidade]) => ({ rede, quantidade }));

  return {
    recebidosHoje,
    emTriagem: triagem.length,
    bloqueados: bloqueados.length,
    emManutencao: manutencao.length,
    divergentes: divergentes.length,
    recebimentosPorDia,
    topRedes,
  };
}

export async function getRecebimentos(
  filters: Record<string, string>,
  page: number,
  limit: number
): Promise<RecebimentosResult> {
  let items = await fetchPipelineApi("/adm_logistica/recebimentos");

  // Apply filters
  if (filters.imei) {
    items = items.filter(i => extrairImei(i).toLowerCase().includes(filters.imei.toLowerCase()));
  }
  if (filters.categoria) {
    items = items.filter(i => extrairCategoria(i).toLowerCase().includes(filters.categoria.toLowerCase()));
  }
  if (filters.status) {
    items = items.filter(i => extrairStatus(i).toLowerCase().includes(filters.status.toLowerCase()));
  }
  if (filters.rede) {
    items = items.filter(i => extrairRede(i).toLowerCase().includes(filters.rede.toLowerCase()));
  }
  if (filters.dataInicio) {
    const start = parseDate(filters.dataInicio);
    if (start) {
      items = items.filter(i => {
        const d = parseDate(extractItemDate(i));
        return d && d >= start;
      });
    }
  }
  if (filters.dataFim) {
    const end = parseDate(filters.dataFim);
    if (end) {
      end.setHours(23, 59, 59, 999);
      items = items.filter(i => {
        const d = parseDate(extractItemDate(i));
        return d && d <= end;
      });
    }
  }

  const total = items.length;
  const paginated = items.slice((page - 1) * limit, page * limit);

  return {
    items: paginated.map(item => ({
      imei: extrairImei(item),
      modelo: extrairModelo(item),
      categoria: extrairCategoria(item),
      rede: extrairRede(item),
      status: extrairStatus(item),
      dataRecebimento: extractItemDate(item),
      responsavel: extrairResponsavel(item),
    })),
    total,
    page,
    limit,
  };
}

export async function getFilaTriagem(): Promise<RecebimentoItem[]> {
  const items = await fetchPipelineApi("/adm_logistica/triagem");
  return items.map(item => {
    const dataRecebimento = extractItemDate(item);
    return {
      imei: extrairImei(item),
      modelo: extrairModelo(item),
      marca: extrairMarca(item),
      categoria: extrairCategoria(item),
      rede: extrairRede(item),
      status: extrairStatus(item),
      dataRecebimento,
      responsavel: extrairResponsavel(item),
      diasNoStatus: calcDiasNoStatus(dataRecebimento),
    };
  });
}

export async function getDesvios(): Promise<DesvioItem[]> {
  const [bloqueadosR, manutencaoR, divergentesR] = await Promise.allSettled([
    fetchPipelineApi("/adm_logistica/bloqueados"),
    fetchPipelineApi("/adm_logistica/manutencao"),
    fetchPipelineApi("/adm_logistica/divergentes"),
  ]);

  const get = (r: PromiseSettledResult<any[]>) => r.status === "fulfilled" ? r.value : [];

  const map = (items: any[], tipo: DesvioItem["tipoDesvio"]): DesvioItem[] =>
    items.map(item => ({
      imei: extrairImei(item),
      modelo: extrairModelo(item),
      categoria: extrairCategoria(item),
      rede: extrairRede(item),
      tipoDesvio: tipo,
      dataEntrada: extractItemDate(item),
    }));

  return [
    ...map(get(bloqueadosR), "bloqueado"),
    ...map(get(manutencaoR), "manutencao"),
    ...map(get(divergentesR), "divergente"),
  ];
}
