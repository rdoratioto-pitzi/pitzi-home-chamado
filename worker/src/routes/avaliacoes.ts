/**
 * Rotas para módulo de Avaliações Estéticas — Hono (Cloudflare Worker)
 * Espelho de server/routes/avaliacoes.ts
 */
import { Hono } from "hono";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { AppEnv } from "../index";
import {
  curadoriaAvaliacoes,
  curadoriaConfiguracoes,
} from "../../../shared/schema";

// ─── Constants & helpers (duplicados do service para isolamento do worker) ────

const PIPELINE_RS_BASE = "https://dash.renovsmart.com.br/api";
const DESCONTO_POR_GRADE: Record<string, number> = { A: 0, B: 0.25, C: 0.70 };

type Grade = "A" | "B" | "C";

async function fetchAvaliacoesDetalhes(
  token: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const url = `${PIPELINE_RS_BASE}/avaliacoes-ia/detalhes?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API detalhes error: ${response.status}`);
  const data = await response.json() as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchAvaliacoesImei(token: string, limitDate: string): Promise<any[]> {
  const url = `${PIPELINE_RS_BASE}/avaliacoes-ia/imei?limit_date=${encodeURIComponent(limitDate)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API imei error: ${response.status}`);
  const data = await response.json() as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function isDisplayFoto(desc: string): boolean {
  const lower = desc.toLowerCase();
  return ["tela", "frente", "front", "display", "screen"].some((p) => lower.includes(p));
}

function isCarcacaFoto(desc: string): boolean {
  const lower = desc.toLowerCase();
  return ["traseira", "lateral", "superior", "inferior", "parte", "back", "rear", "side", "top", "bottom"].some((p) => lower.includes(p));
}

function assignImeiImageSlot(slots: ImeiImageSlots, desc: string, url: string): void {
  const lower = desc.toLowerCase();
  if (lower.includes("traseira") || lower.includes("back") || lower.includes("rear")) {
    if (!slots.imagemTraseira) slots.imagemTraseira = url;
  } else if ((lower.includes("lateral direita") || lower.includes("lateral d")) && !slots.imagemLateral1) {
    slots.imagemLateral1 = url;
  } else if ((lower.includes("lateral esquerda") || lower.includes("lateral e")) && !slots.imagemLateral2) {
    slots.imagemLateral2 = url;
  } else if (lower.includes("lateral") && !slots.imagemLateral1) {
    slots.imagemLateral1 = url;
  } else if (!slots.imagemDetalhe) {
    slots.imagemDetalhe = url;
  }
}

interface ImeiImageSlots {
  imagemFrontal: string | null;
  imagemTraseira: string | null;
  imagemLateral1: string | null;
  imagemLateral2: string | null;
  imagemDetalhe: string | null;
}

// Grade normalizer: D → C (POP 101 V3)
function normalizeGradeInline(raw: unknown): Grade | null {
  if (!raw) return null;
  const upper = String(raw).trim().toUpperCase();
  if (upper === "D") return "C";
  if (upper === "A" || upper === "B" || upper === "C") return upper as Grade;
  return null;
}

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };

function worstGradeInline(grades: (Grade | null)[]): Grade | null {
  const valid = grades.filter((g): g is Grade => g !== null);
  if (valid.length === 0) return null;
  return valid.reduce((worst, g) =>
    (GRADE_ORDER[g] ?? 0) > (GRADE_ORDER[worst] ?? 0) ? g : worst
  );
}

interface TradeInItem {
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
  avaliadorHumanoId: null;
  avaliadorHumanoNome: null;
  imagemFrontal: string | null;
  imagemTraseira: string | null;
  imagemLateral1: string | null;
  imagemLateral2: string | null;
  imagemDetalhe: string | null;
  linkFotos: string | null;
  foiCurado: boolean;
}

// Agrupa registros /detalhes (campos antigos, sem URL de imagem)
function agregarPorDispositivoInline(raw: any[], curadosSet: Set<string>): TradeInItem[] {
  const grouped = new Map<string, {
    imei: string; modelo: string; categoria: string; dataTradeIn: string;
    linkFotos: string | null; gradesIa: (Grade | null)[]; gradesHumano: (Grade | null)[];
  }>();

  for (const item of raw) {
    const imei: string = item.Imei || "";
    if (!imei) continue;
    const gradeIa = normalizeGradeInline(item.Grade_IA);
    const gradeHumano = normalizeGradeInline(item.Grade_Humano);
    const link = typeof item.Link_Fotos === "string" && item.Link_Fotos ? item.Link_Fotos : null;

    if (!grouped.has(imei)) {
      grouped.set(imei, {
        imei,
        modelo: item.Modelo || item.Categoria || "",
        categoria: item.Categoria || "smartphone",
        dataTradeIn: item.Data_Avaliacao || new Date().toISOString(),
        linkFotos: link,
        gradesIa: [],
        gradesHumano: [],
      });
    }
    const d = grouped.get(imei)!;
    d.gradesIa.push(gradeIa);
    d.gradesHumano.push(gradeHumano);
    if (link && !d.linkFotos) d.linkFotos = link;
  }

  return Array.from(grouped.values()).map((d): TradeInItem => {
    const gradeIa = worstGradeInline(d.gradesIa);
    const gradeHumano = worstGradeInline(d.gradesHumano);
    return {
      tradeInId: d.imei,
      imei: d.imei,
      modelo: d.modelo,
      categoria: d.categoria,
      dataTradeIn: d.dataTradeIn,
      precoMaximo: 0,
      gradeIaDisplay: gradeIa,
      gradeIaCarcaca: gradeIa,
      gradeHumanoDisplay: gradeHumano,
      gradeHumanoCarcaca: gradeHumano,
      avaliadorHumanoId: null,
      avaliadorHumanoNome: null,
      imagemFrontal: null,
      imagemTraseira: null,
      imagemLateral1: null,
      imagemLateral2: null,
      imagemDetalhe: null,
      linkFotos: d.linkFotos,
      foiCurado: curadosSet.has(d.imei),
    };
  });
}

// Agrupa registros /imei (campos novos com acentos/espaços, inclui Url Captura)
function agregarPorDispositivoImei(raw: any[], curadosSet: Set<string>): TradeInItem[] {
  const grouped = new Map<string, {
    imei: string; dataTradeIn: string; linkFotos: string | null;
    displayGradesIa: (Grade | null)[]; displayGradesHumano: (Grade | null)[];
    carcacaGradesIa: (Grade | null)[]; carcacaGradesHumano: (Grade | null)[];
    slots: ImeiImageSlots;
  }>();

  for (const item of raw) {
    const imei: string = item["Imei"] || "";
    if (!imei) continue;

    const desc: string = item["Descrição Captura"] || "";
    if (desc.toLowerCase().includes("video") || desc.toLowerCase().includes("360")) continue;

    const gradeIa = normalizeGradeInline(item["Nota IA"]);
    const gradeHumano = normalizeGradeInline(item["Nota Humana"]);
    const urlCaptura: string | null = item["Url Captura"] || null;

    if (!grouped.has(imei)) {
      grouped.set(imei, {
        imei,
        dataTradeIn: item["Criação Pedido"] || new Date().toISOString(),
        linkFotos: null,
        displayGradesIa: [],
        displayGradesHumano: [],
        carcacaGradesIa: [],
        carcacaGradesHumano: [],
        slots: { imagemFrontal: null, imagemTraseira: null, imagemLateral1: null, imagemLateral2: null, imagemDetalhe: null },
      });
    }

    const d = grouped.get(imei)!;

    if (isDisplayFoto(desc)) {
      d.displayGradesIa.push(gradeIa);
      d.displayGradesHumano.push(gradeHumano);
      if (urlCaptura && !d.slots.imagemFrontal) d.slots.imagemFrontal = urlCaptura;
    } else if (isCarcacaFoto(desc)) {
      d.carcacaGradesIa.push(gradeIa);
      d.carcacaGradesHumano.push(gradeHumano);
      if (urlCaptura) assignImeiImageSlot(d.slots, desc, urlCaptura);
    } else {
      d.displayGradesIa.push(gradeIa);
      d.carcacaGradesIa.push(gradeIa);
      d.displayGradesHumano.push(gradeHumano);
      d.carcacaGradesHumano.push(gradeHumano);
    }
  }

  return Array.from(grouped.values()).map((d): TradeInItem => {
    const allIaGrades = [...d.displayGradesIa, ...d.carcacaGradesIa];
    const allHumanoGrades = [...d.displayGradesHumano, ...d.carcacaGradesHumano];
    return {
      tradeInId: d.imei,
      imei: d.imei,
      modelo: "",
      categoria: "smartphone",
      dataTradeIn: d.dataTradeIn,
      precoMaximo: 0,
      gradeIaDisplay: worstGradeInline(d.displayGradesIa) ?? worstGradeInline(allIaGrades),
      gradeIaCarcaca: worstGradeInline(d.carcacaGradesIa) ?? worstGradeInline(allIaGrades),
      gradeHumanoDisplay: worstGradeInline(d.displayGradesHumano) ?? worstGradeInline(allHumanoGrades),
      gradeHumanoCarcaca: worstGradeInline(d.carcacaGradesHumano) ?? worstGradeInline(allHumanoGrades),
      avaliadorHumanoId: null,
      avaliadorHumanoNome: null,
      imagemFrontal: d.slots.imagemFrontal,
      imagemTraseira: d.slots.imagemTraseira,
      imagemLateral1: d.slots.imagemLateral1,
      imagemLateral2: d.slots.imagemLateral2,
      imagemDetalhe: d.slots.imagemDetalhe,
      linkFotos: d.linkFotos,
      foiCurado: curadosSet.has(d.imei),
    };
  });
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


function calcAccuracy(records: any[], tipo: "ia" | "humano", area: "display" | "carcaca" | "ambas"): number {
  let correct = 0, total = 0;
  for (const r of records) {
    if (area === "display" || area === "ambas") {
      const atrib = tipo === "ia" ? r.gradeIaDisplay : r.gradeHumanoDisplay;
      if (atrib && r.gradeCorretaDisplay) { total++; if (atrib === r.gradeCorretaDisplay) correct++; }
    }
    if (area === "carcaca" || area === "ambas") {
      const atrib = tipo === "ia" ? r.gradeIaCarcaca : r.gradeHumanoCarcaca;
      if (atrib && r.gradeCorretaCarcaca) { total++; if (atrib === r.gradeCorretaCarcaca) correct++; }
    }
  }
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
}

function calcCustoErroTipo(records: any[], tipo: "ia" | "humano"): number {
  let total = 0;
  for (const r of records) {
    const preco = parseFloat(r.precoMaximo || "0") || 0;
    const pares: Array<[string | null, string | null]> = [
      [tipo === "ia" ? r.gradeIaDisplay : r.gradeHumanoDisplay, r.gradeCorretaDisplay],
      [tipo === "ia" ? r.gradeIaCarcaca : r.gradeHumanoCarcaca, r.gradeCorretaCarcaca],
    ];
    for (const [atrib, correta] of pares) {
      if (atrib && correta && atrib !== correta) {
        total += Math.abs((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0)) * preco;
      }
    }
  }
  return Math.round(total * 100) / 100;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const avaliacoes = new Hono<AppEnv>();

avaliacoes.get("/api/avaliacoes/trade-ins", async (c) => {
  try {
    const { data_inicio, data_fim, categoria, page = "1", limit = "50" } = c.req.query();
    const db = c.get("db");
    const token = c.env.RENOVSMART_API_TOKEN || "Renov123";

    // Default date range: last 30 days if not provided
    const today = new Date();
    const endDate = data_fim || today.toISOString().slice(0, 10);
    const startDefault = new Date(today); startDefault.setDate(startDefault.getDate() - 30);
    const startDate = data_inicio || startDefault.toISOString().slice(0, 10);

    let items: TradeInItem[] = [];
    try {
      const raw = await fetchAvaliacoesDetalhes(token, startDate, endDate);
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).catch(() => []);
      const curadosSet = new Set(curados.map((c) => c.tradeInId));
      items = agregarPorDispositivoInline(raw, curadosSet);
    } catch {
      console.error("[avaliacoes] fetchAvaliacoesDetalhes falhou em /trade-ins — retornando lista vazia");
      items = [];
    }

    if (categoria) items = items.filter((i) => i.categoria.toLowerCase().includes(categoria.toLowerCase()));

    const total = items.length;
    const pageNum = parseInt(page), limitNum = parseInt(limit);
    const data = items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return c.json({ success: true, data, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/trade-ins/:tradeInId", async (c) => {
  try {
    const tradeInId = c.req.param("tradeInId");
    const db = c.get("db");
    const token = c.env.RENOVSMART_API_TOKEN || "Renov123";

    let item: TradeInItem | null = null;
    try {
      const today = new Date();
      const endDate = today.toISOString().slice(0, 10);
      const startDefault = new Date(today); startDefault.setDate(startDefault.getDate() - 30);
      const startDate = startDefault.toISOString().slice(0, 10);

      const raw = await fetchAvaliacoesDetalhes(token, startDate, endDate);
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).where(eq(curadoriaAvaliacoes.tradeInId, tradeInId)).catch(() => []);
      const curadosSet = new Set(curados.map((c) => c.tradeInId));
      const aggregated = agregarPorDispositivoInline(raw, curadosSet);
      item = aggregated.find((i) => i.imei === tradeInId) ?? null;
    } catch {
      console.error(`[avaliacoes] fetchAvaliacoesDetalhes falhou para tradeInId=${tradeInId} — retornando null`);
      item = null;
    }
    if (!item) return c.json({ success: false, error: "Trade-in não encontrado" }, 404);
    return c.json({ success: true, data: item });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/avaliadores", async (c) => {
  try {
    // A API RenovSmart não expõe lista de avaliadores — retornar lista vazia
    return c.json({ success: true, data: [] });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.post("/api/avaliacoes/curadoria", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json() as any;
    const { tradeInId } = body;
    if (!tradeInId) return c.json({ success: false, error: "tradeInId é obrigatório" }, 400);

    const db = c.get("db");
    const [saved] = await db.insert(curadoriaAvaliacoes).values({
      tradeInId,
      imei: body.imei ?? null,
      modelo: body.modelo ?? null,
      categoria: body.categoria ?? null,
      gradeIaDisplay: body.gradeIaDisplay ?? null,
      gradeIaCarcaca: body.gradeIaCarcaca ?? null,
      gradeHumanoDisplay: body.gradeHumanoDisplay ?? null,
      gradeHumanoCarcaca: body.gradeHumanoCarcaca ?? null,
      avaliadorHumanoId: body.avaliadorHumanoId ?? null,
      gradeCorretaDisplay: body.gradeCorretaDisplay ?? null,
      gradeCorretaCarcaca: body.gradeCorretaCarcaca ?? null,
      revisaoAvaliador: body.revisaoAvaliador ?? false,
      revisaoTipo: body.revisaoTipo ?? null,
      curadorId: user.userId,
      observacao: body.observacao ?? null,
      dataTradeIn: body.dataTradeIn ? new Date(body.dataTradeIn) : null,
      precoMaximo: body.precoMaximo ? String(body.precoMaximo) : null,
      imagemFrontal: body.imagemFrontal ?? null,
      imagemTraseira: body.imagemTraseira ?? null,
      imagemLateral1: body.imagemLateral1 ?? null,
      imagemLateral2: body.imagemLateral2 ?? null,
      imagemDetalhe: body.imagemDetalhe ?? null,
      tenantId: null,
    }).returning();

    return c.json({ success: true, data: saved }, 201);
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/curadoria/pendentes", async (c) => {
  try {
    const db = c.get("db");
    const token = c.env.RENOVSMART_API_TOKEN || "Renov123";
    const configs = await db.select().from(curadoriaConfiguracoes).catch(() => []);
    const percentual = parseFloat((configs[0] as any)?.percentualAmostragem ?? "15") || 15;

    // Buscar avaliações de ontem na API real
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let allItems: TradeInItem[] = [];
    try {
      const raw = await fetchAvaliacoesImei(token, yesterdayStr);
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).catch(() => []);
      const curadosSet = new Set(curados.map((c) => c.tradeInId));
      allItems = agregarPorDispositivoImei(raw, curadosSet);
    } catch {
      console.error("[avaliacoes] fetchAvaliacoesImei falhou em /pendentes — retornando lista vazia");
      allItems = [];
    }

    const notCurated = allItems.filter((t) => !t.foiCurado);
    const sample = Math.ceil(notCurated.length * (percentual / 100));
    return c.json({ success: true, data: notCurated.slice(0, sample), total: sample });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/curadoria", async (c) => {
  try {
    const { data_inicio, data_fim, curador_id, page = "1", limit = "50" } = c.req.query();
    const db = c.get("db");

    const conditions = [];
    if (data_inicio) { const s = parseDate(data_inicio); if (s) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }
    if (curador_id) conditions.push(eq(curadoriaAvaliacoes.curadorId, curador_id));

    const all = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions)).orderBy(desc(curadoriaAvaliacoes.dataCuradoria))
      : await db.select().from(curadoriaAvaliacoes).orderBy(desc(curadoriaAvaliacoes.dataCuradoria));

    const total = all.length;
    const pageNum = parseInt(page), limitNum = parseInt(limit);
    const data = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return c.json({ success: true, data, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/configuracoes", async (c) => {
  try {
    const db = c.get("db");
    const configs = await db.select().from(curadoriaConfiguracoes);
    return c.json({ success: true, data: configs[0] ?? { percentualAmostragem: "15", modoPrioridade: "aleatorio" } });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.put("/api/avaliacoes/configuracoes", async (c) => {
  try {
    const db = c.get("db");
    const body = await c.req.json() as any;
    const configs = await db.select().from(curadoriaConfiguracoes);

    let result;
    if (configs[0]) {
      const [updated] = await db.update(curadoriaConfiguracoes)
        .set({ ...(body.percentualAmostragem ? { percentualAmostragem: String(body.percentualAmostragem) } : {}), ...(body.modoPrioridade ? { modoPrioridade: String(body.modoPrioridade) } : {}), atualizadoEm: new Date() })
        .where(eq(curadoriaConfiguracoes.id, configs[0].id))
        .returning();
      result = updated;
    } else {
      const [created] = await db.insert(curadoriaConfiguracoes).values({ percentualAmostragem: body.percentualAmostragem ? String(body.percentualAmostragem) : "15", modoPrioridade: body.modoPrioridade ?? "aleatorio" }).returning();
      result = created;
    }
    return c.json({ success: true, data: result });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/metricas/resumo", async (c) => {
  try {
    const { data_inicio, data_fim, area = "ambas" } = c.req.query();
    const db = c.get("db");

    const conditions = [];
    if (data_inicio) { const s = parseDate(data_inicio); if (s) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
      : await db.select().from(curadoriaAvaliacoes);

    const areaTyped = (area as "display" | "carcaca" | "ambas");
    const now = new Date();
    const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
    const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);
    const recent = records.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff7);
    const previous = records.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff14 && new Date(r.dataCuradoria) < cutoff7);

    return c.json({
      success: true, data: {
        acuraciaIa: calcAccuracy(records, "ia", areaTyped),
        acuraciaHumano: calcAccuracy(records, "humano", areaTyped),
        custoErroIa: calcCustoErroTipo(records, "ia"),
        custoErroHumano: calcCustoErroTipo(records, "humano"),
        totalCurados: records.length,
        totalDisponiveis: 0,
        trendAcuraciaIa: Math.round((calcAccuracy(recent, "ia", areaTyped) - calcAccuracy(previous, "ia", areaTyped)) * 10) / 10,
        trendAcuraciaHumano: Math.round((calcAccuracy(recent, "humano", areaTyped) - calcAccuracy(previous, "humano", areaTyped)) * 10) / 10,
      }
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/metricas/evolucao", async (c) => {
  try {
    const { data_inicio, data_fim, granularidade = "diaria" } = c.req.query();
    const db = c.get("db");

    const conditions = [];
    if (data_inicio) { const s = parseDate(data_inicio); if (s) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
      : await db.select().from(curadoriaAvaliacoes);

    function getKey(date: Date): string {
      if (granularidade === "mensal") return date.toISOString().slice(0, 7);
      if (granularidade === "semanal") { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }
      return date.toISOString().slice(0, 10);
    }

    const grouped = new Map<string, any[]>();
    for (const r of records) {
      if (!r.dataCuradoria) continue;
      const key = getKey(new Date(r.dataCuradoria));
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    const data = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, grupo]) => ({
        data: date,
        acuraciaIa: calcAccuracy(grupo, "ia", "ambas"),
        acuraciaHumano: calcAccuracy(grupo, "humano", "ambas"),
        totalCurados: grupo.length,
      }));

    return c.json({ success: true, data });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/metricas/ranking-avaliadores", async (c) => {
  try {
    const { data_inicio, data_fim } = c.req.query();
    const db = c.get("db");

    const conditions = [];
    if (data_inicio) { const s = parseDate(data_inicio); if (s) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
      : await db.select().from(curadoriaAvaliacoes);

    const byAvaliador = new Map<string, any[]>();
    for (const r of records) {
      const id = r.avaliadorHumanoId || "desconhecido";
      if (!byAvaliador.has(id)) byAvaliador.set(id, []);
      byAvaliador.get(id)!.push(r);
    }

    const now = new Date();
    const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
    const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);

    const data = Array.from(byAvaliador.entries())
      .map(([avaliadorId, recs]) => {
        const recent = recs.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff7);
        const previous = recs.filter((r) => r.dataCuradoria && new Date(r.dataCuradoria) >= cutoff14 && new Date(r.dataCuradoria) < cutoff7);
        return {
          avaliadorId,
          avaliadorNome: avaliadorId,
          totalAvaliacoes: recs.length,
          acuraciaDisplay: calcAccuracy(recs, "humano", "display"),
          acuraciaCarcaca: calcAccuracy(recs, "humano", "carcaca"),
          acuraciaGeral: calcAccuracy(recs, "humano", "ambas"),
          trend: Math.round((calcAccuracy(recent, "humano", "ambas") - calcAccuracy(previous, "humano", "ambas")) * 10) / 10,
        };
      })
      .sort((a, b) => b.acuraciaGeral - a.acuraciaGeral);

    return c.json({ success: true, data });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/metricas/custo-erro", async (c) => {
  try {
    const { data_inicio, data_fim } = c.req.query();
    const db = c.get("db");

    const conditions = [];
    if (data_inicio) { const s = parseDate(data_inicio); if (s) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
      : await db.select().from(curadoriaAvaliacoes);

    const transicaoMap = new Map<string, { quantidade: number; custoTotal: number }>();
    const modeloMap = new Map<string, { custoTotal: number; quantidade: number }>();

    for (const r of records) {
      const preco = parseFloat(r.precoMaximo || "0") || 0;
      const pares: Array<[string | null, string | null]> = [
        [r.gradeIaDisplay, r.gradeCorretaDisplay],
        [r.gradeIaCarcaca, r.gradeCorretaCarcaca],
      ];
      let itemCusto = 0; let temErro = false;
      for (const [atrib, correta] of pares) {
        if (atrib && correta && atrib !== correta) {
          const diff = Math.abs((DESCONTO_POR_GRADE[atrib] ?? 0) - (DESCONTO_POR_GRADE[correta] ?? 0));
          const custo = diff * preco;
          const key = `${atrib}→${correta}`;
          const cur = transicaoMap.get(key) ?? { quantidade: 0, custoTotal: 0 };
          transicaoMap.set(key, { quantidade: cur.quantidade + 1, custoTotal: cur.custoTotal + custo });
          itemCusto += custo; temErro = true;
        }
      }
      if (temErro) {
        const modelo = r.modelo || "Desconhecido";
        const cur = modeloMap.get(modelo) ?? { custoTotal: 0, quantidade: 0 };
        modeloMap.set(modelo, { custoTotal: cur.custoTotal + itemCusto, quantidade: cur.quantidade + 1 });
      }
    }

    return c.json({
      success: true, data: {
        custoTotalIa: calcCustoErroTipo(records, "ia"),
        custoTotalHumano: calcCustoErroTipo(records, "humano"),
        breakdownPorTipoErro: Array.from(transicaoMap.entries()).map(([transicao, { quantidade, custoTotal }]) => ({ transicao, quantidade, custoTotal: Math.round(custoTotal * 100) / 100 })).sort((a, b) => b.custoTotal - a.custoTotal),
        topModelosCustoErro: Array.from(modeloMap.entries()).map(([modelo, { custoTotal, quantidade }]) => ({ modelo, custoTotal: Math.round(custoTotal * 100) / 100, quantidade })).sort((a, b) => b.custoTotal - a.custoTotal).slice(0, 5),
      }
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});

avaliacoes.get("/api/avaliacoes/metricas/matriz-confusao", async (c) => {
  try {
    const { data_inicio, data_fim, tipo = "ia", area = "ambas" } = c.req.query();
    const db = c.get("db");

    const conditions = [];
    if (data_inicio) { const s = parseDate(data_inicio); if (s) conditions.push(gte(curadoriaAvaliacoes.dataCuradoria, s)); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); conditions.push(lte(curadoriaAvaliacoes.dataCuradoria, e)); } }

    const records = conditions.length > 0
      ? await db.select().from(curadoriaAvaliacoes).where(and(...conditions))
      : await db.select().from(curadoriaAvaliacoes);

    const tipoTyped = (tipo as "ia" | "humano");
    const areaTyped = (area as "display" | "carcaca" | "ambas");
    const counts = new Map<string, number>();
    let total = 0;

    for (const r of records) {
      const pares: Array<[string | null, string | null]> = [];
      if (areaTyped === "display" || areaTyped === "ambas") {
        const atrib = tipoTyped === "ia" ? r.gradeIaDisplay : r.gradeHumanoDisplay;
        if (atrib && r.gradeCorretaDisplay) pares.push([atrib, r.gradeCorretaDisplay]);
      }
      if (areaTyped === "carcaca" || areaTyped === "ambas") {
        const atrib = tipoTyped === "ia" ? r.gradeIaCarcaca : r.gradeHumanoCarcaca;
        if (atrib && r.gradeCorretaCarcaca) pares.push([atrib, r.gradeCorretaCarcaca]);
      }
      for (const [atrib, correta] of pares) {
        counts.set(`${atrib}|${correta}`, (counts.get(`${atrib}|${correta}`) ?? 0) + 1);
        total++;
      }
    }

    const grades: Grade[] = ["A", "B", "C"];
    const matriz = grades.flatMap((atribuido) =>
      grades.map((correto) => {
        const qty = counts.get(`${atribuido}|${correto}`) ?? 0;
        return { atribuido, correto, quantidade: qty, percentual: total > 0 ? Math.round((qty / total) * 1000) / 10 : 0 };
      })
    );

    const acertos = grades.reduce((sum, g) => sum + (counts.get(`${g}|${g}`) ?? 0), 0);
    return c.json({ success: true, data: { matriz, totalAvaliacoes: total, acuraciaGeral: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0 } });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
