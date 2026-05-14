import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// Global fetch interceptor: prepend API_BASE for all /api/ calls
// so every fetch("/api/...") automatically hits the correct backend
if (API_BASE) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = `${API_BASE}${input}`;
      init = { ...init, credentials: "include" as RequestCredentials };
    }
    return originalFetch.call(this, input, init);
  };
}

// ─── Token sessionStorage (fallback para cookies cross-origin bloqueados) ───
const TOKEN_KEY = "pitzi_access_token";

export function getStoredToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setStoredToken(token: string): void {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearStoredToken(): void {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// ─── Unauthorized handling ───────────────────────────────────────────────────
let _handlingUnauthorized = false;

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.accessToken) {
        setStoredToken(data.accessToken);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Verifica com /api/auth/me antes de redirecionar para /login.
// Evita que um 401 transitório (cookie cross-origin bloqueado, race
// condition) derrube usuários com sessão ainda válida.
function handleUnauthorized() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const loginPath = base + "/login";
  if (window.location.pathname === loginPath || window.location.pathname.endsWith("/login")) return;
  if (_handlingUnauthorized) return;
  _handlingUnauthorized = true;

  fetch(`${API_BASE}/api/auth/me`, {
    credentials: "include",
    headers: authHeaders(),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.user) {
        // Sessão ainda válida — 401 foi transitório, não redirecionar
        _handlingUnauthorized = false;
      } else {
        clearStoredToken();
        window.location.href = loginPath;
      }
    })
    .catch(() => {
      // Falha de rede — não redirecionar
      _handlingUnauthorized = false;
    });
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Wrapper para fetch que envia cookies + Authorization header automaticamente.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

  let response = await fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers,
  });

  // On 401, try refresh token once, then retry
  if (response.status === 401 && !url.includes("/api/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(fullUrl, {
        ...options,
        credentials: "include",
        headers: { ...authHeaders(), ...(options.headers as Record<string, string> || {}) },
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
  }

  return response;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...authHeaders(),
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

  let res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // On 401, try refresh then retry
  if (res.status === 401 && !url.includes("/api/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await fetch(fullUrl, {
        method,
        headers: { ...authHeaders(), ...(data ? { "Content-Type": "application/json" } : {}) },
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

    let res = await fetch(fullUrl, {
      credentials: "include",
      headers: authHeaders(),
    });

    // On 401, try refresh then retry
    if (res.status === 401 && !url.includes("/api/auth/")) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(fullUrl, {
          credentials: "include",
          headers: authHeaders(),
        });
      }
    }

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      handleUnauthorized();
      throw new Error("401: Nao autenticado");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
