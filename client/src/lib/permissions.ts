export interface UserPermissions {
  chamados: boolean;
  projetos: boolean;
  tarefas: boolean;
  okrs: boolean;
  metas: boolean;
  reunioes: boolean;
  fluxogramas: boolean;
  logistica: boolean;
  triagem: boolean;
  pricing: boolean;
  conhecimento: boolean;
  apis: boolean;
  configuracoes: boolean;
  updates: boolean;
  gitAnalytics: boolean;
  estoques: boolean;
  diagramas: boolean;
  avaliacoes: boolean;
  comercial: boolean;
  apoio_vendas: boolean;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  modulePermissions?: string;
  status?: string;
  tenantId?: string | null;
  perfilAcesso?: string;
  [key: string]: unknown;
}

/**
 * @deprecated Use useAuth().user instead. Will be removed after all callers migrate.
 * Returns null — localStorage/sessionStorage auth was removed in Phase 2A (cookie-based auth).
 */
export function getCurrentUser(): CurrentUser | null {
  return null;
}

export function getUserPermissions(user: CurrentUser | null): UserPermissions {
  const defaultPerms: UserPermissions = {
    chamados: false,
    projetos: false,
    tarefas: false,
    okrs: false,
    metas: false,
    reunioes: false,
    fluxogramas: false,
    logistica: false,
    triagem: false,
    pricing: false,
    conhecimento: false,
    apis: false,
    configuracoes: false,
    updates: false,
    gitAnalytics: false,
    estoques: false,
    diagramas: false,
    avaliacoes: false,
    comercial: false,
    apoio_vendas: false,
  };

  if (!user) return defaultPerms;

  if (user.isAdmin) {
    return {
      chamados: true,
      projetos: true,
      tarefas: true,
      okrs: true,
      metas: true,
      reunioes: true,
      fluxogramas: true,
      logistica: true,
      triagem: true,
      pricing: true,
      conhecimento: true,
      apis: true,
      configuracoes: true,
      updates: true,
      gitAnalytics: true,
      estoques: true,
      diagramas: true,
      avaliacoes: true,
      comercial: true,
      apoio_vendas: true,
    };
  }

  if (!user.modulePermissions) return defaultPerms;

  try {
    const perms = JSON.parse(user.modulePermissions);
    return { ...defaultPerms, ...perms };
  } catch {
    return defaultPerms;
  }
}

/**
 * @deprecated Use useAuth().user with getUserPermissions() instead. Will be removed after all callers migrate.
 */
export function hasModulePermission(moduleKey: keyof UserPermissions): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  
  const perms = getUserPermissions(user);
  return perms[moduleKey] ?? false;
}

export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.isAdmin === true;
}
