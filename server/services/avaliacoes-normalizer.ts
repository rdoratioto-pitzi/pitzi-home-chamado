/**
 * Normalização de dados da API proxy RenovSmart (Lapisco)
 * Transforma dados por FOTO em dados por DISPOSITIVO
 * Aplica regras POP 101 V3: Grade D → C, granularidade por dispositivo
 */

import type { Grade, TradeInAvaliacao } from "./renovsmart-avaliacoes";

// ─── Grade Normalization (POP 101 V3) ────────────────────────────────────────

export function normalizeGrade(grade: string | null | undefined): Grade | null {
  if (!grade) return null;
  const upper = grade.trim().toUpperCase();
  if (upper === "D") return "C";
  if (upper === "A" || upper === "B" || upper === "C") return upper as Grade;
  return null;
}

// ─── Photo-to-Area Mapping ───────────────────────────────────────────────────

export type FotoArea = "display" | "carcaca" | "ignorar";

const DISPLAY_PATTERNS = [
  "frente", "tela", "front", "display", "screen",
];

const CARCACA_PATTERNS = [
  "traseira", "lateral", "superior", "inferior",
  "back", "rear", "side", "top", "bottom",
];

const IGNORAR_PATTERNS = [
  "video", "360",
];

export function mapFotoToArea(tipoFoto: string): FotoArea {
  if (!tipoFoto) return "ignorar";
  const lower = tipoFoto.toLowerCase();

  for (const pattern of IGNORAR_PATTERNS) {
    if (lower.includes(pattern)) return "ignorar";
  }
  for (const pattern of DISPLAY_PATTERNS) {
    if (lower.includes(pattern)) return "display";
  }
  for (const pattern of CARCACA_PATTERNS) {
    if (lower.includes(pattern)) return "carcaca";
  }

  return "ignorar";
}

// ─── Grade comparison helpers ────────────────────────────────────────────────

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };

function worstGrade(grades: (Grade | null)[]): Grade | null {
  const valid = grades.filter((g): g is Grade => g !== null);
  if (valid.length === 0) return null;
  return valid.reduce((worst, g) =>
    (GRADE_ORDER[g] ?? 0) > (GRADE_ORDER[worst] ?? 0) ? g : worst
  );
}

// ─── Interfaces for raw API data ─────────────────────────────────────────────

export interface RawFotoAvaliacao {
  Imei: string;
  Categoria?: string;
  Modelo?: string;
  Data_Avaliacao?: string;
  Grade_IA?: string;
  Grade_Humano?: string;
  Nota_IA?: string;
  Nota_Humana?: string;
  Descricao_Captura?: string;
  Nome_da_Tela?: string;
  Link_Fotos?: string | boolean;
  Codigo_Voucher?: string;
  Criacao_Pedido?: string;
  Tags_IA?: string | null;
  Tags_Humana?: string | null;
  Is_Match?: number;
  Status_Assertividade?: string;
}

interface DispositivoAgrupado {
  imei: string;
  modelo: string;
  categoria: string;
  dataTradeIn: string;
  linkFotos: string | null;
  gradesIa: (Grade | null)[];
  gradesHumano: (Grade | null)[];
}

// ─── Aggregate photos → devices ──────────────────────────────────────────────

export function agregarPorDispositivo(
  avaliacoesPorFoto: RawFotoAvaliacao[],
  curadosSet: Set<string> = new Set()
): TradeInAvaliacao[] {
  const grouped = new Map<string, DispositivoAgrupado>();

  for (const foto of avaliacoesPorFoto) {
    const imei = foto.Imei;
    if (!imei) continue;

    const gradeIa = normalizeGrade(foto.Grade_IA || foto.Nota_IA);
    const gradeHumano = normalizeGrade(foto.Grade_Humano || foto.Nota_Humana);

    if (!grouped.has(imei)) {
      grouped.set(imei, {
        imei,
        modelo: foto.Modelo || foto.Categoria || "",
        categoria: foto.Categoria || "smartphone",
        dataTradeIn: foto.Data_Avaliacao || foto.Criacao_Pedido || new Date().toISOString(),
        linkFotos: typeof foto.Link_Fotos === 'string' && foto.Link_Fotos ? foto.Link_Fotos : null,
        gradesIa: [],
        gradesHumano: [],
      });
    }

    const device = grouped.get(imei)!;
    device.gradesIa.push(gradeIa);
    device.gradesHumano.push(gradeHumano);
    // Preserve the most recent link if multiple records exist for same IMEI
    const linkFotosValido = typeof foto.Link_Fotos === 'string' && foto.Link_Fotos ? foto.Link_Fotos : null;
    if (linkFotosValido && !device.linkFotos) {
      device.linkFotos = linkFotosValido;
    }
  }

  const result: TradeInAvaliacao[] = [];

  for (const [imei, device] of grouped) {
    // API returns one grade per device evaluation (not per photo area).
    // Use the same aggregated grade for both display and carcaça.
    const gradeIa = worstGrade(device.gradesIa);
    const gradeHumano = worstGrade(device.gradesHumano);

    result.push({
      tradeInId: imei,
      imei,
      modelo: device.modelo,
      categoria: device.categoria,
      dataTradeIn: device.dataTradeIn,
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
      linkFotos: device.linkFotos,
      foiCurado: curadosSet.has(imei),
    });
  }

  return result;
}

// ─── Assertividade por dispositivo ───────────────────────────────────────────

export interface AssertividadeResult {
  acuraciaIa: number;
  total: number;
  acertos: number;
  erros: number;
}

export function calcularAssertividadePorDispositivo(
  dispositivos: TradeInAvaliacao[]
): AssertividadeResult {
  let acertos = 0;
  let total = 0;

  for (const d of dispositivos) {
    if (d.gradeIaDisplay && d.gradeHumanoDisplay) {
      total++;
      if (d.gradeIaDisplay === d.gradeHumanoDisplay) acertos++;
    }
    if (d.gradeIaCarcaca && d.gradeHumanoCarcaca) {
      total++;
      if (d.gradeIaCarcaca === d.gradeHumanoCarcaca) acertos++;
    }
  }

  return {
    acuraciaIa: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0,
    total,
    acertos,
    erros: total - acertos,
  };
}

// ─── Build confusion matrix from devices (3×3, no Grade D) ──────────────────

export interface MatrizEntry {
  atribuido: Grade;
  correto: Grade;
  quantidade: number;
  percentual: number;
}

export function buildMatrizConfusaoFromDevices(
  dispositivos: TradeInAvaliacao[],
  tipo: "ia" | "humano" = "ia"
): { matriz: MatrizEntry[]; totalAvaliacoes: number; acuraciaGeral: number } {
  const counts = new Map<string, number>();
  let total = 0;

  for (const d of dispositivos) {
    const pares: [Grade | null, Grade | null][] = [];

    if (tipo === "ia") {
      if (d.gradeIaDisplay && d.gradeHumanoDisplay) pares.push([d.gradeIaDisplay, d.gradeHumanoDisplay]);
      if (d.gradeIaCarcaca && d.gradeHumanoCarcaca) pares.push([d.gradeIaCarcaca, d.gradeHumanoCarcaca]);
    } else {
      if (d.gradeHumanoDisplay) pares.push([d.gradeHumanoDisplay, d.gradeHumanoDisplay]);
      if (d.gradeHumanoCarcaca) pares.push([d.gradeHumanoCarcaca, d.gradeHumanoCarcaca]);
    }

    for (const [atrib, correto] of pares) {
      if (atrib && correto) {
        const key = `${atrib}|${correto}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        total++;
      }
    }
  }

  const grades: Grade[] = ["A", "B", "C"];
  const matriz: MatrizEntry[] = [];
  for (const atribuido of grades) {
    for (const correto of grades) {
      const quantidade = counts.get(`${atribuido}|${correto}`) ?? 0;
      matriz.push({
        atribuido,
        correto,
        quantidade,
        percentual: total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0,
      });
    }
  }

  const acertos = grades.reduce((sum, g) => sum + (counts.get(`${g}|${g}`) ?? 0), 0);
  return {
    matriz,
    totalAvaliacoes: total,
    acuraciaGeral: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0,
  };
}
