/**
 * Auth Library - Gerenciamento de autenticação com localStorage
 * 
 * Este módulo fornece funções para gerenciar dados de autenticação
 * usando localStorage, permitindo que a sessão seja compartilhada
 * entre múltiplas abas do navegador.
 */

import { type CurrentUser } from "./permissions";

// Chaves do localStorage
const AUTH_TOKEN_KEY = "auth_token";
const USER_DATA_KEY = "user_data";

export interface AuthData {
  token: string;
  user: CurrentUser;
}

/**
 * Salva os dados de autenticação no localStorage
 * @param data - Objeto contendo token e dados do usuário
 */
export function saveAuth(data: AuthData): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
    
    // Dispara evento customizado para notificar outras partes da aplicação
    window.dispatchEvent(new CustomEvent("authChanged", { 
      detail: { type: "login", user: data.user } 
    }));
  } catch (error) {
    console.error("[auth] Erro ao salvar dados de autenticação:", error);
  }
}

/**
 * Recupera o token de autenticação do localStorage
 * @returns O token de autenticação ou null se não existir
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Recupera os dados do usuário do localStorage
 * @returns Os dados do usuário ou null se não existir
 */
export function getAuthUser(): CurrentUser | null {
  try {
    const userStr = localStorage.getItem(USER_DATA_KEY);
    if (!userStr) return null;
    
    const user = JSON.parse(userStr);
    
    // Padroniza verificação de isAdmin
    if (user) {
      const adminValue = user.isAdmin ?? user.is_admin;
      user.isAdmin = adminValue === true || adminValue === 'true' || adminValue === 1;
    }
    
    return user;
  } catch {
    return null;
  }
}

/**
 * Limpa todos os dados de autenticação do localStorage
 */
export function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    
    // Dispara evento customizado para notificar outras partes da aplicação
    window.dispatchEvent(new CustomEvent("authChanged", { 
      detail: { type: "logout" } 
    }));
  } catch (error) {
    console.error("[auth] Erro ao limpar dados de autenticação:", error);
  }
}

/**
 * Verifica se o usuário está autenticado
 * @returns true se houver token e dados do usuário
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null && getAuthUser() !== null;
}

/**
 * Atualiza os dados do usuário no localStorage
 * @param user - Novos dados do usuário
 */
export function updateAuthUser(user: Partial<CurrentUser>): void {
  try {
    const currentUser = getAuthUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...user };
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
      
      window.dispatchEvent(new CustomEvent("authChanged", { 
        detail: { type: "update", user: updatedUser } 
      }));
    }
  } catch (error) {
    console.error("[auth] Erro ao atualizar dados do usuário:", error);
  }
}

/**
 * Migra dados do sessionStorage para localStorage (para compatibilidade)
 * Deve ser chamado uma vez na inicialização da aplicação
 */
export function migrateFromSessionStorage(): void {
  try {
    const sessionUser = sessionStorage.getItem("user");
    const sessionPerms = sessionStorage.getItem("modulePermissions");
    
    if (sessionUser && !getAuthUser()) {
      const user = JSON.parse(sessionUser);
      // Gera um token baseado no ID do usuário (será substituído pelo token real do servidor)
      const tempToken = `session_${user.id}_${Date.now()}`;
      saveAuth({ token: tempToken, user });
      
      // Limpa sessionStorage após migração
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("modulePermissions");
    }
  } catch (error) {
    console.error("[auth] Erro na migração de sessionStorage:", error);
  }
}
