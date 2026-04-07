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
const PIPELINE_RS_TOKEN = "Renov123";
const DESCONTO_POR_GRADE: Record<string, number> = { A: 0, B: 0.25, C: 0.70 };

type Grade = "A" | "B" | "C";

async function fetchAvaliacoesApi(path: string): Promise<any[]> {
  const url = `${PIPELINE_RS_BASE}${path}`;
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

function normalizeItem(item: any, foiCurado: boolean) {
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
    imagemFrontal: item.imagem_frontal || null,
    imagemTraseira: item.imagem_traseira || null,
    imagemLateral1: item.imagem_lateral_1 || null,
    imagemLateral2: item.imagem_lateral_2 || null,
    imagemDetalhe: item.imagem_detalhe || null,
    linkFotos: item.link_fotos || item.linkFotos || item.Link_Fotos || null,
    foiCurado,
  };
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
    const { data_inicio, data_fim, categoria, avaliador_id, page = "1", limit = "50" } = c.req.query();
    const db = c.get("db");

    let items: ReturnType<typeof normalizeItem>[];
    try {
      const raw = await fetchAvaliacoesApi("/adm_logistica/avaliacoes");
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes);
      const curadosSet = new Set(curados.map((c) => c.tradeInId));
      items = raw.map((item) => normalizeItem(item, curadosSet.has(item.id || item.trade_in_id)));
    } catch {
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).catch(() => []);
      console.error("[avaliacoes] fetchAvaliacoesApi falhou — retornando lista vazia");
      items = [];
    }

    if (data_inicio) { const s = parseDate(data_inicio); if (s) items = items.filter((i) => { const d = parseDate(i.dataTradeIn); return d && d >= s; }); }
    if (data_fim) { const e = parseDate(data_fim); if (e) { e.setHours(23,59,59,999); items = items.filter((i) => { const d = parseDate(i.dataTradeIn); return d && d <= e; }); } }
    if (categoria) items = items.filter((i) => i.categoria.toLowerCase().includes(categoria.toLowerCase()));
    if (avaliador_id) items = items.filter((i) => i.avaliadorHumanoId === avaliador_id);

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
    let item = null;
    try {
      const raw = await fetchAvaliacoesApi(`/adm_logistica/avaliacoes/${tradeInId}`);
      const db = c.get("db");
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes).where(eq(curadoriaAvaliacoes.tradeInId, tradeInId));
      item = raw.length > 0 ? normalizeItem(raw[0], curados.length > 0) : null;
    } catch {
      console.error(`[avaliacoes] fetchAvaliacoesApi falhou para tradeInId=${tradeInId} — retornando null`);
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
    let avaliadores: { id: string; nome: string }[];
    try {
      const raw = await fetchAvaliacoesApi("/adm_logistica/avaliacoes");
      const map = new Map<string, string>();
      for (const item of raw) {
        const id = item.avaliador_humano_id || item.avaliadorHumanoId;
        const nome = item.avaliador_nome || item.avaliadorHumanoNome;
        if (id && nome) map.set(id, nome);
      }
      avaliadores = Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
    } catch {
      avaliadores = [{ id: "av1", nome: "Carlos Mendes" }, { id: "av2", nome: "Ana Lima" }, { id: "av3", nome: "Pedro Santos" }];
    }
    return c.json({ success: true, data: avaliadores });
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
    const configs = await db.select().from(curadoriaConfiguracoes).catch(() => []);
    const percentual = parseFloat((configs[0] as any)?.percentualAmostragem ?? "15") || 15;

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0,0,0,0);
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);

    let allItems: ReturnType<typeof normalizeItem>[] = [];
    try {
      const raw = await fetchAvaliacoesApi("/adm_logistica/avaliacoes");
      const curados = await db.select({ tradeInId: curadoriaAvaliacoes.tradeInId }).from(curadoriaAvaliacoes);
      const curadosSet = new Set(curados.map((c) => c.tradeInId));
      allItems = raw
        .map((item) => normalizeItem(item, curadosSet.has(item.id || item.trade_in_id)))
        .filter((i) => { const d = parseDate(i.dataTradeIn); return d && d >= yesterday && d < todayMidnight; });
    } catch {
      console.error("[avaliacoes] fetchAvaliacoesApi falhou em /pendentes — retornando lista vazia");
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
