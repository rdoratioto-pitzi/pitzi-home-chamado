// Formatação de valores de Key Results por tipo de medição.
// Usado nas views Bullets e Organograma + dialogs de criação/edição.

export type MeasurementType =
  | "absolute"
  | "percentage"
  | "monetary"
  | "temporal"
  | "binary"
  | "decreasing";

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formata um valor individual de KR (baseline/current/target) respeitando o tipo de medição.
 * Exemplos:
 *  - monetary: "R$ 1.200.000"
 *  - percentage: "75%"
 *  - binary: "Sim" / "Não"
 *  - absolute/temporal: "100 clientes" (usa unit se informada)
 */
export function formatKRValue(
  value: string | number | null | undefined,
  measurementType: string | null | undefined,
  unit?: string | null,
): string {
  const num = toNumber(value);
  switch (measurementType) {
    case "monetary":
      return num.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    case "percentage":
      return `${num}%`;
    case "binary":
      return num > 0 ? "Sim" : "Não";
    case "decreasing":
    case "absolute":
    case "temporal":
    default:
      return unit ? `${num.toLocaleString("pt-BR")} ${unit}` : num.toLocaleString("pt-BR");
  }
}

/**
 * Formata a faixa "De X → Para Y" para exibição nos cards.
 */
export function formatKRRange(
  startValue: string | number | null | undefined,
  targetValue: string | number | null | undefined,
  measurementType: string | null | undefined,
  unit?: string | null,
): string {
  if (measurementType === "binary") {
    return "Não → Sim";
  }
  const start = formatKRValue(startValue, measurementType, unit);
  const target = formatKRValue(targetValue, measurementType, unit);
  if (measurementType === "decreasing") {
    return `De ${start} → Para ${target} (menos é melhor)`;
  }
  return `De ${start} → Para ${target}`;
}

/**
 * Formata "current / target" para exibição compacta sob a barra de progresso.
 */
export function formatKRCurrentOverTarget(
  currentValue: string | number | null | undefined,
  targetValue: string | number | null | undefined,
  measurementType: string | null | undefined,
  unit?: string | null,
): string {
  if (measurementType === "binary") {
    return toNumber(currentValue) > 0 ? "Concluído" : "Não concluído";
  }
  const current = formatKRValue(currentValue, measurementType, unit);
  const target = formatKRValue(targetValue, measurementType, unit);
  return `${current} / ${target}`;
}

// ─── Input helpers (moeda BRL) ────────────────────────────────────────────────

/**
 * Formata um número como moeda BRL sem o símbolo (para usar em inputs).
 * Ex: 1200000 → "1.200.000"
 */
export function formatCurrencyInputValue(value: number | string): string {
  const num = toNumber(value);
  if (num === 0) return "";
  return num.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/**
 * Remove todos os caracteres não numéricos (para extrair valor puro de um input formatado).
 */
export function parseCurrencyInputValue(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
