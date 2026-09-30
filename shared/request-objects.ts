// "Objeto da Requisição" — campo em três níveis copiado do Freshdesk (cf_teste1).
// Objeto → ação → detalhe. Os valores gravados são os próprios rótulos, iguais aos do
// Freshdesk, para facilitar importar o histórico depois. Gerado a partir de
// ~/pitzi-home-chamado-ops/freshdesk/ticket_fields.json; mantenha a ordem do Freshdesk.

export interface RequestAction {
  label: string;
  details: readonly string[];
}

export interface RequestObject {
  label: string;
  actions: readonly RequestAction[];
}

export const REQUEST_OBJECT_LABEL = "Objeto da Requisição";
export const REQUEST_ACTION_LABEL = "Tipo da Requisição";
export const REQUEST_DETAIL_LABEL = "Valor Desejado";

export const REQUEST_OBJECTS: readonly RequestObject[] = [
  {
    label: "Service Requests",
    actions: [
      {
        label: "Alterar Status",
        details: [
          "draft",
          "open",
          "arrived",
          "pending",
          "in_document_analysis",
          "rejected_documents",
          "waiting_payment",
          "in_analysis",
          "screening",
          "swapped",
          "rejected",
          "sent",
          "tracked",
          "closed",
          "lost_in_delivery",
          "expired",
          "cancelled",
        ],
      },
      { label: "Desfazer Troca", details: [] },
      {
        label: "Cancelar",
        details: [
          "1 Sinistro aberto no produto errado",
          "2 Cliente desistiu",
          "5 Duplicidade",
          "4 Vigência Incorreta",
          "3 Outros",
          "6 Reembolso",
          "7 Duplicado",
          "8 Seguradora irá atender",
          "9 Abertura errada de SR",
          "10 Substituição em loja",
        ],
      },
      { label: "Alteração Location", details: [] },
      { label: "Outro", details: [] },
    ],
  },
  {
    label: "Orders",
    actions: [
      { label: "Reativar", details: [] },
      {
        label: "Liberar Abertura de SR",
        details: [
          "Não Reincidente",
          "Reincidemte",
        ],
      },
      { label: "Cancelar", details: [] },
      { label: "Descancelar", details: [] },
      { label: "Emitir Boleto", details: [] },
      { label: "Cobrar order no cartão", details: [] },
      { label: "outro", details: [] },
    ],
  },
  {
    label: "Devices",
    actions: [
      {
        label: "Alterar Location",
        details: [
          "50 Pitzi/Estoque",
          "51 Com cliente",
          "52 Em manutenção",
          "53 Em trânsito",
          "54 Substituído/Baixado",
          "55 Tradein/Sem previsão-No Parceiro",
          "56 Tradein/Entrada-Estoque",
          "57 Tradein/Saída",
          "58 Pitzi/Qualidade",
          "59 Novos Reprovados",
          "60 Reparo Inhouse",
          "61 Pitzi/Estoque de Quebrados",
          "62 Tradein/Sem Previsão de Chegar",
          "63 Novos / DOA",
          "64 Pitzi/Análise",
          "65 Roubo/Furto(Proteção total)",
          "66 Pitzi/Triagem",
          "67 R.I.P/missing",
          "68 Extravio Correios",
          "69 Pitzi/Reincidente",
          "70 Pitzi/Origem Desconhecida",
          "71 Pitzi/Emprestado ao Funcionário",
          "72 Tradein enviado pelo parceiro(Em Trânsito)",
          "73 Tradein/Cancelado",
          "74 Tradein que chegou na pitzi",
          "75 Em situação de acordo",
          "76 Em transferência de unidade",
          "77 Aguardando pagamento",
          "78 Devices que retornaram para a Seguradora",
          "79 Devices Salvados",
          "80 Fábrica de Reparos",
          "81 Desmanche",
          "82 Pitzi/ATOPS",
          "83 Tradein Triagem",
          "84 Tradein Vendas",
          "85 Device novo devolvido",
          "86 Recebimento de device",
        ],
      },
      { label: "Remover Owner", details: [] },
    ],
  },
  {
    label: "Users",
    actions: [
      { label: "Alterar Titularidade", details: [] },
      { label: "Alterar CPF", details: [] },
    ],
  },
  { label: "Outros", actions: [] },
];

/** Chave em `settings` onde fica a árvore editada em Configurações → Campos do chamado. */
export const REQUEST_OBJECTS_SETTING_KEY = "request_objects";

export type RequestObjectTree = readonly RequestObject[];

export function requestActionsFor(
  object: string | null | undefined,
  tree: RequestObjectTree = REQUEST_OBJECTS,
): readonly RequestAction[] {
  return tree.find((o) => o.label === object)?.actions ?? [];
}

export function requestDetailsFor(
  object: string | null | undefined,
  action: string | null | undefined,
  tree: RequestObjectTree = REQUEST_OBJECTS,
): readonly string[] {
  return requestActionsFor(object, tree).find((a) => a.label === action)?.details ?? [];
}

export interface RequestSelection {
  requestObject?: string | null;
  requestAction?: string | null;
  requestDetail?: string | null;
}

/**
 * Confere se a combinação existe na árvore. Tudo vazio é válido (o campo é opcional);
 * um nível só pode vir preenchido se o anterior vier e se ele existir na lista.
 */
export function isValidRequestSelection(
  { requestObject, requestAction, requestDetail }: RequestSelection,
  tree: RequestObjectTree = REQUEST_OBJECTS,
): boolean {
  if (!requestObject) return !requestAction && !requestDetail;
  const object = tree.find((o) => o.label === requestObject);
  if (!object) return false;
  if (!requestAction) return !requestDetail;
  const action = object.actions.find((a) => a.label === requestAction);
  if (!action) return false;
  if (!requestDetail) return true;
  return action.details.includes(requestDetail);
}

/** Troca string vazia por null nos três níveis (os selects mandam "" quando limpos). */
export function normalizeRequestSelection<T extends RequestSelection>(data: T): T {
  for (const key of ["requestObject", "requestAction", "requestDetail"] as const) {
    if (data[key] === "") data[key] = null;
  }
  return data;
}

/** A seleção mudou em relação ao que o chamado já tinha? (valores antigos seguem válidos) */
export function requestSelectionChanged(next: RequestSelection, previous: RequestSelection): boolean {
  return (["requestObject", "requestAction", "requestDetail"] as const).some(
    (k) => (next[k] ?? null) !== (previous[k] ?? null),
  );
}

const MAX_LABEL = 120;
const MAX_ITEMS = 500;

function cleanLabels(raw: unknown, where: string): string[] {
  if (!Array.isArray(raw)) throw new Error(`${where}: lista inválida`);
  if (raw.length > MAX_ITEMS) throw new Error(`${where}: itens demais`);
  const seen = new Set<string>();
  return raw.map((item) => {
    if (typeof item !== "string") throw new Error(`${where}: valor inválido`);
    const label = item.trim();
    if (!label) throw new Error(`${where}: há um item sem nome`);
    if (label.length > MAX_LABEL) throw new Error(`${where}: "${label.slice(0, 30)}…" é longo demais`);
    if (seen.has(label)) throw new Error(`${where}: "${label}" está repetido`);
    seen.add(label);
    return label;
  });
}

/**
 * Valida e normaliza uma árvore vinda da tela (ou do banco): nomes sem espaços nas pontas,
 * não vazios e sem repetição dentro do mesmo nível. Lança Error com a mensagem para o usuário.
 */
export function parseRequestObjectTree(raw: unknown): RequestObject[] {
  if (!Array.isArray(raw)) throw new Error("A lista de objetos é inválida");
  const objectLabels = cleanLabels(raw.map((o: any) => o?.label), "Objetos");
  return raw.map((o: any, i) => {
    const actions = Array.isArray(o?.actions) ? o.actions : [];
    const actionLabels = cleanLabels(actions.map((a: any) => a?.label), `Ações de "${objectLabels[i]}"`);
    return {
      label: objectLabels[i],
      actions: actions.map((a: any, j: number) => ({
        label: actionLabels[j],
        details: cleanLabels(Array.isArray(a?.details) ? a.details : [], `Valores de "${objectLabels[i]} › ${actionLabels[j]}"`),
      })),
    };
  });
}

/** Árvore gravada em settings; sem registro (ou registro inválido) vale a lista padrão do Freshdesk. */
export function requestObjectTreeFromSetting(value: string | null | undefined): RequestObjectTree {
  if (!value) return REQUEST_OBJECTS;
  try {
    return parseRequestObjectTree(JSON.parse(value));
  } catch {
    return REQUEST_OBJECTS;
  }
}
