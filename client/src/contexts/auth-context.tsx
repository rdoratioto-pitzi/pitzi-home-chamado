import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CurrentUser } from "@/lib/permissions";
import { getStoredToken, clearStoredToken } from "@/lib/queryClient";

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: CurrentUser) => void;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<CurrentUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check session via /api/auth/me
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const token = getStoredToken();
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.user) {
            const u = data.user;
            // Normalize isAdmin
            const adminValue = u.isAdmin ?? u.is_admin;
            u.isAdmin = adminValue === true || adminValue === "true" || adminValue === 1;
            setUser(u);
          }
        }
      } catch {
        // session invalid — stay logged out
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback((u: CurrentUser) => {
    const adminValue = u.isAdmin ?? (u as any).is_admin;
    u.isAdmin = adminValue === true || adminValue === "true" || adminValue === 1;
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — always clear local state
    }
    clearStoredToken();
    setUser(null);
    // Broadcast to other tabs
    try {
      const bc = new BroadcastChannel("renov-auth");
      bc.postMessage({ type: "logout" });
      bc.close();
    } catch {
      // BroadcastChannel not supported — ignore
    }
  }, []);

  const updateUser = useCallback((partial: Partial<CurrentUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
