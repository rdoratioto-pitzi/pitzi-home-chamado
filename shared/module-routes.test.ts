import { describe, it, expect } from "vitest";
import { modulesForPath } from "./module-routes";

describe("modulesForPath", () => {
  it("casa o prefixo inteiro, não parte do segmento", () => {
    expect(modulesForPath("/api/estoques")).toEqual(["estoques", "apis"]);
    expect(modulesForPath("/api/estoques/posicao")).toEqual(["estoques", "apis"]);
    expect(modulesForPath("/api/avaliacoes-ia/resumo")).toEqual(["avaliacoes", "apis", "logistica"]);
    expect(modulesForPath("/api/avaliacoes/historico")).toEqual(["avaliacoes"]);
    expect(modulesForPath("/api/estoquesx")).toBeNull();
    expect(modulesForPath("/api/tickets")).toBeNull();
  });
});
