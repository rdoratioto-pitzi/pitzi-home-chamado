import { describe, expect, it } from "vitest";
import { cronDentroDaJanela } from "./index";

// Horário de Brasília = UTC-3 (sem horário de verão desde 2019).
// Janela do cron: liga 07:59, desliga 23:00.
function utc(h: number, m = 0): number {
  return Date.UTC(2026, 9, 19, h, m, 0); // 2026-10-19
}

describe("cronDentroDaJanela (liga 07:59, desliga 23:00 BRT)", () => {
  it("desliga antes das 07:59", () => {
    expect(cronDentroDaJanela(utc(10, 58))).toBe(false); // 07:58 BRT
    expect(cronDentroDaJanela(utc(6, 0))).toBe(false); // 03:00 BRT
    expect(cronDentroDaJanela(utc(5, 0))).toBe(false); // 02:00 BRT (meio da madrugada)
  });

  it("liga às 07:59 e durante o dia", () => {
    expect(cronDentroDaJanela(utc(10, 59))).toBe(true); // 07:59 BRT
    expect(cronDentroDaJanela(utc(11, 0))).toBe(true); // 08:00 BRT
    expect(cronDentroDaJanela(utc(15, 0))).toBe(true); // 12:00 BRT
    expect(cronDentroDaJanela(utc(1, 59))).toBe(true); // 22:59 BRT
  });

  it("desliga a partir das 23:00", () => {
    expect(cronDentroDaJanela(utc(2, 0))).toBe(false); // 23:00 BRT
    expect(cronDentroDaJanela(utc(2, 30))).toBe(false); // 23:30 BRT
  });
});
