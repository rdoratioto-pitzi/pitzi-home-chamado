export interface UserPermissions {
  chamados: boolean;
  projetos: boolean;
  tarefas: boolean;
  okrs: boolean;
  logistica: boolean;
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
    return JSON.parse(userStr);
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
    logistica: false,
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
      logistica: true,
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
