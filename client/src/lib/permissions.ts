export interface UserPermissions {
  chamados: boolean;
  projetos: boolean;
  tarefas: boolean;
  okrs: boolean;
  metas: boolean;
  reunioes: boolean;
  fluxogramas: boolean;
  logistica: boolean;
  pricing: boolean;
  conhecimento: boolean;
  apis: boolean;
  configuracoes: boolean;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  modulePermissions?: string;
  status?: string;
}

export function getCurrentUser(): CurrentUser | null {
  try {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    // Standardize isAdmin check - handle multiple formats
    if (user) {
      // Check for is_admin (snake_case from DB) or isAdmin (camelCase from API)
      const adminValue = user.isAdmin ?? user.is_admin;
      user.isAdmin = adminValue === true || adminValue === 'true' || adminValue === 1;
    }
    return user;
  } catch {
    return null;
  }
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
    pricing: false,
    conhecimento: false,
    apis: false,
    configuracoes: false,
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
      pricing: true,
      conhecimento: true,
      apis: true,
      configuracoes: true,
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
