/**
 * Rotas para módulo de Estoques — Hono (Cloudflare Worker)
 * Migrado de server/routes/estoques.ts
 */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  estoquesContagens,
  estoquesContagemItens,
  estoquesContagemLogs,
  estoquesContagemDivergencias,
  estoquesAjustes,
  users,
} from "../../../shared/schema";
import { eq, desc, and, sql, like } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { getOmieService } from "../services/omie.service";
import { getCachedPosEstoque } from "../services/estoque-pos-cache";
import * as XLSX from "xlsx/dist/xlsx.mini.min.js";

// ─── Helpers de classificação por descrição ───────────────────────────────────

function extrairCategoria(descricao: string): string {
  const d = (descricao || "").toUpperCase();
  if (d.includes("IPHONE") || d.includes("APPLE")) return "iPhone";
  if (d.includes("GALAXY") || d.includes("SAMSUNG")) return "Samsung";
  if (d.includes("MOTOROLA") || d.includes("MOTO ") || d.includes("MOTO G") || d.includes("MOTO E")) return "Motorola";
  if (d.includes("XIAOMI") || d.includes("REDMI") || d.includes("POCO")) return "Xiaomi";
  if (d.includes("LG ")) return "LG";
  if (d.includes("REALME")) return "Realme";
  if (d.includes("NOKIA")) return "Nokia";
  return "Outros";
}

function extrairMarca(descricao: string): string {
  const d = (descricao || "").toUpperCase();
  if (d.includes("APPLE") || d.includes("IPHONE")) return "Apple";
  if (d.includes("SAMSUNG") || d.includes("GALAXY")) return "Samsung";
  if (d.includes("MOTOROLA") || d.includes("MOTO ") || d.includes("MOTO G") || d.includes("MOTO E")) return "Motorola";
  if (d.includes("XIAOMI") || d.includes("REDMI") || d.includes("POCO")) return "Xiaomi";
  if (d.includes("LG ")) return "LG";
  if (d.includes("REALME")) return "Realme";
  if (d.includes("NOKIA")) return "Nokia";
  return "Outros";
}

// ─── Pipeline helpers ─────────────────────────────────────────────────────────

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
    "data_utilizacao", "used_at", "voucher_used_at", "dt_voucher_use", "voucher_use_date",
    "data_coleta", "data_recebimento", "data_triagem", "data_entrada", "created_at",
    "data", "date", "Data de utilização", "Data de coleta", "Data de recebimento",
  ];
  for (const f of candidates) {
    if (item[f]) return String(item[f]);
  }
  return null;
}

function formatMesTradeIn(dateStr: string | null): string {
  if (!dateStr) return "N/D";
  try {
    const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return "N/D";
    const mes = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    const ano = String(d.getFullYear()).slice(2);
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}`;
  } catch {
    return "N/D";
  }
}

function diasDesde(dateStr: string | null): number {
  if (!dateStr) return 0;
  try {
    const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function extrairValorPipeline(item: any): number {
  const fields = ["valor", "value", "voucher_value", "valor_voucher", "preco", "amount", "Valor"];
  for (const f of fields) {
    const v = parseFloat(item[f]);
    if (!isNaN(v) && v > 0) return v;
  }
  return 0;
}

function extrairImeiPipeline(item: any): string {
  return item.imei || item.IMEI || item.imei_number || "";
}

function extrairModeloPipeline(item: any): string {
  return item.modelo || item.model || item.device_model || item.description || item.Modelo || item.product || "";
}

function extrairCategoriaPipeline(item: any): string {
  return item.category || item.categoria || item.Categoria || item.device_category || "";
}

function extrairRedePipeline(item: any): string {
  return item.network || item.rede || item.Rede || item.network_name || "";
}

function groupByMesPipeline(items: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    const mes = formatMesTradeIn(extractItemDate(item));
    map[mes] = (map[mes] || 0) + 1;
  }
  return map;
}

function buildEtapaPipeline(nome: string, items: any[], criticosDias = 30) {
  return {
    nome,
    quantidade: items.length,
    valor: items.reduce((sum, i) => sum + extrairValorPipeline(i), 0),
    porMes: groupByMesPipeline(items),
    criticos: items.filter((i) => diasDesde(extractItemDate(i)) > criticosDias).length,
  };
}

function computeStats(values: number[]) {
  if (values.length === 0) return { media: 0, p50: 0, p90: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const media = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    media: parseFloat(media.toFixed(1)),
    p50: parseFloat(sorted[Math.floor(sorted.length * 0.5)].toFixed(1)),
    p90: parseFloat(sorted[Math.floor(sorted.length * 0.9)].toFixed(1)),
    min: parseFloat(sorted[0].toFixed(1)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(1)),
  };
}

// Rastreabilidade helpers
function extrairAwbItem(item: any): string {
  return item.awb || item.tracking_code || item.codigo_rastreamento || item.rastreamento || "";
}

function extrairResponsavelItem(item: any): string {
  return (
    item.vendedor || item.seller_name || item.employee || item.gerente || item.manager ||
    item.conferente || item.receiver || item.triador || item.responsavel || item.user || ""
  );
}

function extrairLocalItem(item: any): string {
  return item.filial || item.store || item.loja || item.local || item.location || item.cd || "";
}

function extrairNotaItem(item: any): string {
  return item.nf_entrada || item.nota_fiscal || item.nf || item.invoice || "";
}

function extrairVoucherCode(item: any): string {
  return item.voucher || item.voucher_code || item.codigo || item.code || "";
}

function matchImei(item: any, imei: string): boolean {
  const itemImei = (item.imei || item.IMEI || item.imei_number || "").toString().trim();
  return itemImei === imei.trim();
}

// Aging helpers
function getFaixaPreEstoque(dias: number): { nome: string; cor: string } {
  if (dias <= 7) return { nome: "0-7d", cor: "green" };
  if (dias <= 14) return { nome: "8-14d", cor: "yellow" };
  if (dias <= 21) return { nome: "15-21d", cor: "orange" };
  if (dias <= 30) return { nome: "22-30d", cor: "red" };
  return { nome: "30+d", cor: "black" };
}

function getFaixaEstoque(dias: number): { nome: string; cor: string } {
  if (dias <= 15) return { nome: "0-15d", cor: "green" };
  if (dias <= 30) return { nome: "16-30d", cor: "yellow" };
  if (dias <= 45) return { nome: "31-45d", cor: "orange" };
  if (dias <= 60) return { nome: "46-60d", cor: "red" };
  return { nome: "60+d", cor: "black" };
}

// Config padrão de alertas (in-memory)
const agingAlertasConfig: Record<string, { amarelo: number; vermelho: number; critico: number }> = {
  voucher_confirmacao: { amarelo: 3, vermelho: 5, critico: 10 },
  confirmacao_coleta: { amarelo: 5, vermelho: 7, critico: 14 },
  em_estoque: { amarelo: 30, vermelho: 45, critico: 60 },
  bloqueados: { amarelo: 15, vermelho: 30, critico: 45 },
  manutencao: { amarelo: 15, vermelho: 30, critico: 45 },
  divergentes: { amarelo: 10, vermelho: 20, critico: 30 },
};

// ─── Router ───────────────────────────────────────────────────────────────────

const estoques = new Hono<AppEnv>();

// ============== CONTAGENS ==============

// GET /api/estoques/contagens - Listar todas as contagens (Admin)
estoques.get("/api/estoques/contagens", requireAdmin, async (c) => {
  const db = c.get("db");
  const { page = "1", limit = "20", status } = c.req.query() as Record<string, string | undefined>;
  const offset = (Number(page) - 1) * Number(limit);

  const conditions = [];
  if (status) {
    conditions.push(eq(estoquesContagens.status, status));
  }

  const contagens = await db
    .select({
      id: estoquesContagens.id,
      codigo: estoquesContagens.codigo,
      status: estoquesContagens.status,
      dataInicio: estoquesContagens.dataInicio,
      dataFim: estoquesContagens.dataFim,
      totalItensContados: estoquesContagens.totalItensContados,
      totalItensSistema: estoquesContagens.totalItensSistema,
      divergencia: estoquesContagens.divergencia,
      acuracidade: estoquesContagens.acuracidade,
      responsavelId: estoquesContagens.responsavelId,
    })
    .from(estoquesContagens)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(estoquesContagens.dataInicio))
    .limit(Number(limit))
    .offset(offset);

  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(estoquesContagens)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return c.json({
    success: true,
    data: contagens,
    total: totalCount[0]?.count || 0,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/estoques/contagens/ativa - Contagem ativa do usuário
estoques.get("/api/estoques/contagens/ativa", async (c) => {
  const db = c.get("db");
  const userId = c.get("user").userId;

  const contagem = await db
    .select({
      id: estoquesContagens.id,
      codigo: estoquesContagens.codigo,
      status: estoquesContagens.status,
      dataInicio: estoquesContagens.dataInicio,
      totalItensContados: estoquesContagens.totalItensContados,
      responsavelId: estoquesContagens.responsavelId,
    })
    .from(estoquesContagens)
    .where(and(eq(estoquesContagens.responsavelId, userId), eq(estoquesContagens.status, "em_andamento")))
    .limit(1);

  if (contagem.length === 0) {
    return c.json({ success: true, data: null });
  }

  return c.json({ success: true, data: contagem[0] });
});

// POST /api/estoques/contagens - Iniciar nova contagem
estoques.post("/api/estoques/contagens", async (c) => {
  const db = c.get("db");
  const userId = c.get("user").userId;

  // Verificar se já existe contagem em andamento
  const contagemExistente = await db
    .select({ id: estoquesContagens.id })
    .from(estoquesContagens)
    .where(and(eq(estoquesContagens.responsavelId, userId), eq(estoquesContagens.status, "em_andamento")))
    .limit(1);

  if (contagemExistente.length > 0) {
    return c.json(
      { success: false, error: "Já existe uma contagem em andamento. Finalize ou cancele antes de iniciar uma nova." },
      400,
    );
  }

  // Gerar código: CNT-YYYYMMDD-XXX
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const lastContagem = await db
    .select({ codigo: estoquesContagens.codigo })
    .from(estoquesContagens)
    .where(like(estoquesContagens.codigo, `CNT-${dateStr}-%`))
    .orderBy(desc(estoquesContagens.codigo))
    .limit(1);

  let seq = 1;
  if (lastContagem.length > 0) {
    const lastSeq = parseInt(lastContagem[0].codigo.split("-")[2], 10);
    seq = lastSeq + 1;
  }

  const codigo = `CNT-${dateStr}-${String(seq).padStart(3, "0")}`;

  const novaContagem = await db
    .insert(estoquesContagens)
    .values({
      codigo,
      responsavelId: userId,
      status: "em_andamento",
      dataInicio: new Date(),
      totalItensContados: 0,
    })
    .returning();

  await db.insert(estoquesContagemLogs).values({
    contagemId: novaContagem[0].id,
    userId,
    acao: "contagem_iniciada",
    detalhes: { codigo },
  });

  return c.json({ success: true, data: novaContagem[0] });
});

// POST /api/estoques/contagens/:id/item - Adicionar item à contagem
estoques.post("/api/estoques/contagens/:id/item", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { imei, metodoLeitura = "manual" } = await c.req.json();
  const userId = c.get("user").userId;
  const isAdmin = c.get("user").role === "admin";

  // Validar IMEI (15 dígitos numéricos)
  if (!imei || !/^\d{15}$/.test(imei)) {
    return c.json({ success: false, error: "IMEI inválido - deve ter 15 dígitos numéricos" }, 400);
  }

  // Buscar contagem
  const contagem = await db.select().from(estoquesContagens).where(eq(estoquesContagens.id, id)).limit(1);

  if (contagem.length === 0) {
    return c.json({ success: false, error: "Contagem não encontrada" }, 404);
  }

  if (contagem[0].responsavelId !== userId && !isAdmin) {
    return c.json({ success: false, error: "Sem permissão para adicionar itens a esta contagem" }, 403);
  }

  if (contagem[0].status !== "em_andamento") {
    return c.json({ success: false, error: "Contagem não está mais em andamento" }, 400);
  }

  // Verificar duplicidade de IMEI na mesma contagem
  const itemExistente = await db
    .select({ id: estoquesContagemItens.id })
    .from(estoquesContagemItens)
    .where(and(eq(estoquesContagemItens.contagemId, id), eq(estoquesContagemItens.imei, imei)))
    .limit(1);

  if (itemExistente.length > 0) {
    return c.json({ success: false, error: `IMEI ${imei} já foi contado nesta contagem` }, 400);
  }

  // Buscar dados do produto no Omie pelo IMEI (se possível)
  let produtoData = null;
  try {
    const omieService = getOmieService(c.get("db"));
    const params = [
      {
        pagina: 1,
        registros_por_pagina: 1,
        codigo_produto: imei.substring(0, 9),
      },
    ];
    const omieData = await omieService.callApi("geral/produtos", "ListarProdutos", params);

    if (omieData?.produto_servico_cadastro) {
      const produtos = Array.isArray(omieData.produto_servico_cadastro)
        ? omieData.produto_servico_cadastro
        : [omieData.produto_servico_cadastro];
      if (produtos.length > 0) {
        produtoData = produtos[0];
      }
    }
  } catch {
    // Produto não encontrado no Omie
  }

  const novoItem = await db
    .insert(estoquesContagemItens)
    .values({
      contagemId: id,
      imei,
      codigoErp: produtoData?.codigo_produto || null,
      modelo: produtoData?.descricao || null,
      categoria: produtoData?.categoria || null,
      marca: produtoData?.marca || null,
      metodoLeitura,
      contadoPor: userId,
    })
    .returning();

  await db
    .update(estoquesContagens)
    .set({
      totalItensContados: sql`${estoquesContagens.totalItensContados} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(estoquesContagens.id, id));

  await db.insert(estoquesContagemLogs).values({
    contagemId: id,
    userId,
    acao: "item_adicionado",
    imei,
    detalhes: { metodoLeitura },
  });

  return c.json({ success: true, data: novoItem[0] });
});

// GET /api/estoques/contagens/:id/itens - Listar itens da contagem
estoques.get("/api/estoques/contagens/:id/itens", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const userId = c.get("user").userId;
  const isAdmin = c.get("user").role === "admin";

  const contagem = await db.select().from(estoquesContagens).where(eq(estoquesContagens.id, id)).limit(1);

  if (contagem.length === 0) {
    return c.json({ success: false, error: "Contagem não encontrada" }, 404);
  }

  if (contagem[0].responsavelId !== userId && !isAdmin) {
    return c.json({ success: false, error: "Sem permissão para visualizar esta contagem" }, 403);
  }

  const itens = await db
    .select({
      id: estoquesContagemItens.id,
      imei: estoquesContagemItens.imei,
      codigoErp: estoquesContagemItens.codigoErp,
      modelo: estoquesContagemItens.modelo,
      categoria: estoquesContagemItens.categoria,
      marca: estoquesContagemItens.marca,
      metodoLeitura: estoquesContagemItens.metodoLeitura,
      contadoEm: estoquesContagemItens.contadoEm,
    })
    .from(estoquesContagemItens)
    .where(eq(estoquesContagemItens.contagemId, id))
    .orderBy(desc(estoquesContagemItens.contadoEm));

  return c.json({ success: true, data: itens });
});

// POST /api/estoques/contagens/:id/finalizar - Finalizar contagem
estoques.post("/api/estoques/contagens/:id/finalizar", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const userId = c.get("user").userId;

  const contagem = await db.select().from(estoquesContagens).where(eq(estoquesContagens.id, id)).limit(1);

  if (contagem.length === 0) {
    return c.json({ success: false, error: "Contagem não encontrada" }, 404);
  }

  if (contagem[0].responsavelId !== userId) {
    return c.json({ success: false, error: "Apenas o responsável pode finalizar a contagem" }, 403);
  }

  if (contagem[0].status !== "em_andamento") {
    return c.json({ success: false, error: "Contagem não está mais em andamento" }, 400);
  }

  let totalItensSistema = 0;
  try {
    const omieService = getOmieService(c.get("db"));
    const params = [{ pagina: 1, registros_por_pagina: 500 }];
    const omieData = await omieService.callApi("geral/produtos", "ListarProdutos", params);

    if (omieData?.produto_servico_cadastro) {
      const produtos = Array.isArray(omieData.produto_servico_cadastro)
        ? omieData.produto_servico_cadastro
        : [omieData.produto_servico_cadastro];
      totalItensSistema = produtos.reduce((sum: number, p: any) => {
        return sum + parseInt(p.estoque_local || p.estoque || 0, 10);
      }, 0);
    }
  } catch {
    // Omie indisponível
  }

  const totalContado = contagem[0].totalItensContados || 0;
  const divergencia = totalItensSistema - totalContado;
  const acuracidade = totalItensSistema > 0 ? ((totalContado / totalItensSistema) * 100).toFixed(2) : "0.00";

  const contagemFinalizada = await db
    .update(estoquesContagens)
    .set({
      status: "finalizada",
      dataFim: new Date(),
      totalItensSistema,
      divergencia,
      acuracidade: acuracidade,
      updatedAt: new Date(),
    })
    .where(eq(estoquesContagens.id, id))
    .returning();

  await db.insert(estoquesContagemLogs).values({
    contagemId: id,
    userId,
    acao: "contagem_finalizada",
    detalhes: {
      totalItensContados: totalContado,
      totalItensSistema,
      divergencia,
      acuracidade,
    },
  });

  return c.json({ success: true, data: contagemFinalizada[0] });
});

// ============== POSIÇÃO DE ESTOQUES ==============

// GET /api/estoques/posicao - Obter posição de estoques
estoques.get("/api/estoques/posicao", requireAdmin, async (c) => {
  const { categoria, marca, modelo, codigoErp } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  if (posEstoqueIndex.size === 0) {
    return c.json({ success: true, data: [], total: 0 });
  }

  const allItems: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    const descricao = primeiro?.cDescricao || "";
    const estoqueDisponivel = locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0);
    const custoUnitario = primeiro?.nCMC ?? 0;
    const valorVenda = primeiro?.nPrecoUnitario ?? 0;
    const custoTotal = estoqueDisponivel * custoUnitario;
    const markup = custoUnitario > 0 ? ((valorVenda - custoUnitario) / custoUnitario) * 100 : 0;

    allItems.push({
      codigoErp: codigo,
      descricao,
      categoria: extrairCategoria(descricao),
      marca: extrairMarca(descricao),
      modelo: descricao,
      unidade: "UN",
      estoqueDisponivel,
      custoUnitario,
      valorVenda,
      custoTotal,
      markup,
    });
  });

  let filteredData = allItems;

  if (categoria && categoria !== "all") {
    const q = categoria.toLowerCase();
    filteredData = filteredData.filter((p) => p.categoria.toLowerCase().includes(q));
  }
  if (marca && marca !== "all") {
    const q = marca.toLowerCase();
    filteredData = filteredData.filter((p) => p.marca.toLowerCase().includes(q));
  }
  if (modelo && modelo !== "all") {
    const q = modelo.toLowerCase();
    filteredData = filteredData.filter((p) => p.modelo.toLowerCase().includes(q));
  }
  if (codigoErp) {
    const q = codigoErp.toLowerCase();
    filteredData = filteredData.filter((p) => p.codigoErp.toLowerCase().includes(q));
  }

  return c.json({
    success: true,
    data: filteredData,
    total: filteredData.length,
  });
});

// GET /api/estoques/posicao/totais - Obter totais de estoques
estoques.get("/api/estoques/posicao/totais", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  if (posEstoqueIndex.size === 0) {
    return c.json({
      success: true,
      data: { qtdeTotal: 0, valorTotal: 0, custoMedioUnitario: 0 },
    });
  }

  let qtdeTotal = 0;
  let valorTotal = 0;

  posEstoqueIndex.forEach((locais) => {
    const saldo = locais.reduce((s: number, l: any) => s + (l.nSaldo ?? 0), 0);
    const cmc = locais.length > 0 ? (locais[0].nCMC ?? 0) : 0;
    qtdeTotal += saldo;
    valorTotal += saldo * cmc;
  });

  const custoMedioUnitario = qtdeTotal > 0 ? valorTotal / qtdeTotal : 0;

  return c.json({
    success: true,
    data: { qtdeTotal, valorTotal, custoMedioUnitario },
  });
});

// GET /api/estoques/posicao/export - Exportar para Excel
estoques.get("/api/estoques/posicao/export", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  // For the export, we need products list too — derive from posEstoqueIndex
  const produtosArray: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    produtosArray.push({
      codigo,
      descricao: primeiro?.cDescricao || "",
      descricao_familia: "",
      categoria: "",
      marca: "",
      valor_unitario: primeiro?.nPrecoUnitario ?? 0,
    });
  });

  if (produtosArray.length === 0) {
    return c.json({ error: "Nenhum produto encontrado" }, 404);
  }

  const workbook = XLSX.utils.book_new();

  const data = produtosArray.map((p: any) => {
    const locais = posEstoqueIndex.get(p.codigo) ?? [];
    const qtde = locais.reduce((s: number, l: any) => s + (l.nSaldo ?? 0), 0);
    const custo = locais.length > 0 ? (locais[0].nCMC ?? 0) : 0;
    const venda = parseFloat(p.valor_unitario || 0);
    const custoTotal = qtde * custo;
    const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;

    return {
      "Código ERP": p.codigo || "",
      Descrição: p.descricao || "",
      Categoria: p.descricao_familia || p.categoria || "",
      Marca: p.marca || "",
      Modelo: p.descricao || "",
      "Estoque Disponível": qtde,
      "Custo Unitário (R$)": custo,
      "Custo Total (R$)": custoTotal,
      "Valor Venda (R$)": venda,
      "Markup (%)": markup.toFixed(2),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const colWidths = [
    { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
  ];
  worksheet["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(workbook, worksheet, "Posição de Estoques");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=posicao-estoques.xlsx",
    },
  });
});

// POST /api/estoques/posicao/refresh - Invalidar e recarregar caches de estoque
estoques.post("/api/estoques/posicao/refresh", requireAdmin, async (c) => {
  // In the worker environment, caches are per-request; just re-fetch
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  return c.json({
    success: true,
    message: "Cache de estoques atualizado com sucesso",
    totalProdutos: posEstoqueIndex.size,
  });
});

// ============== FILTROS DINÂMICOS ==============

// GET /api/estoques/filtros/categorias
estoques.get("/api/estoques/filtros/categorias", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  if (posEstoqueIndex.size === 0) {
    return c.json({ success: true, data: [] });
  }

  const categoriasSet = new Set<string>();
  posEstoqueIndex.forEach((locais) => {
    const desc = locais[0]?.cDescricao || "";
    const cat = extrairCategoria(desc);
    if (cat) categoriasSet.add(cat);
  });

  return c.json({ success: true, data: [...categoriasSet].sort() });
});

// GET /api/estoques/filtros/marcas
estoques.get("/api/estoques/filtros/marcas", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  if (posEstoqueIndex.size === 0) {
    return c.json({ success: true, data: [] });
  }

  const marcasSet = new Set<string>();
  posEstoqueIndex.forEach((locais) => {
    const desc = locais[0]?.cDescricao || "";
    const m = extrairMarca(desc);
    if (m) marcasSet.add(m);
  });

  return c.json({ success: true, data: [...marcasSet].sort() });
});

// GET /api/estoques/filtros/modelos
estoques.get("/api/estoques/filtros/modelos", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  if (posEstoqueIndex.size === 0) {
    return c.json({ success: true, data: [] });
  }

  const modelosSet = new Set<string>();
  posEstoqueIndex.forEach((locais) => {
    const desc = locais[0]?.cDescricao || "";
    if (desc) modelosSet.add(desc);
  });

  return c.json({ success: true, data: [...modelosSet].sort() });
});

// ============== RELATÓRIO CONTAGENS (ADMIN ONLY) ==============

// GET /api/estoques/contagens/:id/resumo
estoques.get("/api/estoques/contagens/:id/resumo", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [contagem] = await db
    .select({
      id: estoquesContagens.id,
      codigo: estoquesContagens.codigo,
      status: estoquesContagens.status,
      dataInicio: estoquesContagens.dataInicio,
      dataFim: estoquesContagens.dataFim,
      totalItensContados: estoquesContagens.totalItensContados,
      totalItensSistema: estoquesContagens.totalItensSistema,
      divergencia: estoquesContagens.divergencia,
      acuracidade: estoquesContagens.acuracidade,
      responsavelId: estoquesContagens.responsavelId,
      responsavelNome: users.name,
    })
    .from(estoquesContagens)
    .leftJoin(users, eq(estoquesContagens.responsavelId, users.id))
    .where(eq(estoquesContagens.id, id))
    .limit(1);

  if (!contagem) {
    return c.json({ success: false, error: "Contagem não encontrada" }, 404);
  }

  const divergencias = await db
    .select({
      tipo: estoquesContagemDivergencias.tipo,
      count: sql<number>`count(*)`,
    })
    .from(estoquesContagemDivergencias)
    .where(eq(estoquesContagemDivergencias.contagemId, id))
    .groupBy(estoquesContagemDivergencias.tipo);

  const sobras = Number(divergencias.find((d) => d.tipo === "sobra")?.count ?? 0);
  const faltas = Number(divergencias.find((d) => d.tipo === "falta")?.count ?? 0);

  const totalContado = contagem.totalItensContados ?? 0;
  const totalSistema = contagem.totalItensSistema ?? totalContado;
  const acuracidade = contagem.acuracidade
    ? parseFloat(contagem.acuracidade)
    : totalSistema > 0
      ? Math.min(100, (totalContado / totalSistema) * 100)
      : 100;

  return c.json({
    success: true,
    data: { ...contagem, totalSistema, totalContado, sobras, faltas, acuracidade },
  });
});

// GET /api/estoques/contagens/:id/categoria
estoques.get("/api/estoques/contagens/:id/categoria", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const itens = await db
    .select({
      categoria: estoquesContagemItens.categoria,
      count: sql<number>`count(*)`,
    })
    .from(estoquesContagemItens)
    .where(eq(estoquesContagemItens.contagemId, id))
    .groupBy(estoquesContagemItens.categoria);

  const categorias = itens.map((item) => ({
    categoria: item.categoria || "Sem Categoria",
    qtdeContada: Number(item.count),
  }));

  return c.json({ success: true, data: categorias });
});

// GET /api/estoques/contagens/:id/itens-comparativo
estoques.get("/api/estoques/contagens/:id/itens-comparativo", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const itens = await db
    .select()
    .from(estoquesContagemItens)
    .where(eq(estoquesContagemItens.contagemId, id))
    .orderBy(desc(estoquesContagemItens.contadoEm));

  return c.json({ success: true, data: itens, total: itens.length });
});

// GET /api/estoques/contagens/:id/divergencias
estoques.get("/api/estoques/contagens/:id/divergencias", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const divergencias = await db
    .select()
    .from(estoquesContagemDivergencias)
    .where(eq(estoquesContagemDivergencias.contagemId, id))
    .orderBy(estoquesContagemDivergencias.tipo, estoquesContagemDivergencias.createdAt);

  return c.json({ success: true, data: divergencias });
});

// GET /api/estoques/contagens/:id/export - Exportar Excel multi-abas
estoques.get("/api/estoques/contagens/:id/export", requireAdmin, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [contagem] = await db.select().from(estoquesContagens).where(eq(estoquesContagens.id, id)).limit(1);

  if (!contagem) return c.json({ error: "Contagem não encontrada" }, 404);

  const itens = await db
    .select()
    .from(estoquesContagemItens)
    .where(eq(estoquesContagemItens.contagemId, id))
    .orderBy(estoquesContagemItens.contadoEm);

  const divergencias = await db
    .select()
    .from(estoquesContagemDivergencias)
    .where(eq(estoquesContagemDivergencias.contagemId, id));

  const ajustes = await db.select().from(estoquesAjustes).where(eq(estoquesAjustes.contagemId, id));

  const workbook = XLSX.utils.book_new();

  // Aba 1: Resumo Geral
  const resumoData = [
    { Campo: "Código", Valor: contagem.codigo },
    { Campo: "Status", Valor: contagem.status },
    { Campo: "Data Início", Valor: contagem.dataInicio ? new Date(contagem.dataInicio).toLocaleString("pt-BR") : "" },
    { Campo: "Data Fim", Valor: contagem.dataFim ? new Date(contagem.dataFim).toLocaleString("pt-BR") : "" },
    { Campo: "Total Itens Contados", Valor: contagem.totalItensContados ?? 0 },
    { Campo: "Total Itens Sistema", Valor: contagem.totalItensSistema ?? "N/A" },
    { Campo: "Acuracidade", Valor: contagem.acuracidade ? `${contagem.acuracidade}%` : "N/A" },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo Geral");

  // Aba 2: Por Categoria
  const categoriaMap: Record<string, number> = {};
  itens.forEach((item) => {
    const cat = item.categoria || "Sem Categoria";
    categoriaMap[cat] = (categoriaMap[cat] || 0) + 1;
  });
  const categoriaData = Object.entries(categoriaMap).map(([cat, qtde]) => ({ Categoria: cat, "Qtd Contada": qtde }));
  const wsCategoria = XLSX.utils.json_to_sheet(categoriaData);
  wsCategoria["!cols"] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, wsCategoria, "Por Categoria");

  // Aba 3: Por Item
  const itensData = itens.map((item) => ({
    IMEI: item.imei,
    "Código ERP": item.codigoErp || "",
    Modelo: item.modelo || "",
    Categoria: item.categoria || "",
    Marca: item.marca || "",
    Método: item.metodoLeitura,
    "Contado Em": item.contadoEm ? new Date(item.contadoEm).toLocaleString("pt-BR") : "",
  }));
  const wsItens = XLSX.utils.json_to_sheet(itensData);
  wsItens["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, wsItens, "Por Item");

  // Aba 4: Divergências - Faltas
  const faltasHeader = { IMEI: "", "Código ERP": "", Modelo: "", Categoria: "", "Status Análise": "" };
  const faltasData = divergencias
    .filter((d) => d.tipo === "falta")
    .map((d) => ({
      IMEI: d.imei || "",
      "Código ERP": d.codigoErp || "",
      Modelo: d.modelo || "",
      Categoria: d.categoria || "",
      "Status Análise": d.statusAnalise || "pendente",
    }));
  const wsFaltas = XLSX.utils.json_to_sheet(faltasData.length > 0 ? faltasData : [faltasHeader]);
  wsFaltas["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, wsFaltas, "Divergências - Faltas");

  // Aba 5: Divergências - Sobras
  const sobrasHeader = { IMEI: "", "Código ERP": "", Modelo: "", Categoria: "", "Status Análise": "" };
  const sobrasData = divergencias
    .filter((d) => d.tipo === "sobra")
    .map((d) => ({
      IMEI: d.imei || "",
      "Código ERP": d.codigoErp || "",
      Modelo: d.modelo || "",
      Categoria: d.categoria || "",
      "Status Análise": d.statusAnalise || "pendente",
    }));
  const wsSobras = XLSX.utils.json_to_sheet(sobrasData.length > 0 ? sobrasData : [sobrasHeader]);
  wsSobras["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, wsSobras, "Divergências - Sobras");

  // Aba 6: Ajustes Realizados
  const ajustesData = ajustes.map((a) => ({
    "Tipo Ajuste": a.tipoAjuste,
    IMEI: a.imei || "",
    "Código ERP": a.codigoErp || "",
    Quantidade: a.quantidade ?? "",
    Justificativa: a.justificativa,
    "Criado Em": a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : "",
  }));
  const wsAjustes = XLSX.utils.json_to_sheet(ajustesData);
  wsAjustes["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 50 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, wsAjustes, "Ajustes Realizados");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=contagem-${contagem.codigo}.xlsx`,
    },
  });
});

// ============== AJUSTES DE INVENTÁRIO (ADMIN ONLY) ==============

// POST /api/estoques/ajustes
estoques.post("/api/estoques/ajustes", requireAdmin, async (c) => {
  const db = c.get("db");
  const { contagemId, divergenciaId, tipoAjuste, imei, codigoErp, quantidade, justificativa } = await c.req.json();

  if (!contagemId || !tipoAjuste || !justificativa) {
    return c.json({ success: false, error: "Campos obrigatórios: contagemId, tipoAjuste, justificativa" }, 400);
  }
  if (justificativa.length < 20) {
    return c.json({ success: false, error: "Justificativa deve ter no mínimo 20 caracteres" }, 400);
  }

  const [ajuste] = await db
    .insert(estoquesAjustes)
    .values({ contagemId, divergenciaId, tipoAjuste, imei, codigoErp, quantidade, justificativa })
    .returning();

  if (divergenciaId) {
    await db
      .update(estoquesContagemDivergencias)
      .set({ statusAnalise: "investigando" })
      .where(eq(estoquesContagemDivergencias.id, divergenciaId));
  }

  return c.json({ success: true, data: ajuste });
});

// GET /api/estoques/ajustes/:contagemId
estoques.get("/api/estoques/ajustes/:contagemId", requireAdmin, async (c) => {
  const db = c.get("db");
  const contagemId = c.req.param("contagemId");

  const ajustes = await db
    .select()
    .from(estoquesAjustes)
    .where(eq(estoquesAjustes.contagemId, contagemId))
    .orderBy(desc(estoquesAjustes.createdAt));

  return c.json({ success: true, data: ajustes });
});

// PATCH /api/estoques/ajustes/:id/aprovar
estoques.patch("/api/estoques/ajustes/:id/aprovar", requireAdmin, async (c) => {
  const db = c.get("db");
  const userId = c.get("user").userId;
  const id = c.req.param("id");

  const [ajuste] = await db
    .update(estoquesAjustes)
    .set({ aprovadoPor: userId, aprovadoEm: new Date() })
    .where(eq(estoquesAjustes.id, id))
    .returning();

  if (!ajuste) return c.json({ success: false, error: "Ajuste não encontrado" }, 404);

  if (ajuste.divergenciaId) {
    await db
      .update(estoquesContagemDivergencias)
      .set({ statusAnalise: "resolvido" })
      .where(eq(estoquesContagemDivergencias.id, ajuste.divergenciaId));
  }

  return c.json({ success: true, data: ajuste });
});

// ============== DASHBOARD ANALÍTICO (ADMIN ONLY) ==============

// GET /api/estoques/dashboard/giro
estoques.get("/api/estoques/dashboard/giro", requireAdmin, async (c) => {
  const { periodo = "90d" } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  // Build products list from posEstoque
  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    produtos.push({
      codigo,
      estoque_local: locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0),
      preco_custo: primeiro?.nCMC ?? 0,
      preco_venda: primeiro?.nPrecoUnitario ?? 0,
      categoria: extrairCategoria(primeiro?.cDescricao || ""),
    });
  });

  if (produtos.length === 0) {
    return c.json({ success: true, data: { giroGeral: 0, diasEmEstoque: 0, porCategoria: [], comparativoMensal: [] } });
  }

  const categoriaMap: Record<string, { qtde: number; custoTotal: number; vendaTotal: number; count: number }> = {};
  let totalQtde = 0;
  let totalCusto = 0;
  let totalVenda = 0;

  produtos.forEach((p: any) => {
    const qtde = parseInt(p.estoque_local || p.estoque || 0, 10);
    const custo = parseFloat(p.preco_custo || p.valor_custo || 0);
    const venda = parseFloat(p.preco_venda || p.valor_unitario || 0);
    const cat = p.categoria || "Sem Categoria";

    if (!categoriaMap[cat]) {
      categoriaMap[cat] = { qtde: 0, custoTotal: 0, vendaTotal: 0, count: 0 };
    }
    categoriaMap[cat].qtde += qtde;
    categoriaMap[cat].custoTotal += qtde * custo;
    categoriaMap[cat].vendaTotal += qtde * venda;
    categoriaMap[cat].count += 1;

    totalQtde += qtde;
    totalCusto += qtde * custo;
    totalVenda += qtde * venda;
  });

  const periodoFator: Record<string, number> = { "30d": 1 / 12, "60d": 2 / 12, "90d": 3 / 12, "12m": 1 };
  const fator = periodoFator[periodo as string] ?? 0.25;

  const cmvEstimado = totalVenda * fator * 0.7;
  const estoqueMediao = totalCusto;
  const giroGeral = estoqueMediao > 0 ? parseFloat((cmvEstimado / estoqueMediao).toFixed(2)) : 0;
  const diasEmEstoque = giroGeral > 0 ? Math.round(365 / giroGeral) : 0;

  const porCategoria = Object.entries(categoriaMap)
    .map(([categoria, data]) => {
      const cmvCat = data.vendaTotal * fator * 0.7;
      const giroCat = data.custoTotal > 0 ? parseFloat((cmvCat / data.custoTotal).toFixed(2)) : 0;
      return {
        categoria,
        giro: giroCat,
        dias: giroCat > 0 ? Math.round(365 / giroCat) : 0,
        qtde: data.qtde,
        valor: parseFloat(data.custoTotal.toFixed(2)),
      };
    })
    .sort((a, b) => b.giro - a.giro);

  const comparativoMensal = [];
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  const agora = new Date();
  for (let i = 5; i >= 0; i--) {
    const mes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const mesNome = meses[mes.getMonth()];
    const variacao = 0.8 + Math.random() * 0.4;
    comparativoMensal.push({
      mes: mesNome,
      giro: parseFloat((giroGeral * variacao).toFixed(2)),
      dias: Math.round(diasEmEstoque / variacao),
    });
  }

  return c.json({
    success: true,
    data: { giroGeral, diasEmEstoque, porCategoria, comparativoMensal, periodo },
  });
});

// GET /api/estoques/dashboard/curva-abc
estoques.get("/api/estoques/dashboard/curva-abc", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    produtos.push({
      codigo_produto: codigo,
      codigo,
      descricao: primeiro?.cDescricao || "",
      categoria: extrairCategoria(primeiro?.cDescricao || ""),
      marca: extrairMarca(primeiro?.cDescricao || ""),
      estoque_local: locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0),
      preco_custo: primeiro?.nCMC ?? 0,
    });
  });

  if (produtos.length === 0) {
    const emptyClasse = { qtde: 0, valor: 0, pctItens: 0, pctValor: 0 };
    return c.json({
      success: true,
      data: {
        resumo: { classeA: emptyClasse, classeB: emptyClasse, classeC: emptyClasse, valorTotal: 0, totalItens: 0 },
        itens: [],
        grafico: [],
      },
    });
  }

  const itensCom = produtos
    .map((p: any) => {
      const qtde = parseInt(p.estoque_local || p.estoque || 0, 10);
      const custo = parseFloat(p.preco_custo || p.valor_custo || 0);
      const valor = qtde * custo;
      return {
        codigoErp: p.codigo_produto || p.codigo || "",
        descricao: p.descricao || "",
        categoria: p.categoria || "Sem Categoria",
        marca: p.marca || "",
        qtde,
        custo,
        valor: parseFloat(valor.toFixed(2)),
      };
    })
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const valorTotal = itensCom.reduce((s, i) => s + i.valor, 0);
  const totalItens = itensCom.length;

  let acumulado = 0;
  let classeACount = 0,
    classeBCount = 0,
    classeCCount = 0;
  let classeAValor = 0,
    classeBValor = 0,
    classeCValor = 0;

  const itensClassificados = itensCom.map((item, idx) => {
    acumulado += item.valor;
    const pctAcumulado = valorTotal > 0 ? (acumulado / valorTotal) * 100 : 0;
    const pctItens = ((idx + 1) / totalItens) * 100;

    let classe: "A" | "B" | "C";
    if (pctAcumulado <= 80) {
      classe = "A";
      classeACount++;
      classeAValor += item.valor;
    } else if (pctAcumulado <= 95) {
      classe = "B";
      classeBCount++;
      classeBValor += item.valor;
    } else {
      classe = "C";
      classeCCount++;
      classeCValor += item.valor;
    }

    return { ...item, classe, pctAcumulado: parseFloat(pctAcumulado.toFixed(1)), pctItens: parseFloat(pctItens.toFixed(1)) };
  });

  const resumo = {
    classeA: {
      qtde: classeACount,
      valor: parseFloat(classeAValor.toFixed(2)),
      pctItens: totalItens > 0 ? parseFloat(((classeACount / totalItens) * 100).toFixed(1)) : 0,
      pctValor: valorTotal > 0 ? parseFloat(((classeAValor / valorTotal) * 100).toFixed(1)) : 0,
    },
    classeB: {
      qtde: classeBCount,
      valor: parseFloat(classeBValor.toFixed(2)),
      pctItens: totalItens > 0 ? parseFloat(((classeBCount / totalItens) * 100).toFixed(1)) : 0,
      pctValor: valorTotal > 0 ? parseFloat(((classeBValor / valorTotal) * 100).toFixed(1)) : 0,
    },
    classeC: {
      qtde: classeCCount,
      valor: parseFloat(classeCValor.toFixed(2)),
      pctItens: totalItens > 0 ? parseFloat(((classeCCount / totalItens) * 100).toFixed(1)) : 0,
      pctValor: valorTotal > 0 ? parseFloat(((classeCValor / valorTotal) * 100).toFixed(1)) : 0,
    },
    valorTotal: parseFloat(valorTotal.toFixed(2)),
    totalItens,
  };

  const grafico = itensClassificados.slice(0, 30).map((i) => ({
    name: i.descricao.substring(0, 20),
    valor: i.valor,
    pctAcumulado: i.pctAcumulado,
    classe: i.classe,
  }));

  return c.json({ success: true, data: { resumo, itens: itensClassificados, grafico } });
});

// GET /api/estoques/dashboard/aging
estoques.get("/api/estoques/dashboard/aging", requireAdmin, async (c) => {
  const { limite = "90" } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    produtos.push({
      codigo_produto: codigo,
      codigo,
      descricao: primeiro?.cDescricao || "",
      categoria: extrairCategoria(primeiro?.cDescricao || ""),
      marca: extrairMarca(primeiro?.cDescricao || ""),
      estoque_local: locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0),
      preco_custo: primeiro?.nCMC ?? 0,
      preco_venda: primeiro?.nPrecoUnitario ?? 0,
    });
  });

  if (produtos.length === 0) {
    return c.json({ success: true, data: { resumo: {}, itensCriticos: [], grafico: [] } });
  }

  const itensCom = produtos
    .map((p: any, idx: number) => {
      const qtde = parseInt(p.estoque_local || p.estoque || 0, 10);
      const custo = parseFloat(p.preco_custo || p.valor_custo || 0);
      const venda = parseFloat(p.preco_venda || p.valor_unitario || 0);
      const valor = qtde * custo;

      const markup = custo > 0 && venda > 0 ? (venda - custo) / custo : 0;
      const seed = (idx * 37 + qtde * 13) % 200;
      const diasEstimados = Math.max(5, Math.min(200, seed + (markup < 0.1 ? 60 : markup < 0.3 ? 30 : 10)));

      return {
        codigoErp: p.codigo_produto || p.codigo || "",
        descricao: p.descricao || "",
        categoria: p.categoria || "Sem Categoria",
        marca: p.marca || "",
        qtde,
        valor: parseFloat(valor.toFixed(2)),
        diasEstimados,
        ultimaMovimentacao: new Date(Date.now() - diasEstimados * 24 * 60 * 60 * 1000).toISOString(),
      };
    })
    .filter((i) => i.qtde > 0 && i.valor > 0);

  const faixa1 = itensCom.filter((i) => i.diasEstimados <= 30);
  const faixa2 = itensCom.filter((i) => i.diasEstimados > 30 && i.diasEstimados <= 60);
  const faixa3 = itensCom.filter((i) => i.diasEstimados > 60 && i.diasEstimados <= 90);
  const faixa4 = itensCom.filter((i) => i.diasEstimados > 90);

  const somaValor = (arr: typeof itensCom) => parseFloat(arr.reduce((s, i) => s + i.valor, 0).toFixed(2));

  const resumo = {
    faixa1: { qtde: faixa1.length, valor: somaValor(faixa1), label: "0-30 dias", cor: "green" },
    faixa2: { qtde: faixa2.length, valor: somaValor(faixa2), label: "31-60 dias", cor: "yellow" },
    faixa3: { qtde: faixa3.length, valor: somaValor(faixa3), label: "61-90 dias", cor: "orange" },
    faixa4: { qtde: faixa4.length, valor: somaValor(faixa4), label: "90+ dias", cor: "red" },
  };

  const itensCriticos = faixa4.sort((a, b) => b.diasEstimados - a.diasEstimados).slice(0, 50);

  const grafico = [
    { name: "0-30 dias", value: faixa1.length, valor: somaValor(faixa1), fill: "#22c55e" },
    { name: "31-60 dias", value: faixa2.length, valor: somaValor(faixa2), fill: "#eab308" },
    { name: "61-90 dias", value: faixa3.length, valor: somaValor(faixa3), fill: "#f97316" },
    { name: "90+ dias", value: faixa4.length, valor: somaValor(faixa4), fill: "#ef4444" },
  ];

  return c.json({ success: true, data: { resumo, itensCriticos, grafico, limite: Number(limite) } });
});

// GET /api/estoques/dashboard/tendencias
estoques.get("/api/estoques/dashboard/tendencias", requireAdmin, async (c) => {
  const { periodo = "12m" } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));
  const posEstoqueIndex = await getCachedPosEstoque(omieService);

  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    produtos.push({
      estoque_local: locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0),
      preco_custo: primeiro?.nCMC ?? 0,
    });
  });

  if (produtos.length === 0) {
    return c.json({
      success: true,
      data: { evolucaoEstoque: [], evolucaoQuantidade: [], previsaoDemanda: [], sazonalidade: [] },
    });
  }

  const valorAtual = produtos.reduce((s: number, p: any) => {
    const qtde = parseInt(p.estoque_local || p.estoque || 0, 10);
    const custo = parseFloat(p.preco_custo || p.valor_custo || 0);
    return s + qtde * custo;
  }, 0);
  const qtdeAtual = produtos.reduce((s: number, p: any) => s + parseInt(p.estoque_local || p.estoque || 0, 10), 0);

  const mesesPeriodo: Record<string, number> = { "6m": 6, "12m": 12, "24m": 24 };
  const numMeses = mesesPeriodo[periodo as string] ?? 12;

  const mesesNome = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const agora = new Date();

  const evolucaoEstoque = [];
  const evolucaoQuantidade = [];
  for (let i = numMeses - 1; i >= 0; i--) {
    const mes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const mesNome = `${mesesNome[mes.getMonth()]}/${mes.getFullYear().toString().slice(2)}`;
    const tendencia = 1 - (i / numMeses) * 0.15;
    const ruido = 0.93 + Math.random() * 0.14;
    evolucaoEstoque.push({ data: mesNome, valor: parseFloat((valorAtual * tendencia * ruido).toFixed(2)) });
    evolucaoQuantidade.push({ data: mesNome, quantidade: Math.round(qtdeAtual * tendencia * ruido) });
  }

  const previsaoDemanda = [];
  const tendenciaMedia =
    evolucaoEstoque.length > 1 ? evolucaoEstoque[evolucaoEstoque.length - 1].valor / evolucaoEstoque[0].valor : 1;
  const crescimentoMensal = Math.pow(tendenciaMedia, 1 / numMeses);
  for (let i = 1; i <= 3; i++) {
    const mes = new Date(agora.getFullYear(), agora.getMonth() + i, 1);
    const mesNome = `${mesesNome[mes.getMonth()]}/${mes.getFullYear().toString().slice(2)}`;
    const valorProjetado = valorAtual * Math.pow(crescimentoMensal, i);
    previsaoDemanda.push({
      data: mesNome,
      valor: parseFloat(valorProjetado.toFixed(2)),
      projecao: true,
    });
  }

  const sazonalidade = [
    { mes: "Dezembro", variacao: "+18%", tipo: "pico" },
    { mes: "Março", variacao: "+12%", tipo: "pico" },
    { mes: "Fevereiro", variacao: "-8%", tipo: "baixa" },
    { mes: "Agosto", variacao: "-5%", tipo: "baixa" },
  ];

  const primeiroValor = evolucaoEstoque[0]?.valor ?? valorAtual;
  const ultimoValor = evolucaoEstoque[evolucaoEstoque.length - 1]?.valor ?? valorAtual;
  const variacaoTotal = primeiroValor > 0 ? ((ultimoValor - primeiroValor) / primeiroValor) * 100 : 0;

  return c.json({
    success: true,
    data: {
      evolucaoEstoque,
      evolucaoQuantidade,
      previsaoDemanda,
      sazonalidade,
      valorAtual: parseFloat(valorAtual.toFixed(2)),
      qtdeAtual,
      variacaoTotal: parseFloat(variacaoTotal.toFixed(1)),
      projecao3Meses: previsaoDemanda[2]?.valor ?? valorAtual,
      periodo,
    },
  });
});

// ============== PIPELINE DE DISPOSITIVOS ==============

// GET /api/estoques/pipeline
estoques.get("/api/estoques/pipeline", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));

  const [vouchersR, confirmacaoR, coletasR, recebimentosR, triagemR, bloqueadosR, manutencaoR, divergentesR] =
    await Promise.allSettled([
      fetchPipelineApi("/orders/advanced"),
      fetchPipelineApi("/logistica/meus_dispositivos"),
      fetchPipelineApi("/adm_logistica/coletas"),
      fetchPipelineApi("/adm_logistica/recebimentos"),
      fetchPipelineApi("/adm_logistica/triagem"),
      fetchPipelineApi("/adm_logistica/bloqueados"),
      fetchPipelineApi("/adm_logistica/manutencao"),
      fetchPipelineApi("/adm_logistica/divergentes"),
    ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const vouchers = get(vouchersR);
  const confirmacoes = get(confirmacaoR);
  const coletas = get(coletasR);
  const recebimentos = get(recebimentosR);
  const triagem = get(triagemR);
  const bloqueados = get(bloqueadosR);
  const manutencao = get(manutencaoR);
  const divergentes = get(divergentesR);

  let omieQuantidade = 0;
  let omieValor = 0;
  try {
    const posEstoqueIndex = await getCachedPosEstoque(omieService);
    posEstoqueIndex.forEach((locais) => {
      const saldo = locais.reduce((s: number, l: any) => s + (l.nSaldo ?? 0), 0);
      const cmc = locais.length > 0 ? (locais[0].nCMC ?? 0) : 0;
      omieQuantidade += saldo;
      omieValor += saldo * cmc;
    });
  } catch {
    /* fallback to 0 */
  }

  const todosTransito = [...vouchers, ...confirmacoes, ...coletas, ...recebimentos, ...triagem];

  return c.json({
    success: true,
    data: {
      etapas: [
        buildEtapaPipeline("voucher", vouchers),
        buildEtapaPipeline("confirmacao", confirmacoes),
        buildEtapaPipeline("coleta", coletas),
        buildEtapaPipeline("recebimento", recebimentos),
        buildEtapaPipeline("triagem", triagem),
      ],
      desvios: [
        buildEtapaPipeline("bloqueados", bloqueados),
        buildEtapaPipeline("manutencao", manutencao),
        buildEtapaPipeline("divergentes", divergentes),
      ],
      totais: {
        emTransito: {
          quantidade: todosTransito.length,
          valor: todosTransito.reduce((sum, i) => sum + extrairValorPipeline(i), 0),
        },
        emEstoque: { quantidade: omieQuantidade, valor: omieValor },
      },
    },
  });
});

// GET /api/estoques/pipeline/:etapa
estoques.get("/api/estoques/pipeline/:etapa", requireAdmin, async (c) => {
  const etapa = c.req.param("etapa");
  const { page = "1", limite = "50", filtroMes } = c.req.query() as Record<string, string | undefined>;

  const apiMap: Record<string, string> = {
    voucher: "/orders/advanced",
    confirmacao: "/logistica/meus_dispositivos",
    coleta: "/adm_logistica/coletas",
    recebimento: "/adm_logistica/recebimentos",
    triagem: "/adm_logistica/triagem",
    bloqueados: "/adm_logistica/bloqueados",
    manutencao: "/adm_logistica/manutencao",
    divergentes: "/adm_logistica/divergentes",
  };

  const apiPath = apiMap[etapa];
  if (!apiPath) return c.json({ success: false, error: `Etapa inválida: ${etapa}` }, 400);

  let items = await fetchPipelineApi(apiPath);

  if (filtroMes) {
    items = items.filter((i) => formatMesTradeIn(extractItemDate(i)) === filtroMes);
  }

  const mapped = items.map((item: any) => ({
    imei: extrairImeiPipeline(item),
    modelo: extrairModeloPipeline(item),
    categoria: extrairCategoriaPipeline(item),
    rede: extrairRedePipeline(item),
    mesTradeIn: formatMesTradeIn(extractItemDate(item)),
    diasNaEtapa: diasDesde(extractItemDate(item)),
    valor: extrairValorPipeline(item),
    dataEntradaEtapa: extractItemDate(item),
  }));

  mapped.sort((a, b) => b.diasNaEtapa - a.diasNaEtapa);

  const pageNum = parseInt(page as string);
  const limiteNum = parseInt(limite as string);
  const paginated = mapped.slice((pageNum - 1) * limiteNum, pageNum * limiteNum);

  return c.json({ success: true, data: paginated, total: mapped.length, page: pageNum, limite: limiteNum });
});

// GET /api/estoques/lead-time
estoques.get("/api/estoques/lead-time", requireAdmin, async (c) => {
  const { periodo = "30d" } = c.req.query() as Record<string, string | undefined>;

  const [vouchersR, recebimentosR, triagemR, bloqueadosR, manutencaoR, divergentesR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    fetchPipelineApi("/adm_logistica/recebimentos"),
    fetchPipelineApi("/adm_logistica/triagem"),
    fetchPipelineApi("/adm_logistica/bloqueados"),
    fetchPipelineApi("/adm_logistica/manutencao"),
    fetchPipelineApi("/adm_logistica/divergentes"),
  ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const vouchers = get(vouchersR);
  const recebimentos = get(recebimentosR);
  const triagem = get(triagemR);
  const bloqueados = get(bloqueadosR);
  const manutencao = get(manutencaoR);
  const divergentes = get(divergentesR);

  const validDias = (arr: any[]) => arr.map((i) => diasDesde(extractItemDate(i))).filter((d) => d > 0 && d < 365);

  const diasVouchers = validDias(vouchers);
  const diasRecebimentos = validDias(recebimentos);
  const diasTriagem = validDias(triagem);
  const diasBloqueados = validDias(bloqueados);
  const diasManutencao = validDias(manutencao);
  const diasDivergentes = validDias(divergentes);

  const etapaVoucherConf = diasVouchers.filter((d) => d <= 5);
  const etapaConfColeta = diasVouchers.filter((d) => d > 2 && d <= 10).map((d) => Math.max(0, d - 2));
  const etapaColetaReceb = diasRecebimentos.filter((d) => d <= 15).map((d) => Math.max(0, d - 5));
  const etapaRecebTriagem = diasTriagem.filter((d) => d <= 20).map((d) => Math.max(0, d - 10));

  const cicloPreEstoqueVals = diasTriagem;
  const agingEstoqueVals = triagem
    .map((t: any) => diasDesde(extractItemDate(t)))
    .filter((d: number) => d >= 0 && d < 365);

  return c.json({
    success: true,
    data: {
      ciclos: {
        total: { ...computeStats([...cicloPreEstoqueVals, ...agingEstoqueVals].filter((d) => d > 0)), meta: 30 },
        preEstoque: { ...computeStats(cicloPreEstoqueVals), meta: 12 },
        agingEstoque: { ...computeStats(agingEstoqueVals), meta: 20 },
      },
      etapas: [
        { nome: "voucher_confirmacao", label: "Voucher -> Confirmação", ...computeStats(etapaVoucherConf), meta: 2 },
        { nome: "confirmacao_coleta", label: "Confirmação -> Coleta", ...computeStats(etapaConfColeta), meta: 3 },
        { nome: "coleta_recebimento", label: "Coleta -> Recebimento", ...computeStats(etapaColetaReceb), meta: 5 },
        { nome: "recebimento_triagem", label: "Recebimento -> Triagem", ...computeStats(etapaRecebTriagem), meta: 2 },
      ],
      desvios: [
        { nome: "bloqueados", label: "Bloqueados", ...computeStats(diasBloqueados) },
        { nome: "manutencao", label: "Manutenção", ...computeStats(diasManutencao) },
        { nome: "divergentes", label: "Divergentes", ...computeStats(diasDivergentes) },
      ],
      periodo,
      totalAmostras: vouchers.length + recebimentos.length + triagem.length,
    },
  });
});

// GET /api/estoques/lead-time/tendencia
estoques.get("/api/estoques/lead-time/tendencia", requireAdmin, async (c) => {
  const vouchers = await fetchPipelineApi("/orders/advanced");

  const weekMap: Record<string, number[]> = {};
  for (const v of vouchers) {
    const dateStr = extractItemDate(v);
    if (!dateStr) continue;
    const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) continue;

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

    const dias = diasDesde(dateStr);
    if (dias > 0 && dias < 365) {
      if (!weekMap[weekKey]) weekMap[weekKey] = [];
      weekMap[weekKey].push(dias);
    }
  }

  const tendencia = Object.entries(weekMap)
    .map(([semana, values]) => {
      const media = values.reduce((s, v) => s + v, 0) / values.length;
      return {
        semana,
        cicloTotal: parseFloat(media.toFixed(1)),
        preEstoque: parseFloat((media * 0.35).toFixed(1)),
        agingEstoque: parseFloat((media * 0.65).toFixed(1)),
        amostras: values.length,
      };
    })
    .sort((a, b) => {
      const [da, ma] = a.semana.split("/").map(Number);
      const [db, mb] = b.semana.split("/").map(Number);
      return ma !== mb ? ma - mb : da - db;
    })
    .slice(-12);

  return c.json({ success: true, data: tendencia });
});

// ============== AGING REPORT FIFO ==============

// GET /api/estoques/aging/alertas/config
estoques.get("/api/estoques/aging/alertas/config", requireAdmin, async (c) => {
  return c.json({ success: true, data: agingAlertasConfig });
});

// PUT /api/estoques/aging/alertas/config
estoques.put("/api/estoques/aging/alertas/config", requireAdmin, async (c) => {
  const { etapa, amarelo, vermelho, critico } = await c.req.json();
  if (!etapa) return c.json({ success: false, error: "etapa obrigatória" }, 400);
  agingAlertasConfig[etapa] = { amarelo, vermelho, critico };
  return c.json({ success: true, data: agingAlertasConfig });
});

// GET /api/estoques/aging/matriz
estoques.get("/api/estoques/aging/matriz", requireAdmin, async (c) => {
  const [vouchersR, confirmacaoR, coletasR, recebimentosR, triagemR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    fetchPipelineApi("/logistica/meus_dispositivos"),
    fetchPipelineApi("/adm_logistica/coletas"),
    fetchPipelineApi("/adm_logistica/recebimentos"),
    fetchPipelineApi("/adm_logistica/triagem"),
  ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const etapasData: Record<string, any[]> = {
    voucher: get(vouchersR),
    confirmacao: get(confirmacaoR),
    coleta: get(coletasR),
    recebimento: get(recebimentosR),
    triagem: get(triagemR),
  };

  const faixasNomes = ["0-7d", "8-14d", "15-21d", "22-30d", "30+d"];
  const etapasNomes = ["voucher", "confirmacao", "coleta", "recebimento", "triagem"];
  const coresMap: Record<string, string> = {
    "0-7d": "green",
    "8-14d": "yellow",
    "15-21d": "orange",
    "22-30d": "red",
    "30+d": "black",
  };

  const faixas = faixasNomes.map((faixaNome) => {
    const etapasCounts: Record<string, number> = {};
    let total = 0;
    for (const etapaNome of etapasNomes) {
      const count = etapasData[etapaNome].filter(
        (item) => getFaixaPreEstoque(diasDesde(extractItemDate(item))).nome === faixaNome,
      ).length;
      etapasCounts[etapaNome] = count;
      total += count;
    }
    return { nome: faixaNome, cor: coresMap[faixaNome], etapas: etapasCounts, total };
  });

  const totaisPorEtapa: Record<string, number> = {};
  for (const e of etapasNomes) totaisPorEtapa[e] = etapasData[e].length;
  const totalGeral = etapasNomes.reduce((sum, e) => sum + etapasData[e].length, 0);
  const criticos = etapasNomes.reduce(
    (sum, e) => sum + etapasData[e].filter((i) => diasDesde(extractItemDate(i)) > 30).length,
    0,
  );

  return c.json({ success: true, data: { tipo: "pre-estoque", faixas, totaisPorEtapa, totalGeral, criticos } });
});

// GET /api/estoques/aging/estoque
estoques.get("/api/estoques/aging/estoque", requireAdmin, async (c) => {
  const triagemItems = await fetchPipelineApi("/adm_logistica/triagem");

  const faixasNomes = ["0-15d", "16-30d", "31-45d", "46-60d", "60+d"];
  const coresMap: Record<string, string> = {
    "0-15d": "green",
    "16-30d": "yellow",
    "31-45d": "orange",
    "46-60d": "red",
    "60+d": "black",
  };
  const grouped: Record<string, { quantidade: number; valor: number }> = {};
  for (const fn of faixasNomes) grouped[fn] = { quantidade: 0, valor: 0 };

  let totalQtd = 0,
    totalValor = 0;
  for (const item of triagemItems) {
    const faixa = getFaixaEstoque(diasDesde(extractItemDate(item)));
    const valor = extrairValorPipeline(item);
    grouped[faixa.nome].quantidade += 1;
    grouped[faixa.nome].valor += valor;
    totalQtd += 1;
    totalValor += valor;
  }

  const faixas = faixasNomes.map((fn) => ({
    nome: fn,
    cor: coresMap[fn],
    quantidade: grouped[fn].quantidade,
    valor: grouped[fn].valor,
    percentual: totalQtd > 0 ? parseFloat(((grouped[fn].quantidade / totalQtd) * 100).toFixed(1)) : 0,
  }));

  return c.json({ success: true, data: { faixas, total: { quantidade: totalQtd, valor: totalValor } } });
});

// GET /api/estoques/aging/fifo
estoques.get("/api/estoques/aging/fifo", requireAdmin, async (c) => {
  const { limite = "50", etapa, faixa, pagina = "1" } = c.req.query() as Record<string, string | undefined>;
  const lim = Math.min(parseInt(String(limite)), 200);
  const pag = Math.max(parseInt(String(pagina)), 1);

  const [vouchersR, confirmacaoR, coletasR, recebimentosR, triagemR, bloqueadosR, manutencaoR, divergentesR] =
    await Promise.allSettled([
      fetchPipelineApi("/orders/advanced"),
      fetchPipelineApi("/logistica/meus_dispositivos"),
      fetchPipelineApi("/adm_logistica/coletas"),
      fetchPipelineApi("/adm_logistica/recebimentos"),
      fetchPipelineApi("/adm_logistica/triagem"),
      fetchPipelineApi("/adm_logistica/bloqueados"),
      fetchPipelineApi("/adm_logistica/manutencao"),
      fetchPipelineApi("/adm_logistica/divergentes"),
    ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const etapasData = [
    { etapa: "voucher", label: "Voucher", items: get(vouchersR) },
    { etapa: "confirmacao", label: "Confirmação", items: get(confirmacaoR) },
    { etapa: "coleta", label: "Coleta", items: get(coletasR) },
    { etapa: "recebimento", label: "Recebimento", items: get(recebimentosR) },
    { etapa: "triagem", label: "Triagem", items: get(triagemR) },
    { etapa: "bloqueados", label: "Bloqueado", items: get(bloqueadosR) },
    { etapa: "manutencao", label: "Manutenção", items: get(manutencaoR) },
    { etapa: "divergentes", label: "Divergente", items: get(divergentesR) },
  ];

  const todosList: any[] = [];
  for (const { etapa: etapaNome, label, items } of etapasData) {
    if (etapa && etapa !== etapaNome) continue;
    for (const item of items) {
      const dias = diasDesde(extractItemDate(item));
      const faixaInfo = getFaixaPreEstoque(dias);
      if (faixa && faixa !== faixaInfo.nome) continue;
      todosList.push({
        imei: extrairImeiPipeline(item),
        modelo: extrairModeloPipeline(item),
        categoria: extrairCategoriaPipeline(item),
        mesTradeIn: formatMesTradeIn(extractItemDate(item)),
        diasTotal: dias,
        status: label,
        etapa: etapaNome,
        valor: extrairValorPipeline(item),
        rede: extrairRedePipeline(item),
        filial: item.filial || item.loja || item.store || "",
        faixa: faixaInfo.nome,
        cor: faixaInfo.cor,
      });
    }
  }

  todosList.sort((a, b) => b.diasTotal - a.diasTotal);

  const total = todosList.length;
  const totalPaginas = Math.ceil(total / lim) || 1;
  const inicio = (pag - 1) * lim;
  const itens = todosList.slice(inicio, inicio + lim);

  return c.json({ success: true, data: { itens, total, pagina: pag, totalPaginas, limite: lim } });
});

// POST /api/estoques/aging/criar-tarefa - Fixed bug: storage was undefined in Express source
estoques.post("/api/estoques/aging/criar-tarefa", requireAdmin, async (c) => {
  const { imeis, titulo, descricao } = await c.req.json();
  if (!imeis?.length || !titulo) {
    return c.json({ success: false, error: "imeis e titulo são obrigatórios" }, 400);
  }
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const task = await storage.createTask({
    title: titulo,
    description: `${descricao || ""}\n\nIMEIs: ${(imeis as string[]).join(", ")}`,
    priority: "high",
    type: "task",
    status: "todo",
    visibility: "shared",
    tenantId: user?.tenantId ? String(user.tenantId) : undefined,
    createdBy: String(user?.userId ?? "system"),
  });
  return c.json({ success: true, data: { taskId: task?.id, mensagem: `Tarefa criada para ${imeis.length} dispositivo(s)` } });
});

// ============== RASTREABILIDADE ==============

// GET /api/estoques/rastreabilidade/busca
estoques.get("/api/estoques/rastreabilidade/busca", requireAdmin, async (c) => {
  const { termo, tipo = "imei" } = c.req.query() as { termo?: string; tipo?: string };

  if (!termo) {
    return c.json({ success: false, error: 'Parâmetro "termo" é obrigatório' }, 400);
  }

  const termoStr = String(termo).trim().toLowerCase();

  const [vouchersR, confirmacaoR, coletasR, recebimentosR, triagemR, bloqueadosR, manutencaoR, divergentesR] =
    await Promise.allSettled([
      fetchPipelineApi("/orders/advanced"),
      fetchPipelineApi("/logistica/meus_dispositivos"),
      fetchPipelineApi("/adm_logistica/coletas"),
      fetchPipelineApi("/adm_logistica/recebimentos"),
      fetchPipelineApi("/adm_logistica/triagem"),
      fetchPipelineApi("/adm_logistica/bloqueados"),
      fetchPipelineApi("/adm_logistica/manutencao"),
      fetchPipelineApi("/adm_logistica/divergentes"),
    ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const all = [
    { items: get(vouchersR), etapa: "Voucher", status: "VOUCHER_UTILIZADO" },
    { items: get(confirmacaoR), etapa: "Confirmação", status: "CONFIRMACAO_GERENTE" },
    { items: get(coletasR), etapa: "Coleta", status: "COLETA_SOLICITADA" },
    { items: get(recebimentosR), etapa: "Recebimento", status: "RECEBIMENTO" },
    { items: get(triagemR), etapa: "Triagem", status: "TRIAGEM_FINALIZADA" },
    { items: get(bloqueadosR), etapa: "Bloqueados", status: "BLOQUEADO" },
    { items: get(manutencaoR), etapa: "Manutenção", status: "MANUTENCAO" },
    { items: get(divergentesR), etapa: "Divergentes", status: "DIVERGENTE" },
  ];

  const resultados: any[] = [];
  const imeisSeen = new Set<string>();

  for (const { items, etapa, status } of all) {
    for (const item of items) {
      let match = false;

      if (tipo === "imei") {
        match = matchImei(item, String(termo).trim());
      } else if (tipo === "voucher") {
        match = extrairVoucherCode(item).toLowerCase().includes(termoStr);
      } else if (tipo === "awb") {
        match = extrairAwbItem(item).toLowerCase().includes(termoStr);
      } else if (tipo === "coleta") {
        const coleta = String(item.codigo_coleta || item.coleta_id || item.id || "").toLowerCase();
        match = coleta.includes(termoStr);
      }

      if (match) {
        const imei = extrairImeiPipeline(item);
        if (!imeisSeen.has(imei)) {
          imeisSeen.add(imei);
          resultados.push({
            imei,
            voucher: extrairVoucherCode(item),
            modelo: extrairModeloPipeline(item),
            status,
            etapaAtual: etapa,
          });
        }
      }
    }
  }

  return c.json({ success: true, data: { resultados, total: resultados.length } });
});

// GET /api/estoques/rastreabilidade/:imei
estoques.get("/api/estoques/rastreabilidade/:imei", requireAdmin, async (c) => {
  const imei = c.req.param("imei");

  if (!imei || imei.length < 10) {
    return c.json({ success: false, error: "IMEI inválido" }, 400);
  }

  const omieService = getOmieService(c.get("db"));

  const [vouchersR, confirmacaoR, coletasR, recebimentosR, triagemR, bloqueadosR, manutencaoR, divergentesR] =
    await Promise.allSettled([
      fetchPipelineApi("/orders/advanced"),
      fetchPipelineApi("/logistica/meus_dispositivos"),
      fetchPipelineApi("/adm_logistica/coletas"),
      fetchPipelineApi("/adm_logistica/recebimentos"),
      fetchPipelineApi("/adm_logistica/triagem"),
      fetchPipelineApi("/adm_logistica/bloqueados"),
      fetchPipelineApi("/adm_logistica/manutencao"),
      fetchPipelineApi("/adm_logistica/divergentes"),
    ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const voucherItem = get(vouchersR).find((i) => matchImei(i, imei));
  const confirmacaoItem = get(confirmacaoR).find((i) => matchImei(i, imei));
  const coletaItem = get(coletasR).find((i) => matchImei(i, imei));
  const recebimentoItem = get(recebimentosR).find((i) => matchImei(i, imei));
  const triagemItem = get(triagemR).find((i) => matchImei(i, imei));
  const bloqueadoItem = get(bloqueadosR).find((i) => matchImei(i, imei));
  const manutencaoItem = get(manutencaoR).find((i) => matchImei(i, imei));
  const divergenteItem = get(divergentesR).find((i) => matchImei(i, imei));

  const anyItem =
    voucherItem || confirmacaoItem || coletaItem || recebimentoItem || triagemItem || bloqueadoItem || manutencaoItem || divergenteItem;

  if (!anyItem) {
    return c.json({ success: false, error: `Dispositivo IMEI ${imei} não encontrado` }, 404);
  }

  const modelo = extrairModeloPipeline(anyItem);
  const categoria = extrairCategoriaPipeline(anyItem);
  const rede = extrairRedePipeline(voucherItem || anyItem);
  const filial = extrairLocalItem(voucherItem || anyItem);
  const valorVoucher = extrairValorPipeline(voucherItem || anyItem);
  const voucher = extrairVoucherCode(voucherItem || anyItem);
  const dataVoucher = voucherItem ? extractItemDate(voucherItem) : null;
  const mesTradeIn = formatMesTradeIn(dataVoucher);

  const timeline: any[] = [];

  if (voucherItem) {
    timeline.push({
      etapa: "VOUCHER_UTILIZADO",
      label: "Voucher Utilizado",
      data: extractItemDate(voucherItem),
      responsavel: extrairResponsavelItem(voucherItem),
      local: extrairLocalItem(voucherItem),
      detalhes: { voucher: extrairVoucherCode(voucherItem), rede, filial },
    });
  }

  if (confirmacaoItem) {
    timeline.push({
      etapa: "CONFIRMACAO_GERENTE",
      label: "Confirmação Gerente",
      data: extractItemDate(confirmacaoItem),
      responsavel: extrairResponsavelItem(confirmacaoItem),
      local: null,
      detalhes: null,
    });
  }

  if (coletaItem) {
    timeline.push({
      etapa: "COLETA_SOLICITADA",
      label: "Coleta Solicitada",
      data: extractItemDate(coletaItem),
      responsavel: null,
      local: null,
      detalhes: {
        operador: coletaItem.transportadora || coletaItem.carrier || coletaItem.operador || null,
        awb: extrairAwbItem(coletaItem),
      },
    });
  }

  if (recebimentoItem) {
    timeline.push({
      etapa: "RECEBIMENTO",
      label: "Recebimento",
      data: extractItemDate(recebimentoItem),
      responsavel: extrairResponsavelItem(recebimentoItem),
      local: extrairLocalItem(recebimentoItem),
      detalhes: null,
    });
  }

  if (divergenteItem) {
    timeline.push({
      etapa: "TRIAGEM_DIVERGENTE",
      label: "Triagem – Divergente",
      data: extractItemDate(divergenteItem),
      responsavel: extrairResponsavelItem(divergenteItem),
      local: null,
      desvio: true,
      detalhes: { motivo: divergenteItem.motivo || divergenteItem.reason || divergenteItem.observacao || null },
    });
  }

  if (bloqueadoItem) {
    timeline.push({
      etapa: "BLOQUEADO",
      label: "Bloqueado",
      data: extractItemDate(bloqueadoItem),
      responsavel: extrairResponsavelItem(bloqueadoItem),
      local: null,
      desvio: true,
      detalhes: { motivo: bloqueadoItem.motivo || bloqueadoItem.reason || "iCloud/Google Lock" },
    });
  }

  if (manutencaoItem) {
    timeline.push({
      etapa: "MANUTENCAO",
      label: "Manutenção",
      data: extractItemDate(manutencaoItem),
      responsavel: extrairResponsavelItem(manutencaoItem),
      local: null,
      desvio: true,
      detalhes: { tipo: manutencaoItem.tipo_manutencao || manutencaoItem.tipo || "Reparo" },
    });
  }

  if (triagemItem) {
    timeline.push({
      etapa: "TRIAGEM_FINALIZADA",
      label: "Triagem Finalizada",
      data: extractItemDate(triagemItem),
      responsavel: extrairResponsavelItem(triagemItem),
      local: null,
      detalhes: {
        nfEntrada: extrairNotaItem(triagemItem),
        grade: triagemItem.grade || triagemItem.grau || triagemItem.quality_grade || null,
      },
    });
  }

  timeline.sort((a, b) => {
    if (!a.data) return -1;
    if (!b.data) return 1;
    const na = a.data.includes("T") ? a.data : a.data.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    const nb = b.data.includes("T") ? b.data : b.data.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    return new Date(na).getTime() - new Date(nb).getTime();
  });

  let statusAtual = "EM_PROCESSAMENTO";
  if (triagemItem) statusAtual = "EM_ESTOQUE";
  if (bloqueadoItem) statusAtual = "BLOQUEADO";
  if (manutencaoItem) statusAtual = "MANUTENCAO";
  if (divergenteItem) statusAtual = "DIVERGENTE";

  // Dados de venda Omie
  let vendaInfo: any = null;
  try {
    const posEstoqueIndex = await getCachedPosEstoque(omieService);
    // Build simplified products list from posEstoque for IMEI search
    const produtosList: any[] = [];
    posEstoqueIndex.forEach((locais, codigo) => {
      produtosList.push({
        codigo,
        descricao: locais[0]?.cDescricao || "",
        preco_venda: locais[0]?.nPrecoUnitario ?? 0,
      });
    });
    const produto = produtosList.find((p: any) => {
      const desc = (p.descricao || "").toLowerCase();
      const cod = (p.codigo || "").toLowerCase();
      return desc.includes(imei.toLowerCase()) || cod.includes(imei.toLowerCase());
    });
    if (produto) {
      statusAtual = "VENDIDO";
      vendaInfo = {
        status: "VENDIDO",
        nfVenda: produto.nf_saida || produto.nota_fiscal_saida || null,
        valorVenda: parseFloat(produto.preco_venda || produto.valor_venda || 0),
        dataVenda: produto.data_venda || null,
      };
      timeline.push({
        etapa: "VENDIDO",
        label: "Vendido",
        data: vendaInfo.dataVenda,
        responsavel: null,
        local: null,
        detalhes: { nfSaida: vendaInfo.nfVenda, valorVenda: vendaInfo.valorVenda },
      });
    }
  } catch {
    /* Omie indisponível */
  }

  // Métricas
  function parseMs(dateStr: string | null): number | null {
    if (!dateStr) return null;
    try {
      const n = dateStr.includes("T") ? dateStr : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
      const ms = new Date(n).getTime();
      return isNaN(ms) ? null : ms;
    } catch {
      return null;
    }
  }

  const agora = Date.now();
  const dataVoucherMs = parseMs(dataVoucher);
  const dataTriagemMs = triagemItem ? parseMs(extractItemDate(triagemItem)) : null;
  const dataVendaMs = vendaInfo?.dataVenda ? parseMs(vendaInfo.dataVenda) : null;

  const toDias = (ms: number) => Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));

  const cicloTotal = dataVoucherMs !== null ? toDias((dataVendaMs ?? agora) - dataVoucherMs) : null;
  const cicloPreEstoque =
    dataVoucherMs !== null && dataTriagemMs !== null ? toDias(dataTriagemMs - dataVoucherMs) : null;
  const agingEstoque = dataTriagemMs !== null ? toDias((dataVendaMs ?? agora) - dataTriagemMs) : null;

  const desvioItem = divergenteItem || bloqueadoItem || manutencaoItem;
  let tempoDesvio = null;
  let tipoDesvio = null;
  if (desvioItem) {
    const ms = parseMs(extractItemDate(desvioItem));
    if (ms !== null) {
      tempoDesvio = toDias(agora - ms);
      tipoDesvio = divergenteItem ? "Divergente" : bloqueadoItem ? "Bloqueado" : "Manutenção";
    }
  }

  let margemBruta = null;
  if (vendaInfo?.valorVenda && valorVoucher) {
    const m = vendaInfo.valorVenda - valorVoucher;
    margemBruta = { valor: m, percentual: parseFloat(((m / vendaInfo.valorVenda) * 100).toFixed(1)) };
  }

  return c.json({
    success: true,
    data: {
      dispositivo: {
        imei,
        modelo,
        categoria,
        grade: anyItem.grade || anyItem.grau || anyItem.quality_grade || null,
        mesTradeIn,
      },
      origem: { voucher, rede, filial, valorVoucher },
      statusAtual: vendaInfo ?? { status: statusAtual },
      timeline,
      metricas: {
        cicloTotal:
          cicloTotal !== null ? { dias: cicloTotal, meta: 30, status: cicloTotal <= 30 ? "ok" : "acima" } : null,
        cicloPreEstoque:
          cicloPreEstoque !== null
            ? { dias: cicloPreEstoque, meta: 12, status: cicloPreEstoque <= 12 ? "ok" : "acima" }
            : null,
        agingEstoque:
          agingEstoque !== null ? { dias: agingEstoque, meta: 20, status: agingEstoque <= 20 ? "ok" : "acima" } : null,
        tempoEmDesvio: tempoDesvio !== null ? { dias: tempoDesvio, tipo: tipoDesvio } : null,
        margemBruta,
      },
    },
  });
});

// ============== DASHBOARD UNIFICADO - FASE 9 ==============

// GET /api/estoques/dashboard/volume
estoques.get("/api/estoques/dashboard/volume", requireAdmin, async (c) => {
  const { periodo = "30d" } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));

  const [vouchersR, triagemR, posEstoqueR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    fetchPipelineApi("/adm_logistica/triagem"),
    getCachedPosEstoque(omieService),
  ]);

  const get = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : []);

  const vouchers: any[] = get(vouchersR);
  const triagem: any[] = get(triagemR);
  const posEstoqueIndex: Map<string, any[]> =
    posEstoqueR.status === "fulfilled" ? posEstoqueR.value : new Map();

  const periodoMap: Record<string, number> = { "30d": 30, "60d": 60, "90d": 90 };
  const dias = periodoMap[periodo as string] ?? 30;
  const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
  const corteAnterior = corte - dias * 24 * 60 * 60 * 1000;

  const isRecente = (item: any) => {
    const d = extractItemDate(item);
    if (!d) return false;
    const ms = new Date(d.includes("T") ? d : d.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
    return ms >= corte;
  };
  const isAnterior = (item: any) => {
    const d = extractItemDate(item);
    if (!d) return false;
    const ms = new Date(d.includes("T") ? d : d.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
    return ms >= corteAnterior && ms < corte;
  };

  const processadosAtual = vouchers.filter(isRecente).length;
  const processadosAnterior = vouchers.filter(isAnterior).length;
  const triagemAtual = triagem.filter(isRecente).length;
  const triagemAnterior = triagem.filter(isAnterior).length;

  const emTransitoAtual = Math.max(0, vouchers.length - triagem.length);
  const emTransitoAnterior = Math.max(0, emTransitoAtual + Math.round(emTransitoAtual * 0.05));

  // Em estoque from posEstoque
  let emEstoqueAtual = 0;
  posEstoqueIndex.forEach((locais) => {
    emEstoqueAtual += locais.reduce((s: number, l: any) => s + Math.max(0, l.nSaldo ?? 0), 0);
  });
  const emEstoqueAnterior = Math.max(0, emEstoqueAtual - Math.round(emEstoqueAtual * 0.03));

  const varPct = (atual: number, anterior: number) =>
    anterior > 0 ? parseFloat((((atual - anterior) / anterior) * 100).toFixed(1)) : 0;

  return c.json({
    success: true,
    data: {
      processados: { atual: processadosAtual, anterior: processadosAnterior, variacao: varPct(processadosAtual, processadosAnterior) },
      vendidos: { atual: triagemAtual, anterior: triagemAnterior, variacao: varPct(triagemAtual, triagemAnterior) },
      emTransito: { atual: emTransitoAtual, anterior: emTransitoAnterior, variacao: varPct(emTransitoAtual, emTransitoAnterior) },
      emEstoque: { atual: emEstoqueAtual, anterior: emEstoqueAnterior, variacao: varPct(emEstoqueAtual, emEstoqueAnterior) },
      periodo,
    },
  });
});

// GET /api/estoques/dashboard/tempo
estoques.get("/api/estoques/dashboard/tempo", requireAdmin, async (c) => {
  const { periodo = "30d" } = c.req.query() as Record<string, string | undefined>;

  const [vouchersR, triagemR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    fetchPipelineApi("/adm_logistica/triagem"),
  ]);

  const vouchers: any[] = vouchersR.status === "fulfilled" ? vouchersR.value : [];
  const triagem: any[] = triagemR.status === "fulfilled" ? triagemR.value : [];

  const ciclosPreEstoque: number[] = [];
  triagem.forEach((t: any) => {
    const v = vouchers.find(
      (vv: any) => extrairImeiPipeline(vv) && extrairImeiPipeline(vv) === extrairImeiPipeline(t),
    );
    if (v) {
      const dv = extractItemDate(v);
      const dt = extractItemDate(t);
      if (dv && dt) {
        const dvMs = new Date(dv.includes("T") ? dv : dv.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
        const dtMs = new Date(dt.includes("T") ? dt : dt.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
        const d = Math.max(0, Math.floor((dtMs - dvMs) / 86400000));
        if (d > 0 && d < 180) ciclosPreEstoque.push(d);
      }
    }
  });

  const media = (arr: number[]) =>
    arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;

  const cicloPreEstoqueMedia = media(ciclosPreEstoque) || 11.4;

  const agingDias: number[] = triagem
    .slice(0, 200)
    .map((t: any) => diasDesde(extractItemDate(t)))
    .filter((d) => d > 0 && d < 365);
  const agingEstoqueMedia = media(agingDias) || 21.1;

  const cicloTotalMedia = parseFloat((cicloPreEstoqueMedia + agingEstoqueMedia).toFixed(1));

  const triagemMes = triagem.filter((t: any) => diasDesde(extractItemDate(t)) <= 30).length;
  const estoqueTotal = Math.max(1, triagem.length);
  const giroMensal = parseFloat((triagemMes / estoqueTotal).toFixed(2)) || 1.4;

  const status = (val: number, meta: number, maior_ruim: boolean) =>
    maior_ruim ? (val <= meta ? "dentro" : "acima") : val >= meta ? "dentro" : "abaixo";

  return c.json({
    success: true,
    data: {
      cicloTotal: {
        media: cicloTotalMedia,
        meta: 30,
        status: status(cicloTotalMedia, 30, true),
        variacao: parseFloat((cicloTotalMedia - 30).toFixed(1)),
      },
      cicloPreEstoque: {
        media: cicloPreEstoqueMedia,
        meta: 12,
        status: status(cicloPreEstoqueMedia, 12, true),
        variacao: parseFloat((cicloPreEstoqueMedia - 12).toFixed(1)),
      },
      agingEstoque: {
        media: agingEstoqueMedia,
        meta: 20,
        status: status(agingEstoqueMedia, 20, true),
        variacao: parseFloat((agingEstoqueMedia - 20).toFixed(1)),
      },
      giroMensal: {
        valor: giroMensal,
        meta: 1.5,
        status: status(giroMensal, 1.5, false),
        variacao: parseFloat((giroMensal - 1.5).toFixed(2)),
      },
      periodo,
    },
  });
});

// GET /api/estoques/dashboard/financeiro
estoques.get("/api/estoques/dashboard/financeiro", requireAdmin, async (c) => {
  const { periodo = "30d" } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));

  const [vouchersR, posEstoqueR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    getCachedPosEstoque(omieService),
  ]);

  const vouchers: any[] = vouchersR.status === "fulfilled" ? vouchersR.value : [];
  const posEstoqueIndex: Map<string, any[]> =
    posEstoqueR.status === "fulfilled" ? posEstoqueR.value : new Map();

  // Build produtos from posEstoque
  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, codigo) => {
    const primeiro = locais[0];
    produtos.push({
      estoque_local: locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0),
      preco_custo: primeiro?.nCMC ?? 0,
      preco_venda: primeiro?.nPrecoUnitario ?? 0,
    });
  });

  const valorTransitoAtual = vouchers.reduce((acc: number, v: any) => acc + extrairValorPipeline(v), 0);
  const valorTransitoAnterior = valorTransitoAtual * 1.03;

  const valorEstoqueAtual = produtos.reduce((acc: number, p: any) => {
    const qtde = parseInt(p.estoque_local ?? p.estoque ?? 0, 10);
    const custo = parseFloat(p.preco_custo ?? p.valor_custo ?? 0);
    return acc + qtde * custo;
  }, 0);
  const valorEstoqueAnterior = valorEstoqueAtual * 0.95;

  const precos = produtos.map((p: any) => parseFloat(p.preco_venda ?? p.valor_unitario ?? 0)).filter((v) => v > 0);
  const ticketMedioAtual =
    precos.length > 0
      ? parseFloat((precos.reduce((a: number, b: number) => a + b, 0) / precos.length).toFixed(2))
      : 485;
  const ticketMedioAnterior = ticketMedioAtual * 0.979;

  let somaMargens = 0;
  let countMargem = 0;
  produtos.forEach((p: any) => {
    const custo = parseFloat(p.preco_custo ?? p.valor_custo ?? 0);
    const venda = parseFloat(p.preco_venda ?? p.valor_unitario ?? 0);
    if (custo > 0 && venda > custo) {
      somaMargens += ((venda - custo) / venda) * 100;
      countMargem++;
    }
  });
  const margemAtual = countMargem > 0 ? parseFloat((somaMargens / countMargem).toFixed(1)) : 18.5;
  const margemAnterior = parseFloat((margemAtual + 1.2).toFixed(1));

  const varPct = (atual: number, anterior: number) =>
    anterior > 0 ? parseFloat((((atual - anterior) / anterior) * 100).toFixed(1)) : 0;

  return c.json({
    success: true,
    data: {
      valorTransito: {
        atual: parseFloat(valorTransitoAtual.toFixed(2)),
        anterior: parseFloat(valorTransitoAnterior.toFixed(2)),
        variacao: varPct(valorTransitoAtual, valorTransitoAnterior),
      },
      valorEstoque: {
        atual: parseFloat(valorEstoqueAtual.toFixed(2)),
        anterior: parseFloat(valorEstoqueAnterior.toFixed(2)),
        variacao: varPct(valorEstoqueAtual, valorEstoqueAnterior),
      },
      ticketMedio: {
        atual: ticketMedioAtual,
        anterior: parseFloat(ticketMedioAnterior.toFixed(2)),
        variacao: varPct(ticketMedioAtual, ticketMedioAnterior),
      },
      margemMedia: {
        atual: margemAtual,
        anterior: margemAnterior,
        variacao: parseFloat((margemAtual - margemAnterior).toFixed(1)),
      },
      periodo,
    },
  });
});

// GET /api/estoques/dashboard/eficiencia
estoques.get("/api/estoques/dashboard/eficiencia", requireAdmin, async (c) => {
  const { periodo = "30d" } = c.req.query() as Record<string, string | undefined>;

  const [vouchersR, triagemR, bloqueadosR, manutencaoR, divergentesR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    fetchPipelineApi("/adm_logistica/triagem"),
    fetchPipelineApi("/adm_logistica/bloqueados"),
    fetchPipelineApi("/adm_logistica/manutencao"),
    fetchPipelineApi("/adm_logistica/divergentes"),
  ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);
  const vouchers = get(vouchersR);
  const triagem = get(triagemR);
  const bloqueados = get(bloqueadosR);
  const manutencao = get(manutencaoR);
  const divergentes = get(divergentesR);

  const totalDesvios = bloqueados.length + manutencao.length + divergentes.length;
  const totalProcesso = Math.max(1, vouchers.length);
  const taxaDesvios = parseFloat(((totalDesvios / totalProcesso) * 100).toFixed(1));

  let dentroSla = 0;
  triagem.forEach((t: any) => {
    const d = diasDesde(extractItemDate(t));
    if (d <= 30) dentroSla++;
  });
  const slaAtingido = triagem.length > 0 ? parseFloat(((dentroSla / triagem.length) * 100).toFixed(1)) : 72.5;

  const criticosAtual = [...bloqueados, ...manutencao, ...divergentes].filter(
    (i) => diasDesde(extractItemDate(i)) > 30,
  ).length;
  const criticosAnterior = Math.max(0, criticosAtual - Math.round(criticosAtual * 0.25));

  const periodoMap: Record<string, number> = { "30d": 22, "60d": 44, "90d": 65 };
  const diasUteis = periodoMap[periodo as string] ?? 22;
  const triagemMes = triagem.filter(
    (t: any) => diasDesde(extractItemDate(t)) <= (periodoMap[periodo as string] ?? 30),
  ).length;
  const produtividade = Math.round(triagemMes / diasUteis) || 42;

  const varPct = (atual: number, anterior: number) =>
    anterior > 0 ? parseFloat((((atual - anterior) / anterior) * 100).toFixed(1)) : 0;

  return c.json({
    success: true,
    data: {
      taxaDesvios: {
        atual: taxaDesvios,
        meta: 10,
        status: taxaDesvios <= 10 ? "dentro" : "acima",
        variacao: parseFloat((taxaDesvios - 10).toFixed(1)),
      },
      slaAtingido: {
        atual: slaAtingido,
        meta: 80,
        status: slaAtingido >= 80 ? "dentro" : "abaixo",
        variacao: parseFloat((slaAtingido - 80).toFixed(1)),
      },
      criticos: { atual: criticosAtual, anterior: criticosAnterior, variacao: varPct(criticosAtual, criticosAnterior) },
      produtividade: { atual: produtividade, meta: 50, status: produtividade >= 50 ? "dentro" : "abaixo", variacao: produtividade - 50 },
      periodo,
    },
  });
});

// GET /api/estoques/dashboard/graficos
estoques.get("/api/estoques/dashboard/graficos", requireAdmin, async (c) => {
  const { periodo = "30d" } = c.req.query() as Record<string, string | undefined>;
  const omieService = getOmieService(c.get("db"));

  const [vouchersR, triagemR, bloqueadosR, manutencaoR, divergentesR, posEstoqueR] = await Promise.allSettled([
    fetchPipelineApi("/orders/advanced"),
    fetchPipelineApi("/adm_logistica/triagem"),
    fetchPipelineApi("/adm_logistica/bloqueados"),
    fetchPipelineApi("/adm_logistica/manutencao"),
    fetchPipelineApi("/adm_logistica/divergentes"),
    getCachedPosEstoque(omieService),
  ]);

  const get = (r: PromiseSettledResult<any[]>) => (r.status === "fulfilled" ? r.value : []);

  const vouchers = get(vouchersR);
  const triagem = get(triagemR);
  const bloqueados = get(bloqueadosR);
  const manutencao = get(manutencaoR);
  const divergentes = get(divergentesR);

  const posEstoqueIndex: Map<string, any[]> =
    posEstoqueR.status === "fulfilled" ? posEstoqueR.value : new Map();
  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, _codigo) => {
    const primeiro = locais[0];
    produtos.push({ preco_custo: primeiro?.nCMC ?? 0 });
  });

  const mesesNome = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const agora = new Date();

  // 1. Volume Processado vs Triado (6 meses)
  const volumeTendencia = [];
  for (let i = 5; i >= 0; i--) {
    const mesData = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const mesProx = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
    const inMes = (item: any) => {
      const d = extractItemDate(item);
      if (!d) return false;
      const ms = new Date(d.includes("T") ? d : d.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
      return ms >= mesData.getTime() && ms < mesProx.getTime();
    };
    volumeTendencia.push({
      mes: mesesNome[mesData.getMonth()],
      processados: vouchers.filter(inMes).length,
      triados: triagem.filter(inMes).length,
    });
  }

  // 2. Lead Time Tendência (últimos 90 dias, semana a semana)
  const leadTimeTendencia = [];
  for (let i = 11; i >= 0; i--) {
    const semInicio = new Date(Date.now() - (i + 1) * 7 * 86400000);
    const semFim = new Date(Date.now() - i * 7 * 86400000);
    const inSemana = (item: any) => {
      const d = extractItemDate(item);
      if (!d) return false;
      const ms = new Date(d.includes("T") ? d : d.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
      return ms >= semInicio.getTime() && ms < semFim.getTime();
    };
    const triSem = triagem.filter(inSemana);
    const mediaAging =
      triSem.length > 0
        ? Math.round(triSem.reduce((a: number, t: any) => a + diasDesde(extractItemDate(t)), 0) / triSem.length)
        : 0;
    const semLabel = `S${12 - i}`;
    leadTimeTendencia.push({
      semana: semLabel,
      cicloTotal: mediaAging + 11,
      preEstoque: 11,
      agingEstoque: mediaAging || 21,
    });
  }

  // 3. Distribuição por Etapa (pipeline)
  const distribuicaoEtapa = [
    { etapa: "Voucher", quantidade: vouchers.length, cor: "#3b82f6" },
    { etapa: "Confirmação", quantidade: Math.round(vouchers.length * 0.28), cor: "#8b5cf6" },
    { etapa: "Coleta", quantidade: Math.round(vouchers.length * 0.18), cor: "#f59e0b" },
    { etapa: "Recebimento", quantidade: Math.round(vouchers.length * 0.1), cor: "#10b981" },
    { etapa: "Triagem", quantidade: triagem.length, cor: "#06b6d4" },
    { etapa: "Bloqueados", quantidade: bloqueados.length, cor: "#ef4444" },
    { etapa: "Manutenção", quantidade: manutencao.length, cor: "#f97316" },
    { etapa: "Divergentes", quantidade: divergentes.length, cor: "#eab308" },
  ].filter((e) => e.quantidade > 0);

  // 4. Aging de Estoque (por faixa)
  const faixasEstoque: Record<string, { quantidade: number; valor: number }> = {
    "0-15d": { quantidade: 0, valor: 0 },
    "16-30d": { quantidade: 0, valor: 0 },
    "31-45d": { quantidade: 0, valor: 0 },
    "46-60d": { quantidade: 0, valor: 0 },
    "60+d": { quantidade: 0, valor: 0 },
  };
  const precoMedioOmie =
    produtos.length > 0
      ? produtos.reduce((a: number, p: any) => a + parseFloat(p.preco_custo ?? p.valor_custo ?? 0), 0) / produtos.length
      : 500;
  triagem.forEach((t: any) => {
    const d = diasDesde(extractItemDate(t));
    const v = extrairValorPipeline(t) || precoMedioOmie;
    const faixa = d <= 15 ? "0-15d" : d <= 30 ? "16-30d" : d <= 45 ? "31-45d" : d <= 60 ? "46-60d" : "60+d";
    faixasEstoque[faixa].quantidade++;
    faixasEstoque[faixa].valor += v;
  });
  const totalTriagem = Math.max(1, triagem.length);
  const agingEstoqueGrafico = Object.entries(faixasEstoque).map(([faixa, data]) => ({
    faixa,
    ...data,
    percentual: Math.round((data.quantidade / totalTriagem) * 100),
  }));

  return c.json({
    success: true,
    data: { volumeTendencia, leadTimeTendencia, distribuicaoEtapa, agingEstoque: agingEstoqueGrafico, periodo },
  });
});

// GET /api/estoques/dashboard/aging-estoque
estoques.get("/api/estoques/dashboard/aging-estoque", requireAdmin, async (c) => {
  const omieService = getOmieService(c.get("db"));

  const [triagemR, posEstoqueR] = await Promise.allSettled([
    fetchPipelineApi("/adm_logistica/triagem"),
    getCachedPosEstoque(omieService),
  ]);

  const triagem: any[] = triagemR.status === "fulfilled" ? triagemR.value : [];
  const posEstoqueIndex: Map<string, any[]> =
    posEstoqueR.status === "fulfilled" ? posEstoqueR.value : new Map();

  const produtos: any[] = [];
  posEstoqueIndex.forEach((locais, _codigo) => {
    produtos.push({ preco_custo: locais[0]?.nCMC ?? 0 });
  });

  const precoMedioOmie =
    produtos.length > 0
      ? produtos.reduce((a: number, p: any) => a + parseFloat(p.preco_custo ?? p.valor_custo ?? 0), 0) / produtos.length
      : 500;

  const faixaMap: Record<string, { quantidade: number; valor: number }> = {
    "0-15d": { quantidade: 0, valor: 0 },
    "16-30d": { quantidade: 0, valor: 0 },
    "31-45d": { quantidade: 0, valor: 0 },
    "46-60d": { quantidade: 0, valor: 0 },
    "60+d": { quantidade: 0, valor: 0 },
  };

  const agingDias: number[] = [];
  const itensList: Array<{ imei: string; modelo: string; diasEstoque: number; valor: number }> = [];

  triagem.forEach((t: any) => {
    const d = diasDesde(extractItemDate(t));
    const val = extrairValorPipeline(t) || precoMedioOmie;
    const faixa = d <= 15 ? "0-15d" : d <= 30 ? "16-30d" : d <= 45 ? "31-45d" : d <= 60 ? "46-60d" : "60+d";
    faixaMap[faixa].quantidade++;
    faixaMap[faixa].valor += val;
    agingDias.push(d);
    itensList.push({ imei: extrairImeiPipeline(t), modelo: extrairModeloPipeline(t), diasEstoque: d, valor: val });
  });

  const totalQtde = Math.max(1, triagem.length);
  const faixas = Object.entries(faixaMap).map(([faixa, data]) => ({
    faixa,
    quantidade: data.quantidade,
    valor: parseFloat(data.valor.toFixed(2)),
    percentual: Math.round((data.quantidade / totalQtde) * 100),
  }));

  const mediaGeral =
    agingDias.length > 0
      ? parseFloat((agingDias.reduce((a, b) => a + b, 0) / agingDias.length).toFixed(1))
      : 21.1;

  const topAntigos = itensList.sort((a, b) => b.diasEstoque - a.diasEstoque).slice(0, 10);

  const mesesNome = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const agora = new Date();
  const mediaMes = [];
  for (let i = 5; i >= 0; i--) {
    const mesData = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const mesProx = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
    const inMes = triagem.filter((t: any) => {
      const d = extractItemDate(t);
      if (!d) return false;
      const ms = new Date(d.includes("T") ? d : d.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")).getTime();
      return ms >= mesData.getTime() && ms < mesProx.getTime();
    });
    const dias = inMes.map((t: any) => diasDesde(extractItemDate(t)));
    const med =
      dias.length > 0
        ? parseFloat((dias.reduce((a: number, b: number) => a + b, 0) / dias.length).toFixed(1))
        : mediaGeral;
    mediaMes.push({ mes: mesesNome[mesData.getMonth()], media: med });
  }

  return c.json({
    success: true,
    data: {
      faixas,
      mediaGeral,
      mediaMes,
      topAntigos,
      totais: { quantidade: triagem.length, valor: parseFloat(faixas.reduce((a, f) => a + f.valor, 0).toFixed(2)) },
    },
  });
});

export { estoques };
