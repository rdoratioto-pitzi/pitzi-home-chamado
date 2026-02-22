import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PromptLibrary, PromptUserFavorite } from "@shared/schema";

const PROMPTS_QUERY_KEY = "prompts";
const FAVORITES_QUERY_KEY = "promptFavorites";

// Listar todos os prompts
export function usePrompts(filters?: { category?: string; search?: string }) {
  return useQuery({
    queryKey: [PROMPTS_QUERY_KEY, filters],
    queryFn: async (): Promise<PromptLibrary[]> => {
      const params = new URLSearchParams();
      if (filters?.category) params.append("category", filters.category);
      if (filters?.search) params.append("search", filters.search);
      
      const res = await fetch(`/api/prompts?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar prompts");
      return res.json();
    },
  });
}

// Estatísticas dos prompts
export function usePromptStats() {
  return useQuery({
    queryKey: [PROMPTS_QUERY_KEY, "stats"],
    queryFn: async () => {
      const res = await fetch("/api/prompts/stats", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar estatísticas");
      return res.json() as Promise<{ total: number; byCategory: Record<string, number> }>;
    },
  });
}

// Obter um prompt específico
export function usePrompt(id: string) {
  return useQuery({
    queryKey: [PROMPTS_QUERY_KEY, id],
    queryFn: async (): Promise<PromptLibrary> => {
      const res = await fetch(`/api/prompts/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar prompt");
      return res.json();
    },
    enabled: !!id,
  });
}

// Buscar prompt por nome (para comando /prompt)
export function usePromptByName(name: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [PROMPTS_QUERY_KEY, "by-name", name],
    queryFn: async (): Promise<PromptLibrary> => {
      const res = await fetch(`/api/prompts/by-name/${encodeURIComponent(name)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar prompt");
      return res.json();
    },
    enabled: enabled && !!name,
  });
}

// Incrementar uso do prompt
export function useIncrementPromptUsage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/prompts/${id}/use`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROMPTS_QUERY_KEY] });
    },
  });
}

// Favoritos do usuário
export function usePromptFavorites() {
  return useQuery({
    queryKey: [FAVORITES_QUERY_KEY],
    queryFn: async (): Promise<PromptUserFavorite[]> => {
      const res = await fetch("/api/prompts/favorites/me", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar favoritos");
      return res.json();
    },
  });
}

// Adicionar aos favoritos
export function useAddPromptFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (promptId: string) => {
      const res = await apiRequest("POST", `/api/prompts/${promptId}/favorite`);
      return res.json() as Promise<PromptUserFavorite>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FAVORITES_QUERY_KEY] });
    },
  });
}

// Remover dos favoritos
export function useRemovePromptFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (favoriteId: string) => {
      const res = await apiRequest("DELETE", `/api/prompts/favorites/${favoriteId}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FAVORITES_QUERY_KEY] });
    },
  });
}

// Sincronização manual (admin)
export function useSyncPrompts() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prompts/sync");
      return res.json() as Promise<{ success: boolean; created: number; updated: number; errors: number }>;
    },
  });
}

// Traduzir prompt para PT-BR
export function useTranslatePrompt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (promptId: string) => {
      const res = await fetch(`/api/prompts/${promptId}/translate`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao traduzir prompt");
      return res.json() as Promise<{ success: boolean; translatedContent: string; cached: boolean }>;
    },
    onSuccess: (_, promptId) => {
      // Invalidar cache do prompt específico para recarregar com tradução
      queryClient.invalidateQueries({ queryKey: [PROMPTS_QUERY_KEY, promptId] });
      queryClient.invalidateQueries({ queryKey: [PROMPTS_QUERY_KEY] });
    },
  });
}
