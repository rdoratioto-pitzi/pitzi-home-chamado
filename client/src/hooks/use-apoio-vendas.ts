import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/queryClient";

export interface ApoioVendasFilters {
  dataInicio?: string;
  dataFim?: string;
  mes?: string;
  avaliador?: string;
  rede?: string;
  filial?: string;
}

export interface OpcoesFiltros {
  avaliadores: string[];
  redes: string[];
  filiais: string[];
  meses: number[];
}

export interface AvaliadorGrade {
  grade: string;
  avaliados: number;
  comprados: number;
  conversao: number;
}

export interface AvaliadorData {
  nome: string;
  grades: AvaliadorGrade[];
  totalAvaliados: number;
  totalComprados: number;
  conversaoGeral: number;
}

export interface DadoInicioRaw {
  "Avaliador": string;
  "Grade": string;
  "Situação do voucher": string;
  "Uso de Tag": string;
  "Criado em": string;
  "Mês": number;
  "Nome da rede": string;
  "Nome da filial": string;
  [key: string]: unknown;
}

export interface DadosInicioApiResponse {
  periodo?: Record<string, unknown>;
  filtros?: Record<string, unknown>;
  total_registros?: number;
  dados: DadoInicioRaw[];
}

export interface MovimentoGrade {
  id: string;
  avaliador: string;
  grade: string;
  tipo: string;
  dataCriacao: string;
  dataRecebimento?: string;
  quantidade: number;
}

export interface DadosGestao {
  periodo?: Record<string, unknown>;
  filter_by?: string;
  total_registros?: number;
  total_created?: number;
  total_received?: number;
  dados?: Record<string, unknown>[];
  created?: Record<string, unknown>[];
  received?: Record<string, unknown>[];
}

export function useApoioVendas() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJson = useCallback(async (endpoint: string) => {
    const response = await fetchWithAuth(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }, []);

  const getOpcoesFiltros = useCallback(async (): Promise<OpcoesFiltros> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson("/api/apoio-vendas/inicial/opcoes-filtros");
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast({
        title: "Erro ao carregar opções de filtros",
        description: errorMessage,
        variant: "destructive",
      });
      return { avaliadores: [], redes: [], filiais: [], meses: [] };
    } finally {
      setLoading(false);
    }
  }, [fetchJson, toast]);

  const getDadosInicio = useCallback(async (filters?: ApoioVendasFilters): Promise<DadosInicioApiResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.dataInicio) params.append("data_inicio", filters.dataInicio);
      if (filters?.dataFim) params.append("data_fim", filters.dataFim);
      if (filters?.mes && filters.mes !== "__all__") params.append("mes", filters.mes);
      if (filters?.avaliador && filters.avaliador !== "__all__") params.append("avaliador", filters.avaliador);
      if (filters?.rede && filters.rede !== "__all__") params.append("rede", filters.rede);
      if (filters?.filial && filters.filial !== "__all__") params.append("filial", filters.filial);
      // Garante paridade com a SQL de auditoria: sem exclusões implícitas.
      params.append("remover_reciclagem", "false");
      params.append("remover_sem_avaliador", "false");
      
      const queryString = params.toString();
      const endpoint = queryString 
        ? `/api/apoio-vendas/inicial/dados?${queryString}` 
        : "/api/apoio-vendas/inicial/dados";
      
      const data = await fetchJson(endpoint);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast({
        title: "Erro ao carregar dados",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchJson, toast]);

  const getDadosGestao = useCallback(async (filters?: ApoioVendasFilters & { filtroData?: "criacao" | "recebimento" }): Promise<DadosGestao | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.dataInicio) params.append("data_inicio", filters.dataInicio);
      if (filters?.dataFim) params.append("data_fim", filters.dataFim);
      if (filters?.filtroData === "criacao") params.append("filter_by", "created");
      if (filters?.filtroData === "recebimento") params.append("filter_by", "received");
      
      const queryString = params.toString();
      const endpoint = queryString 
        ? `/api/apoio-gestao/insumos-desempenho-avaliadores?${queryString}` 
        : "/api/apoio-gestao/insumos-desempenho-avaliadores";
      
      const data = await fetchJson(endpoint);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast({
        title: "Erro ao carregar dados de gestão",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchJson, toast]);

  return {
    loading,
    error,
    getOpcoesFiltros,
    getDadosInicio,
    getDadosGestao,
  };
}