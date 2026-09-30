import type { ModulePermissions } from "./schema";

export type ModulePermissionKey = keyof ModulePermissions;

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
