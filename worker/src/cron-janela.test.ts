import { describe, expect, it } from "vitest";
import { cronDentroDaJanela } from "./index";

// Horário de Brasília = UTC-3 (sem horário de verão desde 2019).
// Janela do cron: dias úteis, das 07:00 às 20:00 BRT.
// Outubro de 2026: dia 16 = sexta, 17 = sábado, 18 = domingo, 19 = segunda.
function utc(dia: number, h: number, m = 0): number {
  return Date.UTC(2026, 9, dia, h, m, 0);
}

describe("cronDentroDaJanela (dia útil, 07:00–20:00 BRT)", () => {
  it("desliga antes das 07:00", () => {
    expect(cronDentroDaJanela(utc(19, 9, 59))).toBe(false); // segunda 06:59 BRT
    expect(cronDentroDaJanela(utc(19, 5, 0))).toBe(false); // segunda 02:00 BRT (madrugada)
  });

  it("liga das 07:00 às 19:59", () => {
    expect(cronDentroDaJanela(utc(19, 10, 0))).toBe(true); // segunda 07:00 BRT
    expect(cronDentroDaJanela(utc(19, 15, 0))).toBe(true); // segunda 12:00 BRT
    expect(cronDentroDaJanela(utc(19, 22, 59))).toBe(true); // segunda 19:59 BRT
    expect(cronDentroDaJanela(utc(16, 22, 59))).toBe(true); // sexta 19:59 BRT
  });

  it("desliga a partir das 20:00", () => {
    expect(cronDentroDaJanela(utc(19, 23, 0))).toBe(false); // segunda 20:00 BRT
    expect(cronDentroDaJanela(utc(19, 23, 30))).toBe(false); // segunda 20:30 BRT
  });

  it("não roda no fim de semana", () => {
    expect(cronDentroDaJanela(utc(17, 15, 0))).toBe(false); // sábado 12:00 BRT
    expect(cronDentroDaJanela(utc(18, 15, 0))).toBe(false); // domingo 12:00 BRT
    expect(cronDentroDaJanela(utc(17, 10, 0))).toBe(false); // sábado 07:00 BRT
  });

  it("usa o dia da semana em Brasília, não em UTC", () => {
    // Segunda 02:00 UTC ainda é domingo 23:00 em Brasília.
    expect(cronDentroDaJanela(utc(19, 2, 0))).toBe(false);
    // Sábado 01:00 UTC ainda é sexta 22:00 em Brasília (fora da janela pelo horário).
    expect(cronDentroDaJanela(utc(17, 1, 0))).toBe(false);
  });
});
