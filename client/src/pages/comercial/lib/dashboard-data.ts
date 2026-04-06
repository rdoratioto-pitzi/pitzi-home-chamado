export interface DashboardMonth {
  label: string;
  volume: number;
  ticket: number;
  cmc: number;
  margemUn: number;
  margemPct: number;
  margemTotal: number;
  mcTotal: number;
  comissaoVarPct: number;
  comissaoRepPct: number;
  icmsPct: number;
  pisPct: number;
  cofinsPct: number;
  frete: number;
  faturamentoTotal: number;
  cmcTotal: number;
  freteTotal: number;
  cpdMedio: number;
  markup: number;
}

const EMPTY_MONTH: Omit<DashboardMonth, "label"> = {
  volume: 0,
  ticket: 0,
  cmc: 0,
  margemUn: 0,
  margemPct: 0,
  margemTotal: 0,
  mcTotal: 0,
  comissaoVarPct: 0,
  comissaoRepPct: 0,
  icmsPct: 0,
  pisPct: 0,
  cofinsPct: 0,
  frete: 0,
  faturamentoTotal: 0,
  cmcTotal: 0,
  freteTotal: 0,
  cpdMedio: 0,
  markup: 0,
};

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function generateMonthKeys(): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let offset = -6; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    keys.push(`${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`);
  }
  return keys;
}

export const MONTH_KEYS = generateMonthKeys();
export type MonthKey = string;

export function monthKeyToPeriodo(key: MonthKey): string {
  const [abbr, year] = key.split("-");
  const monthIdx = MONTH_ABBR.indexOf(abbr);
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}

export function periodoToMonthKey(periodo: string): MonthKey | undefined {
  const [year, month] = periodo.split("-");
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11) return undefined;
  return `${MONTH_ABBR[idx]}-${year}`;
}

export function monthKeyToLabel(key: MonthKey): string {
  const [abbr, year] = key.split("-");
  const idx = MONTH_ABBR.indexOf(abbr);
  return idx >= 0 ? `${MONTH_LABELS[idx]} ${year}` : key;
}

function buildInitialData(): Record<MonthKey, DashboardMonth> {
  const result: Record<string, DashboardMonth> = {};
  for (const key of MONTH_KEYS) {
    result[key] = { label: monthKeyToLabel(key), ...EMPTY_MONTH };
  }
  // Seed dados reais de março 2026
  if (result["mar-2026"]) {
    result["mar-2026"] = {
      label: "Mar 2026",
      volume: 1643,
      ticket: 709.28,
      cmc: 523.68,
      margemUn: 46.43,
      margemPct: 8.87,
      margemTotal: 76281,
      mcTotal: 304938,
      comissaoVarPct: 10,
      comissaoRepPct: 0,
      icmsPct: 3.51,
      pisPct: 0.65,
      cofinsPct: 3.00,
      frete: 36.01,
      faturamentoTotal: 1165339.11,
      cmcTotal: 860401.56,
      freteTotal: 59148.00,
      cpdMedio: 612.85,
      markup: 1.35,
    };
  }
  return result;
}

export const INITIAL_DASHBOARD_DATA: Record<MonthKey, DashboardMonth> = buildInitialData();

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}
