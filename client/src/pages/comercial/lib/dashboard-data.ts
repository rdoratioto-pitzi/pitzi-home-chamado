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
};

export const MONTH_KEYS = ["mar-2026", "abr-2026", "mai-2026", "jun-2026"] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];

// Mapeamento periodo API (YYYY-MM) <-> MonthKey (mmm-yyyy)
const PERIODO_TO_KEY: Record<string, MonthKey> = {
  "2026-03": "mar-2026",
  "2026-04": "abr-2026",
  "2026-05": "mai-2026",
  "2026-06": "jun-2026",
};

const KEY_TO_PERIODO: Record<MonthKey, string> = {
  "mar-2026": "2026-03",
  "abr-2026": "2026-04",
  "mai-2026": "2026-05",
  "jun-2026": "2026-06",
};

export function monthKeyToPeriodo(key: MonthKey): string {
  return KEY_TO_PERIODO[key];
}

export function periodoToMonthKey(periodo: string): MonthKey | undefined {
  return PERIODO_TO_KEY[periodo];
}

export const INITIAL_DASHBOARD_DATA: Record<MonthKey, DashboardMonth> = {
  "mar-2026": {
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
  },
  "abr-2026": { label: "Abr 2026", ...EMPTY_MONTH },
  "mai-2026": { label: "Mai 2026", ...EMPTY_MONTH },
  "jun-2026": { label: "Jun 2026", ...EMPTY_MONTH },
};

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
