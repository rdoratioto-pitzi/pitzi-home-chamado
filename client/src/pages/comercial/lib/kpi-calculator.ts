export interface KpiInputs {
  vendas: number;
  faturamentoTotal: number;
  cmcTotal: number;
  freteTotal: number;
  icmsPct: number;
  pisPct: number;
  cofinsPct: number;
  comissaoVarPct: number;
  comissaoRepPct: number;
}

export interface KpiCalculated {
  ticketMedio: number;
  cmcMedio: number;
  freteMedioUn: number;
  mcTotal: number;
  mcPct: number;
  icmsUn: number;
  pisUn: number;
  cofinsUn: number;
  comissaoVarUn: number;
  comissaoRepUn: number;
  cpdMedio: number;
  margemLiqUn: number;
  margemLiqTotal: number;
  margemLiqPct: number;
  markup: number;
}

const ZERO_RESULT: KpiCalculated = {
  ticketMedio: 0,
  cmcMedio: 0,
  freteMedioUn: 0,
  mcTotal: 0,
  mcPct: 0,
  icmsUn: 0,
  pisUn: 0,
  cofinsUn: 0,
  comissaoVarUn: 0,
  comissaoRepUn: 0,
  cpdMedio: 0,
  margemLiqUn: 0,
  margemLiqTotal: 0,
  margemLiqPct: 0,
  markup: 0,
};

export function calcKpis(inputs: KpiInputs): KpiCalculated {
  const { vendas, faturamentoTotal, cmcTotal, freteTotal } = inputs;

  if (vendas <= 0) return ZERO_RESULT;

  const ticketMedio = faturamentoTotal / vendas;
  const cmcMedio = cmcTotal / vendas;
  const freteMedioUn = freteTotal / vendas;

  const mcTotal = faturamentoTotal - cmcTotal;
  const mcPct = faturamentoTotal > 0 ? (mcTotal / faturamentoTotal) * 100 : 0;

  const icmsUn = ticketMedio * (inputs.icmsPct / 100);
  const pisUn = ticketMedio * (inputs.pisPct / 100);
  const cofinsUn = ticketMedio * (inputs.cofinsPct / 100);
  const comissaoVarUn = cmcMedio * (inputs.comissaoVarPct / 100);
  const comissaoRepUn = ticketMedio * (inputs.comissaoRepPct / 100);

  const cpdMedio = cmcMedio + icmsUn + pisUn + cofinsUn + freteMedioUn + comissaoVarUn + comissaoRepUn;
  const margemLiqUn = ticketMedio - cpdMedio;
  const margemLiqTotal = margemLiqUn * vendas;
  const margemLiqPct = ticketMedio > 0 ? (margemLiqUn / ticketMedio) * 100 : 0;
  const markup = cmcMedio > 0 ? ticketMedio / cmcMedio : 0;

  return {
    ticketMedio,
    cmcMedio,
    freteMedioUn,
    mcTotal,
    mcPct,
    icmsUn,
    pisUn,
    cofinsUn,
    comissaoVarUn,
    comissaoRepUn,
    cpdMedio,
    margemLiqUn,
    margemLiqTotal,
    margemLiqPct,
    markup,
  };
}
