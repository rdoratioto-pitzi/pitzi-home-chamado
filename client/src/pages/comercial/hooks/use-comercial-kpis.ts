import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DashboardMonth } from "../lib/dashboard-data";

interface ComercialKpiRow {
  id: string;
  periodo: string;
  label: string;
  volume: number;
  ticket: string;
  cmc: string;
  margemUn: string;
  margemPct: string;
  margemTotal: string;
  mcTotal: string;
  comissaoVarPct: string;
  comissaoRepPct: string;
  icmsPct: string;
  pisPct: string;
  cofinsPct: string;
  frete: string;
  faturamentoTotal: string;
  cmcTotal: string;
  freteTotal: string;
  cpdMedio: string;
  markup: string;
  createdAt: string;
  updatedAt: string;
}

export function apiRowToDashboardMonth(row: ComercialKpiRow): DashboardMonth {
  return {
    label: row.label,
    volume: Number(row.volume),
    ticket: Number(row.ticket),
    cmc: Number(row.cmc),
    margemUn: Number(row.margemUn),
    margemPct: Number(row.margemPct),
    margemTotal: Number(row.margemTotal),
    mcTotal: Number(row.mcTotal),
    comissaoVarPct: Number(row.comissaoVarPct),
    comissaoRepPct: Number(row.comissaoRepPct),
    icmsPct: Number(row.icmsPct),
    pisPct: Number(row.pisPct),
    cofinsPct: Number(row.cofinsPct),
    frete: Number(row.frete),
    faturamentoTotal: Number(row.faturamentoTotal),
    cmcTotal: Number(row.cmcTotal),
    freteTotal: Number(row.freteTotal),
    cpdMedio: Number(row.cpdMedio),
    markup: Number(row.markup),
  };
}

export function useComercialKpis() {
  return useQuery<ComercialKpiRow[]>({
    queryKey: ["comercial-kpis"],
    queryFn: async () => {
      const response = await fetch("/api/comercial/kpis");
      if (!response.ok) throw new Error("Erro ao carregar KPIs comerciais");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

interface UpsertPayload {
  periodo: string;
  data: Omit<DashboardMonth, "label"> & { label: string };
}

export function useUpsertComercialKpi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodo, data }: UpsertPayload) => {
      const response = await fetch(`/api/comercial/kpis/${periodo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao salvar KPIs");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comercial-kpis"] });
    },
  });
}
