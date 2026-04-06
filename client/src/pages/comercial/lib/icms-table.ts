export interface IcmsEntry {
  uf: string;
  aliquota: number | null;
}

export const ICMS_TABLE: Record<string, number | null> = {
  AC: null,
  AL: 1.40,
  AM: 1.40,
  AP: null,
  BA: 1.40,
  CE: 1.40,
  DF: 0.35,
  ES: 0.35,
  GO: 1.40,
  MA: 0.35,
  MG: 0.60,
  MS: 1.05,
  MT: 1.40,
  PA: 0.42,
  PB: 1.40,
  PE: 1.40,
  PI: 1.40,
  PR: 0.60,
  RJ: 0.60,
  RN: 1.40,
  RO: 1.40,
  RR: 1.40,
  RS: 2.40,
  SC: 2.40,
  SE: 1.40,
  SP: 3.60,
  TO: 0.70,
};

const priorityUFs = ["SP", "MG"];
const remainingUFs = Object.keys(ICMS_TABLE)
  .filter((uf) => !priorityUFs.includes(uf))
  .sort();

export const UF_ORDER: string[] = [...priorityUFs, ...remainingUFs];

export const UF_LIST: IcmsEntry[] = UF_ORDER.map((uf) => ({
  uf,
  aliquota: ICMS_TABLE[uf],
}));
