// Campos editáveis dos chamados: Objeto da Requisição (árvore em settings) e campos
// personalizados por grupo. Usado pelo Worker e pelo Express; as regras de formato ficam
// em shared/request-objects.ts e shared/custom-fields.ts.
import type { IStorage } from "../storage";
import type { TicketCustomField } from "../../shared/schema";
import {
  REQUEST_OBJECTS_SETTING_KEY,
  isValidRequestSelection,
  parseRequestObjectTree,
  requestObjectTreeFromSetting,
  requestSelectionChanged,
  type RequestObjectTree,
  type RequestSelection,
} from "../../shared/request-objects";
import { parseCustomFieldDefinition, validateCustomFieldValues } from "../../shared/custom-fields";

type Fail = { ok: false; status: 400 | 404; error: string };

export async function getRequestObjectTree(storage: IStorage): Promise<RequestObjectTree> {
  const setting = await storage.getSetting(REQUEST_OBJECTS_SETTING_KEY);
  return requestObjectTreeFromSetting(setting?.value);
}

export async function saveRequestObjectTree(
  storage: IStorage,
  raw: unknown,
): Promise<{ ok: true; tree: RequestObjectTree } | Fail> {
  let tree;
  try {
    tree = parseRequestObjectTree(raw);
  } catch (e: any) {
    return { ok: false, status: 400, error: e.message };
  }
  await storage.setSetting(REQUEST_OBJECTS_SETTING_KEY, JSON.stringify(tree));
  return { ok: true, tree };
}

/**
 * Confere o Objeto da Requisição de um chamado contra a árvore atual. Na edição (`previous`
 * informado) só valida quando a seleção muda: chamados antigos continuam editáveis mesmo
 * depois de a árvore ser alterada.
 */
export async function checkRequestSelection(
  storage: IStorage,
  selection: RequestSelection,
  previous?: RequestSelection,
): Promise<boolean> {
  if (previous && !requestSelectionChanged(selection, previous)) return true;
  return isValidRequestSelection(selection, await getRequestObjectTree(storage));
}

export async function createCustomField(
  storage: IStorage,
  raw: unknown,
  tenantId: string | null,
): Promise<{ ok: true; field: TicketCustomField } | Fail> {
  let data;
  try {
    data = parseCustomFieldDefinition(raw);
  } catch (e: any) {
    return { ok: false, status: 400, error: e.message };
  }
  if (!(await storage.getActiveSupportGroupByKey(data.groupKey))) {
    return { ok: false, status: 400, error: "Grupo de atendimento inválido" };
  }
  const field = await storage.createTicketCustomField({ ...data, tenantId });
  return { ok: true, field };
}

export async function updateCustomField(
  storage: IStorage,
  id: string,
  raw: unknown,
): Promise<{ ok: true; field: TicketCustomField } | Fail> {
  const current = await storage.getTicketCustomField(id);
  if (!current) return { ok: false, status: 404, error: "Campo não encontrado" };
  let data;
  try {
    data = parseCustomFieldDefinition(raw, {
      groupKey: current.groupKey,
      label: current.label,
      fieldType: current.fieldType as any,
      options: Array.isArray(current.options) ? (current.options as string[]) : [],
      required: current.required,
      active: current.active,
      sortOrder: current.sortOrder,
    });
  } catch (e: any) {
    return { ok: false, status: 400, error: e.message };
  }
  // Os valores já gravados dependem do tipo e do grupo: mudar isso misturaria dados.
  if (data.fieldType !== current.fieldType || data.groupKey !== current.groupKey) {
    return { ok: false, status: 400, error: "Não é possível mudar o tipo ou o grupo de um campo; crie outro" };
  }
  const field = await storage.updateTicketCustomField(id, data);
  if (!field) return { ok: false, status: 404, error: "Campo não encontrado" };
  return { ok: true, field };
}

/**
 * Valores de campos personalizados a gravar no chamado.
 * - Na abertura: `previous` vazio e obrigatórios exigidos.
 * - Na edição: só roda se vieram valores ou se o grupo mudou; obrigatórios só quando o grupo muda.
 * Devolve `values: undefined` quando não há nada a gravar.
 */
export async function resolveCustomFieldValues(
  storage: IStorage,
  {
    incoming,
    groupKey,
    previous,
    groupChanged,
    isCreate,
  }: { incoming: unknown; groupKey: string | null | undefined; previous?: unknown; groupChanged?: boolean; isCreate?: boolean },
): Promise<{ ok: true; values?: Record<string, unknown> } | Fail> {
  if (!isCreate && incoming === undefined && !groupChanged) return { ok: true };
  const fields = await storage.getTicketCustomFields();
  const result = validateCustomFieldValues(incoming, fields, groupKey, {
    previous,
    enforceRequired: isCreate || groupChanged,
  });
  if (!result.ok) return { ok: false, status: 400, error: result.error };
  return { ok: true, values: result.values };
}
