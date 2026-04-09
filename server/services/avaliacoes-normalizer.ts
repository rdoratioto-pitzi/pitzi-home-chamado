/**
 * Normalização de dados da API proxy RenovSmart (Lapisco)
 * Transforma dados por FOTO em dados por DISPOSITIVO
 * Aplica regras POP 101 V3: Grade D → C, granularidade por dispositivo
 */

import type { Grade, FotoArea as FotoAreaType, FotoAvaliacao, TradeInAvaliacao } from "./renovsmart-avaliacoes";

// ─── 7-slot photo definitions (ordered) ─────────────────────────────────────

export const FOTO_SLOTS: ReadonlyArray<{ slot: number; tipo: string; area: FotoAreaType; patterns: string[] }> = [
  { slot: 1, tipo: "Foto da Tela com IMEI",  area: "display",  patterns: ["tela", "imei"] },
  { slot: 2, tipo: "Foto da Tela Desligada",  area: "display",  patterns: ["tela", "desligada"] },
  { slot: 3, tipo: "Foto da Parte Traseira",   area: "carcaca",  patterns: ["traseira"] },
  { slot: 4, tipo: "Foto Lateral Esquerda",    area: "carcaca",  patterns: ["lateral", "esquerda"] },
  { slot: 5, tipo: "Foto Lateral Direita",     area: "carcaca",  patterns: ["lateral", "direita"] },
  { slot: 6, tipo: "Foto Parte Inferior",      area: "carcaca",  patterns: ["inferior"] },
  { slot: 7, tipo: "Foto Parte Superior",      area: "carcaca",  patterns: ["superior"] },
] as const;

function matchFotoSlot(descricao: string): (typeof FOTO_SLOTS)[number] | null {
  if (!descricao) return null;
  const lower = descricao.toLowerCase();

  // Skip video/360
  if (lower.includes("video") || lower.includes("360")) return null;

  // Try to match each slot by ALL its patterns present in the description
  for (const slotDef of FOTO_SLOTS) {
    const allMatch = slotDef.patterns.every((p) => lower.includes(p));
    if (allMatch) return slotDef;
  }

  // Fallback: single-keyword matches for less specific descriptions
  if (lower.includes("traseira") || lower.includes("back") || lower.includes("rear")) return FOTO_SLOTS[2]; // slot 3
  if (lower.includes("lateral")) return FOTO_SLOTS[3]; // default to slot 4
  if (lower.includes("tela") || lower.includes("frente") || lower.includes("front") || lower.includes("display") || lower.includes("screen")) return FOTO_SLOTS[0]; // slot 1

  return null;
}

// ─── Grade Normalization (POP 101 V3) ────────────────────────────────────────

export function normalizeGrade(grade: string | null | undefined): Grade | null {
  if (!grade) return null;
  const upper = grade.trim().toUpperCase();
  if (upper === "D") return "C";
  if (upper === "A" || upper === "B" || upper === "C") return upper as Grade;
  return null;
}

// ─── Photo-to-Area Mapping ───────────────────────────────────────────────────

export type FotoArea = FotoAreaType | "ignorar";

const DISPLAY_PATTERNS = [
  "frente", "tela", "front", "display", "screen",
];

const CARCACA_PATTERNS = [
  "traseira", "lateral", "superior", "inferior", "parte",
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
  // Common fields
  Imei: string;
  Categoria?: string;
  Modelo?: string;
  // Old field names (from /detalhes endpoint)
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
  // New field names (from /imei endpoint, with accents/spaces) — DEPRECATED
  "Nota IA"?: string;
  "Nota Humana"?: string;
  "Descrição Captura"?: string;
  "Url Captura"?: string;
  "Código Voucher"?: string;
  "Criação Pedido"?: string;
  "Tags IA"?: string | null;
  "Tags Humana"?: string | null;
  "Auto Avaliada"?: boolean;
  "Id da Avaliação"?: string;
  "Id da Captura"?: string;
  // Current field names (from /imei endpoint, underscore format)
  Url_Captura?: string;
  Auto_Avaliada?: boolean;
  Id_Avaliacao?: string;
  Id_Captura?: string;
}

interface DispositivoAgrupado {
  imei: string;
  modelo: string;
  categoria: string;
  dataTradeIn: string;
  linkFotos: string | null;
  displayGradesIa: (Grade | null)[];
  displayGradesHumano: (Grade | null)[];
  carcacaGradesIa: (Grade | null)[];
  carcacaGradesHumano: (Grade | null)[];
  imagemFrontal: string | null;
  imagemTraseira: string | null;
  imagemLateral1: string | null;
  imagemLateral2: string | null;
  imagemDetalhe: string | null;
  codigoVoucher: string | null;
  autoAvaliada: boolean;
  idAvaliacao: string | null;
  // New: per-photo data keyed by slot number
  fotosMap: Map<number, FotoAvaliacao>;
}

function assignImageSlot(device: DispositivoAgrupado, desc: string, url: string): void {
  const lower = desc.toLowerCase();
  if (lower.includes("traseira") || lower.includes("back") || lower.includes("rear")) {
    if (!device.imagemTraseira) device.imagemTraseira = url;
  } else if ((lower.includes("lateral direita") || lower.includes("lateral d")) && !device.imagemLateral1) {
    device.imagemLateral1 = url;
  } else if ((lower.includes("lateral esquerda") || lower.includes("lateral e")) && !device.imagemLateral2) {
    device.imagemLateral2 = url;
  } else if (lower.includes("lateral") && !device.imagemLateral1) {
    device.imagemLateral1 = url;
  } else if (!device.imagemDetalhe) {
    device.imagemDetalhe = url;
  }
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

    // Support old field names (/detalhes), space-separated (/imei legacy), and underscore (/imei current)
    const gradeIaRaw = foto.Nota_IA || foto["Nota IA"] || foto.Grade_IA;
    const gradeHumanoRaw = foto.Nota_Humana || foto["Nota Humana"] || foto.Grade_Humano;
    const gradeIa = normalizeGrade(gradeIaRaw);
    const gradeHumano = normalizeGrade(gradeHumanoRaw);

    const descCaptura = foto.Descricao_Captura || foto["Descrição Captura"] || foto.Nome_da_Tela || "";
    const urlCaptura = foto.Url_Captura || foto["Url Captura"] || null;
    const area = mapFotoToArea(descCaptura);

    const dataTradeIn =
      foto.Data_Avaliacao ||
      foto.Criacao_Pedido ||
      foto["Criação Pedido"] ||
      new Date().toISOString();

    if (!grouped.has(imei)) {
      const linkFotos = typeof foto.Link_Fotos === "string" && foto.Link_Fotos ? foto.Link_Fotos : null;
      grouped.set(imei, {
        imei,
        modelo: foto.Modelo || foto.Categoria || "",
        categoria: foto.Categoria || "smartphone",
        dataTradeIn,
        linkFotos,
        codigoVoucher: foto.Codigo_Voucher || foto["Código Voucher"] || null,
        autoAvaliada: foto.Auto_Avaliada ?? foto["Auto Avaliada"] ?? false,
        idAvaliacao: foto.Id_Avaliacao || foto["Id da Avaliação"] || null,
        displayGradesIa: [],
        displayGradesHumano: [],
        carcacaGradesIa: [],
        carcacaGradesHumano: [],
        imagemFrontal: null,
        imagemTraseira: null,
        imagemLateral1: null,
        imagemLateral2: null,
        imagemDetalhe: null,
        fotosMap: new Map(),
      });
    }

    const device = grouped.get(imei)!;

    // Map photo to named slot (1-7)
    const tagsIa = foto.Tags_IA ?? foto["Tags IA"] ?? null;
    const tagsHumana = foto.Tags_Humana ?? foto["Tags Humana"] ?? null;
    const slotDef = matchFotoSlot(descCaptura);
    if (slotDef && !device.fotosMap.has(slotDef.slot)) {
      device.fotosMap.set(slotDef.slot, {
        slot: slotDef.slot,
        tipo: slotDef.tipo,
        area: slotDef.area,
        url: urlCaptura,
        notaIa: gradeIa,
        notaHumana: gradeHumano,
        tagsIa,
        tagsHumana,
        idCaptura: foto.Id_Captura || foto["Id da Captura"] || null,
      });
    }

    if (area === "display") {
      device.displayGradesIa.push(gradeIa);
      device.displayGradesHumano.push(gradeHumano);
      if (urlCaptura && !device.imagemFrontal) device.imagemFrontal = urlCaptura;
    } else if (area === "carcaca") {
      device.carcacaGradesIa.push(gradeIa);
      device.carcacaGradesHumano.push(gradeHumano);
      if (urlCaptura) assignImageSlot(device, descCaptura, urlCaptura);
    } else {
      // Unknown area — still accumulate grades
      device.displayGradesIa.push(gradeIa);
      device.carcacaGradesIa.push(gradeIa);
      device.displayGradesHumano.push(gradeHumano);
      device.carcacaGradesHumano.push(gradeHumano);
    }

    const linkFotosValido = typeof foto.Link_Fotos === "string" && foto.Link_Fotos ? foto.Link_Fotos : null;
    if (linkFotosValido && !device.linkFotos) device.linkFotos = linkFotosValido;
  }

  const result: TradeInAvaliacao[] = [];

  for (const [imei, device] of grouped) {
    const allIaGrades = [...device.displayGradesIa, ...device.carcacaGradesIa];
    const allHumanoGrades = [...device.displayGradesHumano, ...device.carcacaGradesHumano];

    const gradeIaDisplay = worstGrade(device.displayGradesIa) ?? worstGrade(allIaGrades);
    const gradeIaCarcaca = worstGrade(device.carcacaGradesIa) ?? worstGrade(allIaGrades);
    const gradeHumanoDisplay = worstGrade(device.displayGradesHumano) ?? worstGrade(allHumanoGrades);
    const gradeHumanoCarcaca = worstGrade(device.carcacaGradesHumano) ?? worstGrade(allHumanoGrades);

    // Build 7-slot fotos array (fill missing slots with null url)
    const fotos: FotoAvaliacao[] = FOTO_SLOTS.map((slotDef) => {
      const existing = device.fotosMap.get(slotDef.slot);
      if (existing) return existing;
      return {
        slot: slotDef.slot,
        tipo: slotDef.tipo,
        area: slotDef.area,
        url: null,
        notaIa: null,
        notaHumana: null,
        tagsIa: null,
        tagsHumana: null,
        idCaptura: null,
      };
    });

    result.push({
      tradeInId: imei,
      imei,
      modelo: device.modelo,
      categoria: device.categoria,
      dataTradeIn: device.dataTradeIn,
      precoMaximo: 0,
      gradeIaDisplay,
      gradeIaCarcaca,
      gradeHumanoDisplay,
      gradeHumanoCarcaca,
      avaliadorHumanoId: null,
      avaliadorHumanoNome: null,
      imagemFrontal: device.imagemFrontal,
      imagemTraseira: device.imagemTraseira,
      imagemLateral1: device.imagemLateral1,
      imagemLateral2: device.imagemLateral2,
      imagemDetalhe: device.imagemDetalhe,
      linkFotos: device.linkFotos,
      fotos,
      codigoVoucher: device.codigoVoucher,
      autoAvaliada: device.autoAvaliada,
      idAvaliacao: device.idAvaliacao,
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
