/**
 * Rotas para módulo de Triagem — Hono (Cloudflare Worker)
 * Espelho de server/routes/triagem.ts
 */
import { Hono } from "hono";
import type { AppEnv } from "../index";

// ─── Pipeline helpers (duplicado do server para isolamento do worker) ─────────

const PIPELINE_RS_BASE = "https://dash.renovsmart.com.br/api";
const PIPELINE_RS_TOKEN = "Renov123";

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

// ─── Routes ───────────────────────────────────────────────────────────────────

export const triagem = new Hono<AppEnv>();

triagem.get("/api/triagem/resumo", async (c) => {
  try {
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
    const triagemItems = get(triagemR);
    const bloqueados = get(bloqueadosR);
    const manutencao = get(manutencaoR);
    const divergentes = get(divergentesR);

    const recebidosHoje = recebimentos.filter(r => isToday(extractItemDate(r))).length;

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

    const redeCount: Record<string, number> = {};
    for (const item of recebimentos) {
      const r = extrairRede(item);
      if (r) redeCount[r] = (redeCount[r] || 0) + 1;
    }
    const topRedes = Object.entries(redeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([rede, quantidade]) => ({ rede, quantidade }));

    return c.json({
      success: true,
      data: {
        recebidosHoje,
        emTriagem: triagemItems.length,
        bloqueados: bloqueados.length,
        emManutencao: manutencao.length,
        divergentes: divergentes.length,
        recebimentosPorDia,
        topRedes,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return c.json({ success: false, error: message }, 500);
  }
});

triagem.get("/api/triagem/recebimentos", async (c) => {
  try {
    const { page = "1", limit = "50", imei, categoria, status, rede, dataInicio, dataFim } = c.req.query();

    let items = await fetchPipelineApi("/adm_logistica/recebimentos");

    if (imei) items = items.filter(i => extrairImei(i).toLowerCase().includes(imei.toLowerCase()));
    if (categoria) items = items.filter(i => extrairCategoria(i).toLowerCase().includes(categoria.toLowerCase()));
    if (status) items = items.filter(i => extrairStatus(i).toLowerCase().includes(status.toLowerCase()));
    if (rede) items = items.filter(i => extrairRede(i).toLowerCase().includes(rede.toLowerCase()));
    if (dataInicio) {
      const start = parseDate(dataInicio);
      if (start) items = items.filter(i => { const d = parseDate(extractItemDate(i)); return d && d >= start; });
    }
    if (dataFim) {
      const end = parseDate(dataFim);
      if (end) { end.setHours(23, 59, 59, 999); items = items.filter(i => { const d = parseDate(extractItemDate(i)); return d && d <= end; }); }
    }

    const total = items.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const paginated = items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return c.json({
      success: true,
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
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return c.json({ success: false, error: message }, 500);
  }
});

triagem.get("/api/triagem/fila", async (c) => {
  try {
    const items = await fetchPipelineApi("/adm_logistica/triagem");
    const mapped = items.map(item => {
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
    return c.json({ success: true, data: mapped, total: mapped.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return c.json({ success: false, error: message }, 500);
  }
});

triagem.get("/api/triagem/desvios", async (c) => {
  try {
    const [bloqueadosR, manutencaoR, divergentesR] = await Promise.allSettled([
      fetchPipelineApi("/adm_logistica/bloqueados"),
      fetchPipelineApi("/adm_logistica/manutencao"),
      fetchPipelineApi("/adm_logistica/divergentes"),
    ]);

    const get = (r: PromiseSettledResult<any[]>) => r.status === "fulfilled" ? r.value : [];

    const mapItems = (arr: any[], tipo: string) =>
      arr.map(item => ({
        imei: extrairImei(item),
        modelo: extrairModelo(item),
        categoria: extrairCategoria(item),
        rede: extrairRede(item),
        tipoDesvio: tipo,
        dataEntrada: extractItemDate(item),
      }));

    const all = [
      ...mapItems(get(bloqueadosR), "bloqueado"),
      ...mapItems(get(manutencaoR), "manutencao"),
      ...mapItems(get(divergentesR), "divergente"),
    ];

    return c.json({ success: true, data: all, total: all.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return c.json({ success: false, error: message }, 500);
  }
});
