/**
 * Serviço de integração RenovSmart para dados de avaliação estética
 * Consome a API dash.renovsmart.com.br/api e agrega dados de curadoria do PostgreSQL
 */

import { db } from "../db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  curadoriaAvaliacoes,
  curadoriaConfiguracoes,
  type InsertCuradoriaAvaliacao,
  type VersaoIA,
} from "@shared/schema";
import {
  normalizeGrade,
  agregarPorDispositivo,
  calcularAssertividadePorDispositivo,
  buildMatrizConfusaoFromDevices,
  type RawFotoAvaliacao,
} from "./avaliacoes-normalizer";

const PIPELINE_RS_BASE = "https://dash.renovsmart.com.br/api";
const PIPELINE_RS_TOKEN = process.env.RENOVSMART_API_TOKEN || "Renov123";

export const DESCONTO_POR_GRADE: Record<string, number> = { A: 0, B: 0.25, C: 0.70 };

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
  idCaptura: string | null;
}

export interface TradeInAvaliacao {
  tradeInId: string;
  imei: string;
  modelo: string;
  categoria: "smartphone" | "iphone" | "console" | string;
  dataTradeIn: string;
  precoMaximo: number;

  gradeIaDisplay: Grade | null;
  gradeIaCarcaca: Grade | null;
  gradeHumanoDisplay: Grade | null;
  gradeHumanoCarcaca: Grade | null;
  avaliadorHumanoId: string | null;
  avaliadorHumanoNome: string | null;

  // Legacy image slots (backward compat)
  imagemFrontal: string | null;
  imagemTraseira: string | null;
  imagemLateral1: string | null;
  imagemLateral2: string | null;
  imagemDetalhe: string | null;
  linkFotos: string | null;

  // New: 7 named photo slots for per-photo grading
  fotos: FotoAvaliacao[];

  codigoVoucher: string | null;
  autoAvaliada: boolean;
  idAvaliacao: string | null;
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

export interface CustoErroBreakdown {
  transicao: string; // ex: "A→B"
  quantidade: number;
  custoTotal: number;
}

export interface CustoErroResult {
  custoTotalIa: number;
  custoTotalHumano: number;
  breakdownPorTipoErro: CustoErroBreakdown[];
  topModelosCustoErro: Array<{ modelo: string; custoTotal: number; quantidade: number }>;
}

export interface MatrizConfusaoEntry {
  atribuido: Grade;
  correto: Grade;
  quantidade: number;
  percentual: number;
}

export interface MatrizConfusaoResult {
  matriz: MatrizConfusaoEntry[];
  totalAvaliacoes: number;
  acuraciaGeral: number;
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

export interface Avaliador {
  id: string;
  nome: string;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchAvaliacoesApi(path: string, params: Record<string, string> = {}): Promise<any[]> {
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

function parseGrade(raw: unknown): Grade | null {
  if (raw === "A" || raw === "B" || raw === "C") return raw as Grade;
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

function normalizeItem(item: any, foiCurado: boolean): TradeInAvaliacao {
  return {
    tradeInId: item.id || item.trade_in_id || item.tradeInId || "",
    imei: item.imei || item.IMEI || "",
    modelo: item.modelo || item.model || item.device_model || item.description || "",
    categoria: item.category || item.categoria || "smartphone",
    dataTradeIn: item.data_trade_in || item.created_at || item.data || new Date().toISOString(),
    precoMaximo: parseFloat(item.preco_maximo || item.price || item.precoMaximo || "0") || 0,
    gradeIaDisplay: parseGrade(item.grade_ia_display || item.gradeIaDisplay),
    gradeIaCarcaca: parseGrade(item.grade_ia_carcaca || item.gradeIaCarcaca),
    gradeHumanoDisplay: parseGrade(item.grade_humano_display || item.gradeHumanoDisplay),
    gradeHumanoCarcaca: parseGrade(item.grade_humano_carcaca || item.gradeHumanoCarcaca),
    avaliadorHumanoId: item.avaliador_humano_id || item.avaliadorHumanoId || null,
    avaliadorHumanoNome: item.avaliador_nome || item.avaliadorHumanoNome || null,
    imagemFrontal: item.imagem_frontal || item.imagemFrontal || null,
    imagemTraseira: item.imagem_traseira || item.imagemTraseira || null,
    imagemLateral1: item.imagem_lateral_1 || item.imagemLateral1 || null,
    imagemLateral2: item.imagem_lateral_2 || item.imagemLateral2 || null,
    imagemDetalhe: item.imagem_detalhe || item.imagemDetalhe || null,
    linkFotos: item.link_fotos || item.linkFotos || null,
    fotos: [],
    codigoVoucher: item.codigo_voucher || item.codigoVoucher || item["Código Voucher"] || null,
    autoAvaliada: item.auto_avaliada ?? item.autoAvaliada ?? item["Auto Avaliada"] ?? false,
    idAvaliacao: item.id_avaliacao || item.idAvaliacao || item["Id da Avaliação"] || null,
    foiCurado,
  };
}

// ─── Public API functions ─────────────────────────────────────────────────────

export async function getTradeInsAvaliacoes(
  filtros: AvaliacoesFilters,
  page = 1,
  limit = 50
): Promise<{ data: TradeInAvaliacao[]; total: number; page: number; totalPages: number }> {
  let items: TradeInAvaliacao[];

  // Fetch curated IDs to mark foiCurado
  const curados = db ? await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).catch(() => []) : [];
  const curadosSet = new Set(curados.map((c) => c.tradeInId));

  try {
    // Consume real proxy endpoint /avaliacoes-ia/detalhes (returns per-photo data)
    const params: Record<string, string> = {};
    if (filtros.dataInicio) params.start_date = filtros.dataInicio;
    if (filtros.dataFim) params.end_date = filtros.dataFim;
    if (filtros.categoria) params.categories = filtros.categoria;

    const rawPhotos = await fetchAvaliacoesApi("/avaliacoes-ia/detalhes", params) as RawFotoAvaliacao[];
    items = agregarPorDispositivo(rawPhotos, curadosSet);
  } catch (err) {
    console.error("⚠️ RenovSmart API indisponível para avaliações:", err);
    return { data: [], total: 0, page, totalPages: 0 };
  }

  // Apply filters
  if (filtros.dataInicio) {
    const start = parseDate(filtros.dataInicio);
    if (start) items = items.filter((i) => { const d = parseDate(i.dataTradeIn); return d && d >= start; });
  }
  if (filtros.dataFim) {
    const end = parseDate(filtros.dataFim);
    if (end) { end.setHours(23, 59, 59, 999); items = items.filter((i) => { const d = parseDate(i.dataTradeIn); return d && d <= end; }); }
  }
  if (filtros.categoria) {
    items = items.filter((i) => i.categoria.toLowerCase().includes(filtros.categoria!.toLowerCase()));
  }
  if (filtros.avaliadorId) {
    items = items.filter((i) => i.avaliadorHumanoId === filtros.avaliadorId);
  }

  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const paginated = items.slice((page - 1) * limit, page * limit);

  return { data: paginated, total, page, totalPages };
}

export async function getTradeInById(tradeInId: string): Promise<TradeInAvaliacao | null> {
  try {
    const raw = await fetchAvaliacoesApi(`/adm_logistica/avaliacoes/${tradeInId}`);
    const curados = db ? await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).where(eq(curadoriaAvaliacoes.tradeInId, tradeInId)) : [];
    return raw.length > 0 ? normalizeItem(raw[0], curados.length > 0) : null;
  } catch (err) {
    console.error("⚠️ RenovSmart API indisponível para trade-in", tradeInId, ":", err);
    return null;
  }
}

export async function getAvaliadores(): Promise<Avaliador[]> {
  try {
    const raw = await fetchAvaliacoesApi("/adm_logistica/avaliacoes");
    const map = new Map<string, string>();
    for (const item of raw) {
      const id = item.avaliador_humano_id || item.avaliadorHumanoId;
      const nome = item.avaliador_nome || item.avaliadorHumanoNome;
      if (id && nome) map.set(id, nome);
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  } catch (err) {
    console.error("⚠️ RenovSmart API indisponível para avaliadores:", err);
    return [];
  }
}

// ─── Metrics (computed from curadoria_avaliacoes) ────────────────────────────

function buildDateFilter(filtros: AvaliacoesFilters) {
  const conditions = [];
  if (filtros.dataInicio) {
    const start = parseDate(filtros.dataInicio);
    if (start) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, start));
  }
  if (filtros.dataFim) {
    const end = parseDate(filtros.dataFim);
    if (end) {
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, end));
    }
  }
  return conditions;
}

function calcAccuracy(records: any[], tipo: "ia" | "humano", area: "display" | "carcaca" | "ambas"): number {
  const relevant = records.filter((r) => {
    if (area === "display") return r.gradeCorretaDisplay !== null;
    if (area === "carcaca") return r.gradeCorretaCarcaca !== null;
    return r.gradeCorretaDisplay !== null || r.gradeCorretaCarcaca !== null;
  });
  if (relevant.length === 0) return 0;

  let correct = 0;
  let total = 0;

  for (const r of relevant) {
    if (area === "display" || area === "ambas") {
      const atrib = tipo === "ia" ? r.gradeIaDisplay : r.gradeHumanoDisplay;
      if (atrib && r.gradeCorretaDisplay) {
        total++;
        if (atrib === r.gradeCorretaDisplay) correct++;
      }
    }
    if (area === "carcaca" || area === "ambas") {
      const atrib = tipo === "ia" ? r.gradeIaCarcaca : r.gradeHumanoCarcaca;
      if (atrib && r.gradeCorretaCarcaca) {
        total++;
        if (atrib === r.gradeCorretaCarcaca) correct++;
      }
    }
  }

  return total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
}

function calcCustoErroTipo(records: any[], tipo: "ia" | "humano"): number {
  let total = 0;
  for (const r of records) {
    const precoMaximo = parseFloat(r.precoMaximo || "0") || 0;
    const areas: Array<["Display" | "Carcaca", "gradeIaDisplay" | "gradeIaCarcaca" | "gradeHumanoDisplay" | "gradeHumanoCarcaca", "gradeCorretaDisplay" | "gradeCorretaCarcaca"]> = [
      ["Display", tipo === "ia" ? "gradeIaDisplay" : "gradeHumanoDisplay", "gradeCorretaDisplay"],
      ["Carcaca", tipo === "ia" ? "gradeIaCarcaca" : "gradeHumanoCarcaca", "gradeCorretaCarcaca"],
    ];
    for (const [, atribKey, corretaKey] of areas) {
      const atrib = r[atribKey] as Grade | null;
      const correta = r[corretaKey] as Grade | null;
      if (atrib && correta && atrib !== correta) {
        const diff = Math.abs((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0));
        total += diff * precoMaximo;
      }
    }
  }
  return Math.round(total * 100) / 100;
}

export async function calcularMetricasResumo(filtros: AvaliacoesFilters): Promise<MetricasResumo> {
  // Try curadoria-based metrics first (gold standard when available)
  const records = db ? await (async () => {
    const conditions = buildDateFilter(filtros);
    return conditions.length > 0
      ? db.select().from(curadoriaAvaliacoes).where(and(...conditions))
      : db.select().from(curadoriaAvaliacoes);
  })().catch(() => []) : [];

  const hasCuradoria = records.length > 0;

  if (hasCuradoria) {
    const area = filtros.area ?? "ambas";
    const acuraciaIa = calcAccuracy(records, "ia", area);
    const acuraciaHumano = calcAccuracy(records, "humano", area);
    const custoErroIa = calcCustoErroTipo(records, "ia");
    const custoErroHumano = calcCustoErroTipo(records, "humano");

    const now = new Date();
    const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
    const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);

    const recent = records.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff7);
    const previous = records.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff14 && new Date(r.dataCuradoria) < cutoff7);

    const trendAcuraciaIa = calcAccuracy(recent, "ia", area) - calcAccuracy(previous, "ia", area);
    const trendAcuraciaHumano = calcAccuracy(recent, "humano", area) - calcAccuracy(previous, "humano", area);

    let totalDisponiveis = 0;
    try { const all = await getTradeInsAvaliacoes({}, 1, 9999); totalDisponiveis = all.total; } catch { totalDisponiveis = 0; }

    return {
      acuraciaIa, acuraciaHumano, custoErroIa, custoErroHumano,
      totalCurados: records.length, totalDisponiveis,
      trendAcuraciaIa: Math.round(trendAcuraciaIa * 10) / 10,
      trendAcuraciaHumano: Math.round(trendAcuraciaHumano * 10) / 10,
    };
  }

  // Fallback: use real API proxy data (IA vs Humano as proxy for accuracy)
  try {
    const params: Record<string, string> = {};
    if (filtros.dataInicio) params.start_date = filtros.dataInicio;
    if (filtros.dataFim) params.end_date = filtros.dataFim;
    if (filtros.categoria) params.categories = filtros.categoria;

    const rawPhotos = await fetchAvaliacoesApi("/avaliacoes-ia/detalhes", params) as RawFotoAvaliacao[];
    const dispositivos = agregarPorDispositivo(rawPhotos);
    const assertividade = calcularAssertividadePorDispositivo(dispositivos);

    // Calculate custo erro from API data using percentuais POP V3
    let custoErroIa = 0;
    for (const d of dispositivos) {
      const preco = d.precoMaximo || 0;
      if (d.gradeIaDisplay && d.gradeHumanoDisplay && d.gradeIaDisplay !== d.gradeHumanoDisplay) {
        custoErroIa += Math.abs((DESCONTO_POR_GRADE[d.gradeIaDisplay] ?? 0) - (DESCONTO_POR_GRADE[d.gradeHumanoDisplay] ?? 0)) * preco;
      }
      if (d.gradeIaCarcaca && d.gradeHumanoCarcaca && d.gradeIaCarcaca !== d.gradeHumanoCarcaca) {
        custoErroIa += Math.abs((DESCONTO_POR_GRADE[d.gradeIaCarcaca] ?? 0) - (DESCONTO_POR_GRADE[d.gradeHumanoCarcaca] ?? 0)) * preco;
      }
    }

    return {
      acuraciaIa: assertividade.acuraciaIa,
      acuraciaHumano: 0,
      custoErroIa: Math.round(custoErroIa * 100) / 100,
      custoErroHumano: 0,
      totalCurados: 0,
      totalDisponiveis: dispositivos.length,
      trendAcuraciaIa: 0,
      trendAcuraciaHumano: 0,
    };
  } catch {
    return { acuraciaIa: 0, acuraciaHumano: 0, custoErroIa: 0, custoErroHumano: 0, totalCurados: 0, totalDisponiveis: 0, trendAcuraciaIa: 0, trendAcuraciaHumano: 0 };
  }
}

export async function calcularEvolucaoTemporal(filtros: AvaliacoesFilters): Promise<EvolucaoPonto[]> {
  // Try curadoria data first
  if (db) {
    const conditions = buildDateFilter(filtros);
    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions)).catch(() => [])
      : await db.select().from(curadoriaAvaliacoes).catch(() => []);

    if (records.length > 0) {
      const granularidade = filtros.granularidade ?? "diaria";

      function getKey(date: Date): string {
        if (granularidade === "mensal") return date.toISOString().slice(0, 7);
        if (granularidade === "semanal") {
          const d = new Date(date);
          d.setDate(d.getDate() - d.getDay());
          return d.toISOString().slice(0, 10);
        }
        return date.toISOString().slice(0, 10);
      }

      const grouped = new Map<string, any[]>();
      for (const r of records) {
        if (!r.dataCuradoria) continue;
        const key = getKey(new Date(r.dataCuradoria));
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
      }

      return Array.from(grouped.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, grupo]) => ({
          data,
          acuraciaIa: calcAccuracy(grupo, "ia", "ambas"),
          acuraciaHumano: calcAccuracy(grupo, "humano", "ambas"),
          totalCurados: grupo.length,
        }));
    }
  }

  // Fallback: use real API /avaliacoes-ia/evolucao (normalize Grade D→C)
  try {
    const params: Record<string, string> = {};
    if (filtros.dataInicio) params.start_date = filtros.dataInicio;
    if (filtros.dataFim) params.end_date = filtros.dataFim;

    const raw = await fetchAvaliacoesApi("/avaliacoes-ia/evolucao", params);
    return raw.map((item: any) => ({
      data: item.Mes || item.data || "",
      acuraciaIa: item.Acuracia_Mensal ?? item.acuraciaIa ?? 0,
      acuraciaHumano: 0,
      totalCurados: 0,
    }));
  } catch {
    return [];
  }
}

export async function calcularRankingAvaliadores(filtros: AvaliacoesFilters): Promise<RankingAvaliador[]> {
  // Try curadoria data first
  if (db) {
    const conditions = buildDateFilter(filtros);
    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions)).catch(() => [])
      : await db.select().from(curadoriaAvaliacoes).catch(() => []);

    if (records.length > 0) {
      const byAvaliador = new Map<string, { nome: string; records: any[] }>();
      for (const r of records) {
        const id = r.avaliadorHumanoId || "desconhecido";
        const nome = id;
        if (!byAvaliador.has(id)) byAvaliador.set(id, { nome, records: [] });
        byAvaliador.get(id)!.records.push(r);
      }

      const now = new Date();
      const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
      const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);

      return Array.from(byAvaliador.entries())
        .map(([avaliadorId, { nome, records: recs }]) => {
          const recent = recs.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff7);
          const previous = recs.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff14 && new Date(r.dataCuradoria) < cutoff7);
          const acuraciaGeral = calcAccuracy(recs, "humano", "ambas");
          const trendRecent = calcAccuracy(recent, "humano", "ambas");
          const trendPrev = calcAccuracy(previous, "humano", "ambas");
          return {
            avaliadorId, avaliadorNome: nome, totalAvaliacoes: recs.length,
            acuraciaDisplay: calcAccuracy(recs, "humano", "display"),
            acuraciaCarcaca: calcAccuracy(recs, "humano", "carcaca"),
            acuraciaGeral, trend: Math.round((trendRecent - trendPrev) * 10) / 10,
          };
        })
        .sort((a, b) => b.acuraciaGeral - a.acuraciaGeral);
    }
  }

  // Fallback: use real API /avaliacoes-ia/detalhes, aggregate by evaluator
  try {
    const params: Record<string, string> = {};
    if (filtros.dataInicio) params.start_date = filtros.dataInicio;
    if (filtros.dataFim) params.end_date = filtros.dataFim;

    const rawPhotos = await fetchAvaliacoesApi("/avaliacoes-ia/detalhes", params) as RawFotoAvaliacao[];
    const dispositivos = agregarPorDispositivo(rawPhotos);

    // Group by evaluator from raw data (Nota_Humana field contains evaluator info)
    const byDevice = new Map<string, { gradeIa: string | null; gradeHumano: string | null }[]>();
    for (const d of dispositivos) {
      // Use "Avaliador Humano" as a single group since we don't have per-evaluator data in detalhes
      const key = d.avaliadorHumanoId || "avaliador_padrao";
      if (!byDevice.has(key)) byDevice.set(key, []);
      if (d.gradeIaDisplay && d.gradeHumanoDisplay) {
        byDevice.get(key)!.push({ gradeIa: d.gradeIaDisplay, gradeHumano: d.gradeHumanoDisplay });
      }
      if (d.gradeIaCarcaca && d.gradeHumanoCarcaca) {
        byDevice.get(key)!.push({ gradeIa: d.gradeIaCarcaca, gradeHumano: d.gradeHumanoCarcaca });
      }
    }

    return Array.from(byDevice.entries()).map(([avaliadorId, evals]) => {
      const total = evals.length;
      const acertos = evals.filter((e) => e.gradeIa === e.gradeHumano).length;
      const acuraciaGeral = total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0;
      return {
        avaliadorId,
        avaliadorNome: avaliadorId === "avaliador_padrao" ? "Avaliador Humano" : avaliadorId,
        totalAvaliacoes: total,
        acuraciaDisplay: acuraciaGeral,
        acuraciaCarcaca: acuraciaGeral,
        acuraciaGeral,
        trend: 0,
      };
    }).sort((a, b) => b.acuraciaGeral - a.acuraciaGeral);
  } catch {
    return [];
  }
}

export async function calcularCustoErro(filtros: AvaliacoesFilters): Promise<CustoErroResult> {
  if (!db) {
    return { custoTotalIa: 0, custoTotalHumano: 0, breakdownPorTipoErro: [], topModelosCustoErro: [] };
  }

  const conditions = buildDateFilter(filtros);
  const records = conditions.length > 0
    ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
    : await db.select().from(curadoriaAvaliacoes);

  const custoTotalIa = calcCustoErroTipo(records, "ia");
  const custoTotalHumano = calcCustoErroTipo(records, "humano");

  // Breakdown por transição de grade
  const transicaoMap = new Map<string, { quantidade: number; custoTotal: number }>();
  for (const r of records) {
    const precoMaximo = parseFloat(r.precoMaximo || "0") || 0;
    const pairs: Array<[Grade | null, Grade | null]> = [
      [r.gradeIaDisplay as Grade | null, r.gradeCorretaDisplay as Grade | null],
      [r.gradeIaCarcaca as Grade | null, r.gradeCorretaCarcaca as Grade | null],
    ];
    for (const [atrib, correta] of pairs) {
      if (atrib && correta && atrib !== correta) {
        const key = `${atrib}→${correta}`;
        const diff = Math.abs((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0));
        const custo = diff * precoMaximo;
        const current = transicaoMap.get(key) ?? { quantidade: 0, custoTotal: 0 };
        transicaoMap.set(key, { quantidade: current.quantidade + 1, custoTotal: current.custoTotal + custo });
      }
    }
  }

  const breakdownPorTipoErro: CustoErroBreakdown[] = Array.from(transicaoMap.entries())
    .map(([transicao, { quantidade, custoTotal }]) => ({ transicao, quantidade, custoTotal: Math.round(custoTotal * 100) / 100 }))
    .sort((a, b) => b.custoTotal - a.custoTotal);

  // Top modelos por custo de erro
  const modeloMap = new Map<string, { custoTotal: number; quantidade: number }>();
  for (const r of records) {
    const precoMaximo = parseFloat(r.precoMaximo || "0") || 0;
    const modelo = r.modelo || "Desconhecido";
    const pares: Array<[Grade | null, Grade | null]> = [
      [r.gradeIaDisplay as Grade | null, r.gradeCorretaDisplay as Grade | null],
      [r.gradeIaCarcaca as Grade | null, r.gradeCorretaCarcaca as Grade | null],
    ];
    let custoItem = 0;
    let temErro = false;
    for (const [atrib, correta] of pares) {
      if (atrib && correta && atrib !== correta) {
        custoItem += Math.abs((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0)) * precoMaximo;
        temErro = true;
      }
    }
    if (temErro) {
      const current = modeloMap.get(modelo) ?? { custoTotal: 0, quantidade: 0 };
      modeloMap.set(modelo, { custoTotal: current.custoTotal + custoItem, quantidade: current.quantidade + 1 });
    }
  }

  const topModelosCustoErro = Array.from(modeloMap.entries())
    .map(([modelo, { custoTotal, quantidade }]) => ({ modelo, custoTotal: Math.round(custoTotal * 100) / 100, quantidade }))
    .sort((a, b) => b.custoTotal - a.custoTotal)
    .slice(0, 5);

  return { custoTotalIa, custoTotalHumano, breakdownPorTipoErro, topModelosCustoErro };
}

export async function calcularMatrizConfusao(filtros: AvaliacoesFilters): Promise<MatrizConfusaoResult> {
  // Try curadoria data first
  if (db) {
    const conditions = buildDateFilter(filtros);
    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions)).catch(() => [])
      : await db.select().from(curadoriaAvaliacoes).catch(() => []);

    if (records.length > 0) {
      const tipo = filtros.tipo ?? "ia";
      const area = filtros.area ?? "ambas";
      const counts = new Map<string, number>();
      let total = 0;

      for (const r of records) {
        const pares: Array<[Grade | null, Grade | null]> = [];
        if (area === "display" || area === "ambas") {
          const atrib = (tipo === "ia" ? r.gradeIaDisplay : r.gradeHumanoDisplay) as Grade | null;
          const correta = r.gradeCorretaDisplay as Grade | null;
          if (atrib && correta) pares.push([atrib, correta]);
        }
        if (area === "carcaca" || area === "ambas") {
          const atrib = (tipo === "ia" ? r.gradeIaCarcaca : r.gradeHumanoCarcaca) as Grade | null;
          const correta = r.gradeCorretaCarcaca as Grade | null;
          if (atrib && correta) pares.push([atrib, correta]);
        }
        for (const [atrib, correta] of pares) {
          counts.set(`${atrib}|${correta}`, (counts.get(`${atrib}|${correta}`) ?? 0) + 1);
          total++;
        }
      }

      const grades: Grade[] = ["A", "B", "C"];
      const matriz: MatrizConfusaoEntry[] = [];
      for (const atribuido of grades) {
        for (const correto of grades) {
          const quantidade = counts.get(`${atribuido}|${correto}`) ?? 0;
          matriz.push({ atribuido, correto, quantidade, percentual: total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0 });
        }
      }
      const acertos = grades.reduce((sum, g) => sum + (counts.get(`${g}|${g}`) ?? 0), 0);
      return { matriz, totalAvaliacoes: total, acuraciaGeral: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0 };
    }
  }

  // Fallback: build from real API data (IA vs Humano, 3×3 without Grade D)
  try {
    const params: Record<string, string> = {};
    if (filtros.dataInicio) params.start_date = filtros.dataInicio;
    if (filtros.dataFim) params.end_date = filtros.dataFim;
    if (filtros.categoria) params.categories = filtros.categoria;

    const rawPhotos = await fetchAvaliacoesApi("/avaliacoes-ia/detalhes", params) as RawFotoAvaliacao[];
    const dispositivos = agregarPorDispositivo(rawPhotos);
    return buildMatrizConfusaoFromDevices(dispositivos, filtros.tipo ?? "ia");
  } catch {
    return { matriz: [], totalAvaliacoes: 0, acuraciaGeral: 0 };
  }
}

// ─── Curadoria DB operations ──────────────────────────────────────────────────

export async function saveCuradoria(data: InsertCuradoriaAvaliacao) {
  if (!db) throw new Error("Banco de dados não disponível");
  const [saved] = await db.insert(curadoriaAvaliacoes).values(data).returning();
  return saved;
}

export async function getCuradorias(
  filtros: { dataInicio?: string; dataFim?: string; curadorId?: string },
  page = 1,
  limit = 50
) {
  if (!db) return { data: [], total: 0, page, totalPages: 0 };

  const conditions = [];
  if (filtros.dataInicio) {
    const start = parseDate(filtros.dataInicio);
    if (start) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, start));
  }
  if (filtros.dataFim) {
    const end = parseDate(filtros.dataFim);
    if (end) { end.setHours(23, 59, 59, 999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, end)); }
  }
  if (filtros.curadorId) {
    conditions.push(eq(curadoriaAvaliacoes.curadorId, filtros.curadorId));
  }

  const all = conditions.length > 0
    ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions)).orderBy(desc(curadoriaAvaliacoes.dataCuradoria))
    : await db.select().from(curadoriaAvaliacoes).orderBy(desc(curadoriaAvaliacoes.dataCuradoria));

  const total = all.length;
  const totalPages = Math.ceil(total / limit);
  const data = all.slice((page - 1) * limit, page * limit);
  return { data, total, page, totalPages };
}

interface CuradoriaFiltrosBackend {
  startDate?: string;
  endDate?: string;
  categoria?: string;
  imei?: string;
  voucher?: string;
}

export async function getCuradoriaPendentes(tenantId?: string | null, filtros: CuradoriaFiltrosBackend = {}): Promise<TradeInAvaliacao[]> {
  // Get config for sampling percentage
  const configs = db
    ? tenantId
      ? await db.select().from(curadoriaConfiguracoes).where(eq(curadoriaConfiguracoes.tenantId, tenantId)).catch(() => [])
      : await db.select().from(curadoriaConfiguracoes).catch(() => [])
    : [];
  const percentual = parseFloat(configs[0]?.percentualAmostragem ?? "15") || 15;

  // Resolve date range — default to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const limitDate = filtros.startDate || yesterday.toISOString().slice(0, 10);

  // Get curated IDs
  const curados = db ? await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).catch(() => []) : [];
  const curadosSet = new Set(curados.map((c) => c.tradeInId));

  let all: TradeInAvaliacao[];
  try {
    const rawPhotos = await fetchAvaliacoesApi("/avaliacoes-ia/detalhes", {
      start_date: limitDate,
    }) as RawFotoAvaliacao[];
    all = agregarPorDispositivo(rawPhotos, curadosSet);
  } catch (err) {
    console.error("⚠️ RenovSmart API indisponível para curadoria pendentes:", err);
    all = [];
  }

  // Apply filters
  let filtered = all.filter((t) => !t.foiCurado);
  if (filtros.endDate) {
    filtered = filtered.filter((t) => t.dataTradeIn.slice(0, 10) <= filtros.endDate!);
  }
  if (filtros.imei) {
    const imeiSearch = filtros.imei.toLowerCase();
    filtered = filtered.filter((t) => t.imei?.toLowerCase().includes(imeiSearch));
  }
  if (filtros.voucher) {
    const voucherSearch = filtros.voucher.toLowerCase();
    filtered = filtered.filter((t) => t.codigoVoucher?.toLowerCase().includes(voucherSearch));
  }
  const notCurated = filtered;

  // Apply sampling
  const sample = Math.ceil(notCurated.length * (percentual / 100));
  return notCurated.slice(0, sample);
}

export async function getConfiguracoes(tenantId?: string | null) {
  if (!db) return { percentualAmostragem: "15", modoPrioridade: "aleatorio" };
  const configs = tenantId
    ? await db.select().from(curadoriaConfiguracoes).where(eq(curadoriaConfiguracoes.tenantId, tenantId))
    : await db.select().from(curadoriaConfiguracoes);
  return configs[0] ?? { percentualAmostragem: "15", modoPrioridade: "aleatorio" };
}

export async function updateConfiguracoes(
  data: { percentualAmostragem?: string; modoPrioridade?: string; versoesIa?: VersaoIA[] },
  tenantId?: string | null
) {
  if (!db) throw new Error("Banco de dados não disponível");
  const existing = await getConfiguracoes(tenantId);
  if ((existing as any).id) {
    const [updated] = await db
      .update(curadoriaConfiguracoes)
      .set({ ...data, atualizadoEm: new Date() })
      .where(eq(curadoriaConfiguracoes.id, (existing as any).id))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(curadoriaConfiguracoes)
      .values({ ...data, tenantId: tenantId ?? null })
      .returning();
    return created;
  }
}

// ─── Triagem helper — busca valor voucher e avaliador por IMEI ───────────────

interface TriagemInfo {
  valorVoucher: number;
  avaliador: string;
}

async function fetchTriagemByImeis(imeis: string[]): Promise<Map<string, TriagemInfo>> {
  const map = new Map<string, TriagemInfo>();
  if (imeis.length === 0) return map;

  try {
    const url = `${PIPELINE_RS_BASE}/adm_logistica/triagem`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${PIPELINE_RS_TOKEN}`, "Content-Type": "application/json" },
    });
    if (!response.ok) return map;
    const raw = (await response.json()) as any;
    const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.results) ? raw.results : [];

    const imeiSet = new Set(imeis);
    for (const item of items) {
      const imei = item.imei || item.IMEI || item.imei_number || "";
      if (!imei || !imeiSet.has(imei)) continue;

      const valor = parseFloat(
        item["Valor do voucher"] ?? item["Valor do Voucher"] ?? item["valor_voucher"] ??
        item.voucher_value ?? item.valor ?? "0"
      ) || 0;
      const avaliador = (
        item["Avaliador"] ?? item.avaliador ?? item.responsavel_triagem ??
        item.responsavel ?? item.responsible ?? ""
      ).toString().trim();

      if (!map.has(imei)) {
        map.set(imei, { valorVoucher: valor, avaliador });
      }
    }
  } catch {
    // Silently fail — callers handle missing data
  }
  return map;
}

function isAvaliacaoAutomatica(nome: string): boolean {
  return /autom[aá]tica/i.test(nome);
}

// ─── Impacto Financeiro dos Erros ────────────────────────────────────────────

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

export async function calcularImpactoFinanceiro(filtros: AvaliacoesFilters): Promise<ImpactoFinanceiroResult> {
  const conditions = [];
  if (filtros.dataInicio) { const s = new Date(filtros.dataInicio); if (!isNaN(s.getTime())) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
  if (filtros.dataFim) { const e = new Date(filtros.dataFim); if (!isNaN(e.getTime())) { e.setHours(23, 59, 59, 999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

  const records = conditions.length > 0
    ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
    : await db.select().from(curadoriaAvaliacoes);

  const imeis = records.map((r) => r.imei).filter((i): i is string => Boolean(i));
  const triagemMap = await fetchTriagemByImeis([...new Set(imeis)]);

  let erroIaOver = 0, erroIaUnder = 0;
  let erroHumOver = 0, erroHumUnder = 0;
  let usouEstimativa = false;

  for (const r of records) {
    const triagem = r.imei ? triagemMap.get(r.imei) : undefined;
    const preco = triagem?.valorVoucher ?? (parseFloat(r.precoMaximo || "0") || 0);
    if (!triagem?.valorVoucher && preco > 0) usouEstimativa = true;
    if (preco <= 0) continue;

    const paresIa: Array<[string | null, string | null]> = [
      [r.gradeIaDisplay, r.gradeCorretaDisplay],
      [r.gradeIaCarcaca, r.gradeCorretaCarcaca],
    ];
    for (const [atrib, correta] of paresIa) {
      if (atrib && correta && atrib !== correta) {
        const diff = ((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0)) * preco;
        if (diff < 0) erroIaOver += Math.abs(diff);
        else erroIaUnder += diff;
      }
    }

    const paresHum: Array<[string | null, string | null]> = [
      [r.gradeHumanoDisplay, r.gradeCorretaDisplay],
      [r.gradeHumanoCarcaca, r.gradeCorretaCarcaca],
    ];
    for (const [atrib, correta] of paresHum) {
      if (atrib && correta && atrib !== correta) {
        const diff = ((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0)) * preco;
        if (diff < 0) erroHumOver += Math.abs(diff);
        else erroHumUnder += diff;
      }
    }
  }

  return {
    erroIa: { overGrading: Math.round(erroIaOver * 100) / 100, underGrading: Math.round(erroIaUnder * 100) / 100, liquidoImpacto: Math.round((erroIaUnder - erroIaOver) * 100) / 100 },
    erroHumano: { overGrading: Math.round(erroHumOver * 100) / 100, underGrading: Math.round(erroHumUnder * 100) / 100, liquidoImpacto: Math.round((erroHumUnder - erroHumOver) * 100) / 100 },
    totalCuradorias: records.length,
    usouEstimativa,
  };
}

// ─── Ranking de Avaliadores Completo ─────────────────────────────────────────

export interface RankingAvaliadorCompleto {
  avaliadorNome: string;
  totalDispositivos: number;
  acertos: number;
  erros: number;
  assertividade: number;
  isAutomatica: boolean;
  trend: number;
}

export async function calcularRankingAvaliadorCompleto(filtros: AvaliacoesFilters): Promise<RankingAvaliadorCompleto[]> {
  const conditions = [];
  if (filtros.dataInicio) { const s = new Date(filtros.dataInicio); if (!isNaN(s.getTime())) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
  if (filtros.dataFim) { const e = new Date(filtros.dataFim); if (!isNaN(e.getTime())) { e.setHours(23, 59, 59, 999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

  const records = conditions.length > 0
    ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
    : await db.select().from(curadoriaAvaliacoes);

  const imeis = records.map((r) => r.imei).filter((i): i is string => Boolean(i));
  const triagemMap = await fetchTriagemByImeis([...new Set(imeis)]);

  const byAvaliador = new Map<string, typeof records>();
  for (const r of records) {
    const triagem = r.imei ? triagemMap.get(r.imei) : undefined;
    const nome = triagem?.avaliador || r.avaliadorHumanoId || "desconhecido";
    if (!byAvaliador.has(nome)) byAvaliador.set(nome, []);
    byAvaliador.get(nome)!.push(r);
  }

  const now = new Date();
  const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);

  function calcAcc(recs: typeof records): number {
    let a = 0, t = 0;
    for (const r of recs) {
      const dOk = r.gradeHumanoDisplay && r.gradeCorretaDisplay ? r.gradeHumanoDisplay === r.gradeCorretaDisplay : null;
      const cOk = r.gradeHumanoCarcaca && r.gradeCorretaCarcaca ? r.gradeHumanoCarcaca === r.gradeCorretaCarcaca : null;
      if (dOk !== null || cOk !== null) { t++; if ((dOk === null || dOk) && (cOk === null || cOk)) a++; }
    }
    return t > 0 ? (a / t) * 100 : 0;
  }

  return Array.from(byAvaliador.entries())
    .map(([nome, recs]) => {
      let acertos = 0, total = 0;
      for (const r of recs) {
        const dOk = r.gradeHumanoDisplay && r.gradeCorretaDisplay ? r.gradeHumanoDisplay === r.gradeCorretaDisplay : null;
        const cOk = r.gradeHumanoCarcaca && r.gradeCorretaCarcaca ? r.gradeHumanoCarcaca === r.gradeCorretaCarcaca : null;
        if (dOk !== null || cOk !== null) { total++; if ((dOk === null || dOk) && (cOk === null || cOk)) acertos++; }
      }

      const recent = recs.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff7);
      const previous = recs.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff14 && new Date(r.dataCuradoria) < cutoff7);

      return {
        avaliadorNome: nome,
        totalDispositivos: recs.length,
        acertos,
        erros: total - acertos,
        assertividade: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0,
        isAutomatica: isAvaliacaoAutomatica(nome),
        trend: Math.round((calcAcc(recent) - calcAcc(previous)) * 10) / 10,
      };
    })
    .sort((a, b) => b.assertividade - a.assertividade);
}

// ─── Evolução Avaliadores ────────────────────────────────────────────────────

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

export async function calcularAvaliadorEvolucao(
  filtros: AvaliacoesFilters,
  granularidade: "dia" | "mes" = "dia"
): Promise<{ avaliadores: AvaliadorEvolucaoItem[] }> {
  const conditions = [];
  if (filtros.dataInicio) { const s = new Date(filtros.dataInicio); if (!isNaN(s.getTime())) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
  if (filtros.dataFim) { const e = new Date(filtros.dataFim); if (!isNaN(e.getTime())) { e.setHours(23, 59, 59, 999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

  const records = conditions.length > 0
    ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
    : await db.select().from(curadoriaAvaliacoes);

  const imeis = records.map((r) => r.imei).filter((i): i is string => Boolean(i));
  const triagemMap = await fetchTriagemByImeis([...new Set(imeis)]);

  function getPeriodoKey(date: Date): string {
    if (granularidade === "mes") return date.toISOString().slice(0, 7);
    return date.toISOString().slice(0, 10);
  }

  const grouped = new Map<string, Map<string, { acertos: number; total: number }>>();

  for (const r of records) {
    if (!r.dataCuradoria) continue;
    const triagem = r.imei ? triagemMap.get(r.imei) : undefined;
    const nome = triagem?.avaliador || r.avaliadorHumanoId || "desconhecido";
    const periodo = getPeriodoKey(new Date(r.dataCuradoria));

    if (!grouped.has(nome)) grouped.set(nome, new Map());
    const avMap = grouped.get(nome)!;
    if (!avMap.has(periodo)) avMap.set(periodo, { acertos: 0, total: 0 });
    const bucket = avMap.get(periodo)!;

    const displayOk = r.gradeHumanoDisplay && r.gradeCorretaDisplay
      ? r.gradeHumanoDisplay === r.gradeCorretaDisplay : null;
    const carcacaOk = r.gradeHumanoCarcaca && r.gradeCorretaCarcaca
      ? r.gradeHumanoCarcaca === r.gradeCorretaCarcaca : null;

    if (displayOk !== null || carcacaOk !== null) {
      bucket.total++;
      if ((displayOk === null || displayOk) && (carcacaOk === null || carcacaOk)) bucket.acertos++;
    }
  }

  const avaliadores = Array.from(grouped.entries()).map(([nome, periodos]) => ({
    nome,
    isAutomatica: isAvaliacaoAutomatica(nome),
    dados: Array.from(periodos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, { acertos, total }]) => ({
        periodo,
        total,
        acertos,
        assertividade: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0,
      })),
  }));

  return { avaliadores };
}
