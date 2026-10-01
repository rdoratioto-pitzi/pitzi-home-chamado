import type { ModulePermissions } from "./schema";

export type ModulePermissionKey = keyof ModulePermissions;

/**
 * Todas as chaves de permissão de módulo que o cadastro guarda. Um cadastro incompleto
 * (ex.: conta criada pelo login com Google, que só tinha "chamados") quebrava o formulário
 * de edição em Configurações; por isso todo usuário é gravado com a lista completa.
 */
export const MODULE_PERMISSION_KEYS = [
  "chamados", "projetos", "tarefas", "reunioes", "okrs", "metas", "fluxogramas", "diagramas",
  "logistica", "triagem", "pricing", "conhecimento", "apis", "configuracoes", "updates",
  "estoques", "avaliacoes", "comercial", "apoio_vendas", "campos_chamado",
] as const;

/** Lista completa: mantém o que já está gravado; o que faltar vale false (chamados: true). */
export function completeModulePermissions(raw: unknown): string {
  const current = parseModulePermissions(raw) as Record<string, unknown>;
  const full: Record<string, boolean> = {};
  for (const key of MODULE_PERMISSION_KEYS) {
    const value = current[key];
    full[key] = typeof value === "boolean" ? value : key === "chamados";
  }
  return JSON.stringify(full);
}

export function parseModulePermissions(raw: unknown): Partial<ModulePermissions> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Partial<ModulePermissions>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<ModulePermissions>) : {};
  } catch {
    return {};
  }
}

export function hasModulePermission(
  user: { isAdmin?: boolean | null; modulePermissions?: unknown } | null | undefined,
  key: ModulePermissionKey,
): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const perms = parseModulePermissions(user.modulePermissions);
  return perms[key] === true;
}

/**
 * Pode mexer em Configurações (campos, Objeto da Requisição, automações, respostas prontas,
 * e-mail). Só administradores: a permissão avulsa "campos_chamado" deixou de valer.
 */
export function canManageTicketFields(
  user: { isAdmin?: boolean | null; modulePermissions?: unknown } | null | undefined,
): boolean {
  return user?.isAdmin === true;
}
