import { describe, it, expect } from "vitest";
import {
  fieldsForGroup,
  formatCustomFieldValue,
  parseCustomFieldDefinition,
  validateCustomFieldValues,
} from "./custom-fields";
import {
  REQUEST_OBJECTS,
  isValidRequestSelection,
  parseRequestObjectTree,
  requestObjectTreeFromSetting,
  requestSelectionChanged,
} from "./request-objects";

const FIELDS = [
  { id: "f1", groupKey: "financeiro", label: "Pedido", fieldType: "text", required: true, active: true, sortOrder: 1 },
  { id: "f2", groupKey: "financeiro", label: "Valor", fieldType: "number", required: false, active: true, sortOrder: 2 },
  { id: "f3", groupKey: "financeiro", label: "Loja", fieldType: "select", options: ["SP", "RJ"], required: false, active: true, sortOrder: 0 },
  { id: "f4", groupKey: "financeiro", label: "Antigo", fieldType: "text", required: true, active: false, sortOrder: 3 },
  { id: "f5", groupKey: "logistica", label: "Data", fieldType: "date", required: false, active: true, sortOrder: 0 },
];

describe("campos personalizados", () => {
  it("lista só os ativos do grupo, na ordem", () => {
    expect(fieldsForGroup(FIELDS, "financeiro").map((f) => f.id)).toEqual(["f3", "f1", "f2"]);
    expect(fieldsForGroup(FIELDS, "outro")).toEqual([]);
  });

  it("na abertura exige obrigatórios ativos (desativados não contam)", () => {
    const r = validateCustomFieldValues({ f2: "10" }, FIELDS, "financeiro", { enforceRequired: true });
    expect(r).toEqual({ ok: false, error: 'Preencha o campo "Pedido"' });
    const ok = validateCustomFieldValues({ f1: " 123 ", f2: "10,5", f3: "SP" }, FIELDS, "financeiro", { enforceRequired: true });
    expect(ok).toEqual({ ok: true, values: { f1: "123", f2: 10.5, f3: "SP" } });
  });

  it("confere tipos e opções", () => {
    expect(validateCustomFieldValues({ f2: "abc" }, FIELDS, "financeiro").ok).toBe(false);
    expect(validateCustomFieldValues({ f3: "MG" }, FIELDS, "financeiro").ok).toBe(false);
    expect(validateCustomFieldValues({ f5: "2026-02-30x" }, FIELDS, "logistica").ok).toBe(false);
    expect(validateCustomFieldValues({ f5: "2026-10-01" }, FIELDS, "logistica")).toEqual({ ok: true, values: { f5: "2026-10-01" } });
  });

  it("descarta chaves desconhecidas e de outros grupos, e preserva o que já estava gravado", () => {
    const r = validateCustomFieldValues({ f5: "2026-10-01", hack: "x", f2: "7" }, FIELDS, "financeiro", {
      previous: { f1: "999", f5: "2026-01-01" },
    });
    expect(r).toEqual({ ok: true, values: { f1: "999", f5: "2026-01-01", f2: 7 } });
  });

  it("valor vazio apaga o campo; na edição sem troca de grupo o obrigatório não é exigido", () => {
    const r = validateCustomFieldValues({ f1: "" }, FIELDS, "financeiro", { previous: { f1: "1" } });
    expect(r).toEqual({ ok: true, values: {} });
  });

  it("valida o cadastro do campo", () => {
    expect(() => parseCustomFieldDefinition({ groupKey: "g", label: "", fieldType: "text" })).toThrow("nome");
    expect(() => parseCustomFieldDefinition({ groupKey: "g", label: "X", fieldType: "cor" })).toThrow("Tipo");
    expect(() => parseCustomFieldDefinition({ groupKey: "g", label: "X", fieldType: "select", options: [" ", ""] })).toThrow("opção");
    expect(parseCustomFieldDefinition({ groupKey: " g ", label: " Loja ", fieldType: "select", options: ["A", "A", " B "] }))
      .toMatchObject({ groupKey: "g", label: "Loja", options: ["A", "B"], required: false, active: true });
  });

  it("formata datas para exibição", () => {
    expect(formatCustomFieldValue({ fieldType: "date" }, "2026-10-01")).toBe("01/10/2026");
    expect(formatCustomFieldValue({ fieldType: "text" }, null)).toBe("—");
  });
});

describe("árvore editável do Objeto da Requisição", () => {
  const tree = [{ label: "Pedidos", actions: [{ label: "Cancelar", details: ["Duplicado"] }] }];

  it("valida contra a árvore informada", () => {
    expect(isValidRequestSelection({ requestObject: "Pedidos", requestAction: "Cancelar", requestDetail: "Duplicado" }, tree)).toBe(true);
    expect(isValidRequestSelection({ requestObject: "Users" }, tree)).toBe(false);
    // sem árvore, vale a lista padrão do Freshdesk
    expect(isValidRequestSelection({ requestObject: REQUEST_OBJECTS[0].label })).toBe(true);
  });

  it("normaliza e rejeita nomes vazios ou repetidos", () => {
    expect(parseRequestObjectTree([{ label: " Pedidos ", actions: [{ label: "Cancelar", details: [" a ", "b"] }] }]))
      .toEqual([{ label: "Pedidos", actions: [{ label: "Cancelar", details: ["a", "b"] }] }]);
    expect(() => parseRequestObjectTree([{ label: "A" }, { label: "A" }])).toThrow("repetido");
    expect(() => parseRequestObjectTree([{ label: "A", actions: [{ label: "" }] }])).toThrow("sem nome");
    expect(() => parseRequestObjectTree({})).toThrow();
  });

  it("setting ausente ou inválido cai na lista padrão", () => {
    expect(requestObjectTreeFromSetting(null)).toBe(REQUEST_OBJECTS);
    expect(requestObjectTreeFromSetting("não é json")).toBe(REQUEST_OBJECTS);
    expect(requestObjectTreeFromSetting(JSON.stringify(tree))).toEqual(tree);
  });

  it("detecta se a seleção mudou", () => {
    const old = { requestObject: "Pedidos", requestAction: "Cancelar", requestDetail: null };
    expect(requestSelectionChanged({ ...old }, old)).toBe(false);
    expect(requestSelectionChanged({ ...old, requestDetail: undefined }, old)).toBe(false);
    expect(requestSelectionChanged({ ...old, requestAction: null }, old)).toBe(true);
  });
});
