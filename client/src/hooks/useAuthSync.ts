/**
 * useAuthSync Hook - Sincronização de autenticação entre abas
 * 
 * Este hook escuta mudanças no localStorage (via evento 'storage')
 * e sincroniza o estado de autenticação entre todas as abas abertas.
 */

import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  getAuthToken, 
  getAuthUser, 
  clearAuth, 
  migrateFromSessionStorage 
} from "@/lib/auth";

const AUTH_TOKEN_KEY = "auth_token";

interface StorageEventDetail {
  type: "login" | "logout" | "update";
  user?: any;
}

export function useAuthSync() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Função para lidar com mudanças no storage de outras abas
  const handleStorageChange = useCallback((event: StorageEvent) => {
    // Ignora eventos que não são do localStorage ou não são relacionados à auth
    if (!event.key) return;
    
    // Apenas o evento de storage nativo detecta mudanças de outras abas
    if (event.key === AUTH_TOKEN_KEY) {
      const newToken = event.newValue;
      const oldToken = event.oldValue;

      // Token foi adicionado (login em outra aba)
      if (!oldToken && newToken) {
        // Invalida queries para buscar dados atualizados
        queryClient.invalidateQueries();
        // Recarrega a página para garantir que os dados estão sincronizados
        // Apenas se não estiver na página de login
        if (window.location.pathname === "/login") {
          setLocation("/");
        }
        return;
      }

      // Token foi removido (logout em outra aba)
      if (oldToken && !newToken) {
        // Limpa o cache do React Query
        queryClient.clear();
        // Redireciona para login se não estiver lá
        if (window.location.pathname !== "/login") {
          setLocation("/login");
        }
        return;
      }
    }
  }, [queryClient, setLocation]);

  // Função para lidar com eventos customizados (mesma aba)
  const handleAuthChange = useCallback((event: CustomEvent<StorageEventDetail>) => {
    const { type } = event.detail;
    
    if (type === "logout") {
      queryClient.clear();
      if (window.location.pathname !== "/login") {
        setLocation("/login");
      }
    }
  }, [queryClient, setLocation]);

  // Função para verificar autenticação inicial
  const checkInitialAuth = useCallback(() => {
    // Primeiro, tenta migrar dados do sessionStorage (compatibilidade)
    migrateFromSessionStorage();
    
    const token = getAuthToken();
    const user = getAuthUser();
    const currentPath = window.location.pathname;
    
    // Se há token e usuário, está autenticado
    if (token && user) {
      // Se está na página de login, redireciona para home
      if (currentPath === "/login") {
        setLocation("/");
      }
      return true;
    }
    
    // Se não há token e não está na página de login, redireciona
    if (!token && currentPath !== "/login") {
      setLocation("/login");
      return false;
    }
    
    return false;
  }, [setLocation]);

  useEffect(() => {
    // Verifica autenticação inicial
    checkInitialAuth();

    // Escuta mudanças no localStorage de outras abas
    window.addEventListener("storage", handleStorageChange as EventListener);
    
    // Escuta eventos customizados de auth (mesma aba)
    window.addEventListener("authChanged", handleAuthChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange as EventListener);
      window.removeEventListener("authChanged", handleAuthChange as EventListener);
    };
  }, [handleStorageChange, handleAuthChange, checkInitialAuth]);

  // Retorna função para logout manual
  const logout = useCallback(async () => {
    try {
      // Chama a API de logout
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("[authSync] Erro ao fazer logout:", error);
    } finally {
      // Limpa dados locais independentemente do resultado da API
      clearAuth();
      queryClient.clear();
      setLocation("/login");
    }
  }, [queryClient, setLocation]);

  return {
    logout,
    isAuthenticated: () => getAuthToken() !== null && getAuthUser() !== null,
    user: getAuthUser(),
  };
}
