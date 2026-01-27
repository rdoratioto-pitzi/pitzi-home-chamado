import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  LogisticOperator, 
  CollectionRequest, 
  LogisticaReversaPedido,
  LogisticsDashboardStats 
} from "@shared/schema";

// Dashboard Stats
export function useDashboardStats() {
  return useQuery<LogisticsDashboardStats>({
    queryKey: ["/api/logistics/dashboard"],
  });
}

// Operators
export function useOperators() {
  return useQuery<LogisticOperator[]>({
    queryKey: ["/api/logistic-operators"],
  });
}

export function useCreateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<LogisticOperator>) => {
      const res = await apiRequest("POST", "/api/logistic-operators", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistic-operators"] });
    },
  });
}

export function useUpdateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LogisticOperator> }) => {
      const res = await apiRequest("PATCH", `/api/logistic-operators/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistic-operators"] });
    },
  });
}

export function useDeleteOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/logistic-operators/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistic-operators"] });
    },
  });
}

// Collection Requests
export function useRequests() {
  return useQuery<CollectionRequest[]>({
    queryKey: ["/api/collection-requests"],
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CollectionRequest>) => {
      const res = await apiRequest("POST", "/api/collection-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collection-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/dashboard"] });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CollectionRequest> }) => {
      const res = await apiRequest("PATCH", `/api/collection-requests/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collection-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/dashboard"] });
    },
  });
}

// Logistica Reversa
export function useLogisticaReversaPedidos() {
  return useQuery<LogisticaReversaPedido[]>({
    queryKey: ["/api/logistica-reversa/pedidos"],
  });
}

export function useLogisticaReversaStats() {
  return useQuery<{ total: number; pendentes: number; concluidos: number; cancelados: number }>({
    queryKey: ["/api/logistica-reversa/stats"],
  });
}

export function useLogisticaReversaServicos() {
  return useQuery<{
    servicos: { codigo: string; nome: string }[];
    tipos: { codigo: string; nome: string }[];
    embalagens: { codigo: string; nome: string; dimensoes: string; peso: number }[];
  }>({
    queryKey: ["/api/logistica-reversa/servicos"],
  });
}

export function useSolicitarLogisticaReversa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/logistica-reversa/solicitar", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistica-reversa/pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistica-reversa/stats"] });
    },
  });
}

export function useCancelarLogisticaReversa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/logistica-reversa/cancelar/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistica-reversa/pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistica-reversa/stats"] });
    },
  });
}
