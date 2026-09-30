// Campos personalizados por grupo de atendimento — regras únicas para Worker, Express e telas.
//
// Cada grupo (support_groups.key = tickets.category) pode ter seus próprios campos, criados em
// Configurações → Campos do chamado. Os valores ficam em tickets.custom_fields (JSON), indexados
// pelo id do campo: renomear um campo não perde os valores já gravados.

export const CUSTOM_FIELD_TYPES = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista de opções" },
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]["value"];

export interface CustomFieldDefinition {
  id: string;
  groupKey: string;
  label: string;
  fieldType: string;
  options?: unknown;
  required?: boolean | null;
  active?: boolean | null;
  sortOrder?: number | null;
}

export type CustomFieldValues = Record<string, string | number | null>;

const MAX_TEXT = 255;
const MAX_TEXTAREA = 5000;
const MAX_LABEL = 80;
const MAX_OPTIONS = 200;

export function isCustomFieldType(value: unknown): value is CustomFieldType {
  return CUSTOM_FIELD_TYPES.some((t) => t.value === value);
}

export function customFieldTypeLabel(value: string): string {
  return CUSTOM_FIELD_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function customFieldOptions(field: Pick<CustomFieldDefinition, "options">): string[] {
  return Array.isArray(field.options) ? field.options.filter((o): o is string => typeof o === "string") : [];
}

/** Campos ativos de um grupo, na ordem definida em Configurações. */
export function fieldsForGroup<T extends CustomFieldDefinition>(fields: readonly T[], groupKey: string | null | undefined): T[] {
  return fields
    .filter((f) => f.groupKey === groupKey && f.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label));
}

/** Converte o JSON gravado no chamado (ou vindo da API) em objeto; qualquer outra coisa vira {}. */
export function parseCustomFieldValues(raw: unknown): CustomFieldValues {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CustomFieldValues;
}

export interface CustomFieldDefinitionInput {
  groupKey: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[];
  required: boolean;
  active: boolean;
  sortOrder: number;
}

/** Valida o cadastro de um campo (criação ou edição parcial). Lança Error com a mensagem para o usuário. */
export function parseCustomFieldDefinition(
  raw: any,
  current?: Partial<CustomFieldDefinitionInput>,
): CustomFieldDefinitionInput {
  const merged = { ...current, ...(raw ?? {}) };
  const groupKey = typeof merged.groupKey === "string" ? merged.groupKey.trim() : "";
  if (!groupKey) throw new Error("Escolha o grupo do campo");
  const label = typeof merged.label === "string" ? merged.label.trim() : "";
  if (!label) throw new Error("Dê um nome ao campo");
  if (label.length > MAX_LABEL) throw new Error("Nome do campo longo demais");
  if (!isCustomFieldType(merged.fieldType)) throw new Error("Tipo de campo inválido");
  let options: string[] = [];
  if (merged.fieldType === "select") {
    const rawOptions: unknown[] = Array.isArray(merged.options) ? merged.options : [];
    const seen = new Set<string>();
    for (const o of rawOptions) {
      if (typeof o !== "string") continue;
      const option = o.trim();
      if (!option || seen.has(option)) continue;
      if (option.length > MAX_TEXT) throw new Error("Opção longa demais");
      seen.add(option);
      options.push(option);
    }
    if (options.length === 0) throw new Error("A lista precisa de pelo menos uma opção");
    if (options.length > MAX_OPTIONS) throw new Error("Opções demais");
  }
  const sortOrder = Number.isFinite(Number(merged.sortOrder)) ? Math.trunc(Number(merged.sortOrder)) : 0;
  return {
    groupKey,
    label,
    fieldType: merged.fieldType,
    options,
    required: merged.required === true,
    active: merged.active !== false,
    sortOrder,
  };
}

function normalizeValue(field: CustomFieldDefinition, raw: unknown): { value: string | number | null; error?: string } {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return { value: null };
  switch (field.fieldType) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      return Number.isFinite(n) ? { value: n } : { value: null, error: `"${field.label}" precisa ser um número` };
    }
    case "date": {
      // aaaa-mm-dd (o <input type="date"> manda assim); aceita também um ISO completo.
      const full = String(raw).trim();
      const s = /^\d{4}-\d{2}-\d{2}T/.test(full) ? full.slice(0, 10) : full;
      const parsed = new Date(`${s}T00:00:00Z`);
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s;
      return valid ? { value: s } : { value: null, error: `"${field.label}" precisa ser uma data` };
    }
    case "select": {
      const s = String(raw);
      return customFieldOptions(field).includes(s)
        ? { value: s }
        : { value: null, error: `"${field.label}": opção inválida` };
    }
    case "textarea": {
      const s = String(raw).trim();
      return s.length <= MAX_TEXTAREA ? { value: s } : { value: null, error: `"${field.label}" é longo demais` };
    }
    default: {
      const s = String(raw).trim();
      return s.length <= MAX_TEXT ? { value: s } : { value: null, error: `"${field.label}" é longo demais` };
    }
  }
}

/**
 * Valida os valores enviados para o grupo do chamado.
 * - `incoming`: valores enviados agora (só as chaves presentes são alteradas).
 * - `previous`: valores já gravados no chamado (preservados quando não enviados).
 * - `enforceRequired`: exige os obrigatórios (na abertura e quando o chamado muda de grupo).
 * Chaves que não são campos ativos do grupo são descartadas; valores de outros grupos ficam
 * guardados em `previous` para não se perderem se o chamado voltar ao grupo antigo.
 */
export function validateCustomFieldValues(
  incoming: unknown,
  fields: readonly CustomFieldDefinition[],
  groupKey: string | null | undefined,
  { previous, enforceRequired = false }: { previous?: unknown; enforceRequired?: boolean } = {},
): { ok: true; values: CustomFieldValues } | { ok: false; error: string } {
  const result: CustomFieldValues = { ...parseCustomFieldValues(previous) };
  const sent = parseCustomFieldValues(incoming);
  for (const field of fieldsForGroup(fields, groupKey)) {
    if (Object.prototype.hasOwnProperty.call(sent, field.id)) {
      const { value, error } = normalizeValue(field, sent[field.id]);
      if (error) return { ok: false, error };
      if (value === null) delete result[field.id];
      else result[field.id] = value;
    }
    if (enforceRequired && field.required && (result[field.id] === undefined || result[field.id] === null)) {
      return { ok: false, error: `Preencha o campo "${field.label}"` };
    }
  }
  return { ok: true, values: result };
}

/** Texto para exibir um valor gravado (datas em dd/mm/aaaa). */
export function formatCustomFieldValue(field: Pick<CustomFieldDefinition, "fieldType">, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.fieldType === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return String(value);
}
