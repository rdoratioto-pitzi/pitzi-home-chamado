export interface SimuladorInputs {
  volume: number;
  compraUn: number;
  vendaUn: number;
  frete: number;
  icmsPct: number;
  pisPct: number;
  cofinsPct: number;
  comissaoVarPct: number;
  comissaoRepPct: number;
  markupMeta: number;
}

export interface SimuladorResult {
  compraTotal: number;
  vendaTotal: number;
  freteTotal: number;
  margemContribUn: number;
  margemContribTotal: number;
  icmsUn: number;
  pisUn: number;
  cofinsUn: number;
  impostosUn: number;
  comissaoVarUn: number;
  comissaoVarTotal: number;
  comissaoRepUn: number;
  comissaoRepTotal: number;
  cpd: number;
  margemLiqUn: number;
  margemLiqTotal: number;
  markup: number;
  margemPct: number;
}

export const DEFAULT_INPUTS: SimuladorInputs = {
  volume: 100,
  compraUn: 0,
  vendaUn: 0,
  frete: 0,
  icmsPct: 3.60,
  pisPct: 0.65,
  cofinsPct: 3.00,
  comissaoVarPct: 10,
  comissaoRepPct: 0,
  markupMeta: 1.50,
};

export function calcSimulacao(inputs: SimuladorInputs): SimuladorResult {
  const {
    volume,
    compraUn,
    vendaUn,
    frete,
    icmsPct,
    pisPct,
    cofinsPct,
    comissaoVarPct,
    comissaoRepPct,
  } = inputs;

  const compraTotal = compraUn * volume;
  const vendaTotal = vendaUn * volume;
  const freteTotal = frete * volume;

  const margemContribUn = vendaUn - compraUn;
  const margemContribTotal = margemContribUn * volume;

  const icmsUn = vendaUn * (icmsPct / 100);
  const pisUn = vendaUn * (pisPct / 100);
  const cofinsUn = vendaUn * (cofinsPct / 100);
  const impostosUn = icmsUn + pisUn + cofinsUn;

  const comissaoVarUn = compraUn * (comissaoVarPct / 100);
  const comissaoVarTotal = comissaoVarUn * volume;

  const comissaoRepUn = vendaUn * (comissaoRepPct / 100);
  const comissaoRepTotal = comissaoRepUn * volume;

  const cpd = compraUn + impostosUn + frete + comissaoVarUn + comissaoRepUn;

  const margemLiqUn = vendaUn - cpd;
  const margemLiqTotal = margemLiqUn * volume;

  const markup = compraUn > 0 ? vendaUn / compraUn : 0;
  const margemPct = vendaUn > 0 ? (margemLiqUn / vendaUn) * 100 : 0;

  return {
    compraTotal,
    vendaTotal,
    freteTotal,
    margemContribUn,
    margemContribTotal,
    icmsUn,
    pisUn,
    cofinsUn,
    impostosUn,
    comissaoVarUn,
    comissaoVarTotal,
    comissaoRepUn,
    comissaoRepTotal,
    cpd,
    margemLiqUn,
    margemLiqTotal,
    markup,
    margemPct,
  };
}
