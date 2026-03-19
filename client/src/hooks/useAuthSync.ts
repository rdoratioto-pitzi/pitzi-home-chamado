/**
 * useAuthSync — Cross-tab auth sync via BroadcastChannel.
 * Replaces the old localStorage-based storage events.
 */
import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

export function useAuthSync() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const auth = useAuth();

  // Listen for logout from other tabs
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("renov-auth");
      bc.onmessage = (event) => {
        if (event.data?.type === "logout") {
          queryClient.clear();
          if (window.location.pathname !== "/login") {
            setLocation("/login");
          }
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      bc?.close();
    };
  }, [queryClient, setLocation]);

  const logout = useCallback(async () => {
    await auth.logout();
    queryClient.clear();
    setLocation("/login");
  }, [auth, queryClient, setLocation]);

  return {
    logout,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
  };
}
