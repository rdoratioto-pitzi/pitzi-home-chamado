export function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1; // 1-12
  const year = new Date().getFullYear();
  const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
  return `${year} ${q}`;
}

export function getQuarterOptions(): string[] {
  const year = new Date().getFullYear();
  return [
    `${year - 1} Q3`,
    `${year - 1} Q4`,
    `${year} Q1`,
    `${year} Q2`,
    `${year} Q3`,
    `${year} Q4`,
    `${year + 1} Q1`,
  ];
}
