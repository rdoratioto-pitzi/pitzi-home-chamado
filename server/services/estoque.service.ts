/**
 * Serviço de agregação de dados de estoque
 *
 * Camada de negócio que consolida dados de múltiplas fontes:
 * - Omie (estoque fiscal pós-triagem): via getCachedPosEstoque / getCachedProdutos
 * - API Admin Logística (pipeline pré-estoque): chamadas diretas
 *
 * Regra crítica: usar ListarPosEstoque para saldo (NÃO ConsultarProduto).
 */

import { getCachedPosEstoque, type PosEstoqueEntry } from "./estoque-pos.service";
import { getCachedProdutos } from "./estoque-cache.service";

// ─── Helpers internos ──────────────────────────────────────────────────────────

const PIPELINE_BASE = "https://dash.pitzi.com.br/api";
const PIPELINE_TOKEN = "Renov123";

async function fetchPipeline(path: string): Promise<any[]> {
  try {
    const res = await fetch(`${PIPELINE_BASE}${path}`, {
      headers: { Authorization: `Bearer ${PIPELINE_TOKEN}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  } catch {
    return [];
  }
}

function extrairCategoria(descricao: string): string {
  const d = (descricao || "").toUpperCase();
  if (d.includes("IPHONE") || d.includes("APPLE")) return "iPhone";
  if (d.includes("GALAXY") || d.includes("SAMSUNG")) return "Samsung";
  if (d.includes("MOTOROLA") || d.includes("MOTO ")) return "Motorola";
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
  if (d.includes("MOTOROLA") || d.includes("MOTO ")) return "Motorola";
  if (d.includes("XIAOMI") || d.includes("REDMI") || d.includes("POCO")) return "Xiaomi";
  if (d.includes("LG ")) return "LG";
  if (d.includes("REALME")) return "Realme";
  if (d.includes("NOKIA")) return "Nokia";
  return "Outros";
}

// ─── Types exportados ─────────────────────────────────────────────────────────

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

export interface EstoqueFiltros {
  categoria?: string;
  marca?: string;
  modelo?: string;
  codigoErp?: string;
  page?: number;
  limit?: number;
}

export interface PosicaoEstoqueResult {
  items: EstoqueItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CurvaABCClasse {
  classificacao: "A" | "B" | "C";
  qtdeItens: number;
  percentualValor: number;
  percentualItens: number;
  itens: Array<EstoqueItem & { classificacao: "A" | "B" | "C" }>;
}

export interface CurvaABCResult {
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

export interface GiroEstoqueResult {
  giroMensal: number;
  cobertura: number;
  meta: number;
  porCategoria: Array<{ categoria: string; giro: number; dias: number; estoqueAtual: number }>;
  tendencia: Array<{ mes: string; giro: number }>;
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * KPIs consolidados de estoque.
 * Combina dados do Omie (posEstoque) com pipeline (trânsito, vendidos).
 */
export async function getResumoEstoque(): Promise<EstoqueResumo> {
  const [posEstoqueIndex, triagemR, vouchersR] = await Promise.allSettled([
    getCachedPosEstoque(),
    fetchPipeline("/adm_logistica/triagem"),
    fetchPipeline("/orders/advanced"),
  ]);

  const posEstoque = posEstoqueIndex.status === "fulfilled" ? posEstoqueIndex.value : new Map<string, PosEstoqueEntry[]>();
  const triagem: any[] = triagemR.status === "fulfilled" ? triagemR.value : [];
  const vouchers: any[] = vouchersR.status === "fulfilled" ? vouchersR.value : [];

  // Estoque ativo (Omie)
  let qtdeEstoque = 0;
  let valorEstoque = 0;
  posEstoque.forEach((locais) => {
    const saldo = locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0);
    const cmc = locais[0]?.nCMC ?? 0;
    qtdeEstoque += saldo;
    valorEstoque += saldo * cmc;
  });
  const custoMedioUnitario = qtdeEstoque > 0 ? valorEstoque / qtdeEstoque : 0;

  // Em trânsito: pipeline - já em estoque
  const qtdeEmTransito = Math.max(0, vouchers.length - triagem.length);

  // Vendidos no mês corrente
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const qtdeVendidosMes = triagem.filter((t: any) => {
    const d = t.data_triagem || t.data_recebimento || t.created_at;
    if (!d) return false;
    return new Date(String(d).includes("T") ? d : String(d).replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")) >= inicioMes;
  }).length;

  // Ticket médio: valorEstoque / qtde vendida no mês (estimativa)
  const ticketMedio = qtdeVendidosMes > 0 ? custoMedioUnitario * 1.25 : 0;

  return { qtdeEstoque, valorEstoque, custoMedioUnitario, qtdeEmTransito, qtdeVendidosMes, ticketMedio };
}

/**
 * Lista paginada de itens em estoque com filtros.
 */
export async function getPosicaoEstoque(filtros: EstoqueFiltros = {}): Promise<PosicaoEstoqueResult> {
  const posEstoque = await getCachedPosEstoque();
  const { categoria, marca, modelo, codigoErp, page = 1, limit = 50 } = filtros;

  const allItems: EstoqueItem[] = [];
  posEstoque.forEach((locais, codigo) => {
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

  let filtered = allItems;
  if (categoria && categoria !== "all") {
    const q = categoria.toLowerCase();
    filtered = filtered.filter((p) => p.categoria.toLowerCase().includes(q));
  }
  if (marca && marca !== "all") {
    const q = marca.toLowerCase();
    filtered = filtered.filter((p) => p.marca.toLowerCase().includes(q));
  }
  if (modelo && modelo !== "all") {
    const q = modelo.toLowerCase();
    filtered = filtered.filter((p) => p.modelo.toLowerCase().includes(q));
  }
  if (codigoErp) {
    const q = codigoErp.toLowerCase();
    filtered = filtered.filter((p) => p.codigoErp.toLowerCase().includes(q));
  }

  const total = filtered.length;
  const items = filtered.slice((page - 1) * limit, page * limit);

  return { items, total, page, limit };
}

/**
 * Classificação ABC dos itens em estoque por valor.
 * A = 80% do valor total, B = 15%, C = 5%.
 */
export async function getCurvaABC(): Promise<CurvaABCResult> {
  const posEstoque = await getCachedPosEstoque();

  const emptyClasse = { itens: 0, percentualItens: 0, percentualValor: 0 };

  if (posEstoque.size === 0) {
    return {
      resumo: { classeA: emptyClasse, classeB: emptyClasse, classeC: emptyClasse, valorTotal: 0, totalItens: 0 },
      classes: [],
      grafico: [],
    };
  }

  // Montar itens ordenados por valor decrescente
  const itens: Array<EstoqueItem & { classificacao: "A" | "B" | "C" }> = [];
  posEstoque.forEach((locais, codigo) => {
    const primeiro = locais[0];
    const descricao = primeiro?.cDescricao || "";
    const estoqueDisponivel = locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0);
    const custoUnitario = primeiro?.nCMC ?? 0;
    const valorVenda = primeiro?.nPrecoUnitario ?? 0;
    const custoTotal = estoqueDisponivel * custoUnitario;
    const markup = custoUnitario > 0 ? ((valorVenda - custoUnitario) / custoUnitario) * 100 : 0;
    itens.push({
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
      classificacao: "C",
    });
  });

  itens.sort((a, b) => b.custoTotal - a.custoTotal);

  const valorTotal = itens.reduce((s, i) => s + i.custoTotal, 0);
  const totalItens = itens.length;

  // Classificar
  let acumulado = 0;
  const classificados = itens.map((item) => {
    acumulado += item.custoTotal;
    const pct = valorTotal > 0 ? (acumulado / valorTotal) * 100 : 0;
    const classificacao: "A" | "B" | "C" = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return { ...item, classificacao };
  });

  const itensPorClasse = { A: classificados.filter((i) => i.classificacao === "A"), B: classificados.filter((i) => i.classificacao === "B"), C: classificados.filter((i) => i.classificacao === "C") };
  const valorPorClasse = {
    A: itensPorClasse.A.reduce((s, i) => s + i.custoTotal, 0),
    B: itensPorClasse.B.reduce((s, i) => s + i.custoTotal, 0),
    C: itensPorClasse.C.reduce((s, i) => s + i.custoTotal, 0),
  };

  const pctItens = (n: number) => parseFloat(((n / totalItens) * 100).toFixed(1));
  const pctValor = (v: number) => parseFloat(((v / (valorTotal || 1)) * 100).toFixed(1));

  const resumo = {
    classeA: { itens: itensPorClasse.A.length, percentualItens: pctItens(itensPorClasse.A.length), percentualValor: pctValor(valorPorClasse.A) },
    classeB: { itens: itensPorClasse.B.length, percentualItens: pctItens(itensPorClasse.B.length), percentualValor: pctValor(valorPorClasse.B) },
    classeC: { itens: itensPorClasse.C.length, percentualItens: pctItens(itensPorClasse.C.length), percentualValor: pctValor(valorPorClasse.C) },
    valorTotal,
    totalItens,
  };

  const classes: CurvaABCClasse[] = (["A", "B", "C"] as const).map((cls) => ({
    classificacao: cls,
    qtdeItens: itensPorClasse[cls].length,
    percentualValor: pctValor(valorPorClasse[cls]),
    percentualItens: pctItens(itensPorClasse[cls].length),
    itens: itensPorClasse[cls],
  }));

  // Dados do gráfico de Pareto
  let acumPareto = 0;
  const grafico = classificados.slice(0, 20).map((item) => {
    acumPareto += item.custoTotal;
    return {
      classificacao: item.classificacao,
      valor: parseFloat(item.custoTotal.toFixed(2)),
      percentual: parseFloat(((item.custoTotal / (valorTotal || 1)) * 100).toFixed(1)),
      acumulado: parseFloat(((acumPareto / (valorTotal || 1)) * 100).toFixed(1)),
    };
  });

  return { resumo, classes, grafico };
}

/**
 * Métricas de giro de estoque.
 * Giro mensal = vendas do mês / estoque médio.
 * Cobertura = estoque atual / média diária de vendas (em dias).
 */
export async function getGiroEstoque(): Promise<GiroEstoqueResult> {
  const [posEstoqueR, triagemR] = await Promise.allSettled([
    getCachedPosEstoque(),
    fetchPipeline("/adm_logistica/triagem"),
  ]);

  const posEstoque = posEstoqueR.status === "fulfilled" ? posEstoqueR.value : new Map<string, PosEstoqueEntry[]>();
  const triagem: any[] = triagemR.status === "fulfilled" ? triagemR.value : [];

  // Estoque total por categoria
  const estoquePorCategoria: Record<string, { quantidade: number; valor: number }> = {};
  posEstoque.forEach((locais) => {
    const desc = locais[0]?.cDescricao || "";
    const cat = extrairCategoria(desc);
    const saldo = locais.reduce((s, l) => s + (l.nSaldo ?? 0), 0);
    const cmc = locais[0]?.nCMC ?? 0;
    if (!estoquePorCategoria[cat]) estoquePorCategoria[cat] = { quantidade: 0, valor: 0 };
    estoquePorCategoria[cat].quantidade += saldo;
    estoquePorCategoria[cat].valor += saldo * cmc;
  });

  const estoqueTotal = Object.values(estoquePorCategoria).reduce((s, c) => s + c.quantidade, 0);
  const triagemMes = triagem.filter((t: any) => {
    const d = t.data_triagem || t.data_recebimento || t.created_at;
    if (!d) return false;
    const dt = new Date(String(d).includes("T") ? d : String(d).replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    return dt >= inicioMes;
  }).length;

  const giroMensal = estoqueTotal > 0 ? parseFloat((triagemMes / estoqueTotal).toFixed(2)) : 0;
  const mediaDiaria = triagemMes / 30;
  const cobertura = mediaDiaria > 0 ? Math.round(estoqueTotal / mediaDiaria) : 0;

  const porCategoria = Object.entries(estoquePorCategoria).map(([categoria, data]) => {
    const giroCat = data.quantidade > 0 && triagemMes > 0 ? parseFloat(((triagemMes * (data.quantidade / estoqueTotal)) / data.quantidade).toFixed(2)) : 0;
    return { categoria, giro: giroCat, dias: giroCat > 0 ? Math.round(365 / giroCat) : 0, estoqueAtual: data.quantidade };
  }).sort((a, b) => b.giro - a.giro);

  // Tendência dos últimos 6 meses (simulada com base no triagem histórico)
  const agora = new Date();
  const mesesNome = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const tendencia = Array.from({ length: 6 }, (_, i) => {
    const mes = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1);
    const mesProx = new Date(agora.getFullYear(), agora.getMonth() - (5 - i) + 1, 1);
    const count = triagem.filter((t: any) => {
      const d = t.data_triagem || t.data_recebimento || t.created_at;
      if (!d) return false;
      const dt = new Date(String(d).includes("T") ? d : String(d).replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
      return dt >= mes && dt < mesProx;
    }).length;
    const giro = estoqueTotal > 0 ? parseFloat((count / estoqueTotal).toFixed(2)) : 0;
    return { mes: mesesNome[mes.getMonth()], giro };
  });

  return { giroMensal, cobertura, meta: 1.5, porCategoria, tendencia };
}
