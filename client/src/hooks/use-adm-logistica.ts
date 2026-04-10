import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

async function parseApiJsonResponse<T>(res: Response, endpointLabel: string): Promise<T> {
  const raw = await res.text();

  if (!raw) {
    throw new Error(`Resposta vazia em ${endpointLabel}.`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(
      `Resposta inválida em ${endpointLabel}: esperado JSON, recebido: ${preview || "(conteúdo vazio)"}`
    );
  }
}

// Tipos baseados na resposta do endpoint /api/integrations/adm-logistica/dispositivos/aggregates
export interface LogisticaFilters {
  start_date?: string;
  end_date?: string;
  rede?: string;
  filial?: string;
  quinzena?: string;
  quincena?: string;
  status_coleta?: string;
  transportadora?: string;
  responsavel?: string;
  imei?: string;
  voucher?: string;
}

export interface LogisticaMeta {
  total_registros: number;
  total_filtrado: number;
  quinzenas_concluidas?: string[];
  quincenas_concluidas: string[];
}

export interface LogisticaFiltrosDisponiveis {
  redes: string[];
  filiais: string[];
  quinzenas?: string[];
  quincenas: string[];
  status_coleta: string[];
  transportadoras: string[];
  responsaveis: string[];
}

export interface LogisticaDispositivosResponse {
  meta: LogisticaMeta;
  filtros_disponiveis: LogisticaFiltrosDisponiveis;
  tabela_completa: Record<string, unknown>[];
  tabela_qtd: Record<string, unknown>[];
  tabela_valores: Record<string, unknown>[];
  tabela_transportadora: Record<string, unknown>[];
  tabela_sla_transportadora: Record<string, unknown>[];
}

export interface LogisticaColetasFilters {
  start_date?: string;
  end_date?: string;
  receipt_start?: string;
  receipt_end?: string;
  tsp?: string;
  status_controle?: string;
  responsavel?: string;
}

export interface LogisticaColetasMeta {
  total_registros: number;
  total_filtrado: number;
}

export interface LogisticaColetasFiltrosDisponiveis {
  tsp: string[];
  status_controle: string[];
  responsaveis: string[];
}

export interface LogisticaColetasResponse {
  meta: LogisticaColetasMeta;
  filtros_disponiveis: LogisticaColetasFiltrosDisponiveis;
  tabela_completa: Record<string, unknown>[];
}

// Hook para buscar dados agregados de dispositivos
// Usa a rota interna do backend que faz proxy para a API Python
export function useAdmDispositivosAggregates(filters: LogisticaFilters = {}) {
  return useQuery<LogisticaDispositivosResponse>({
    queryKey: ["/api/integrations/adm-logistica/dispositivos/aggregates", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      const quinzenaValue = filters.quinzena || filters.quincena;
      
      // Adiciona filtros como query params
      Object.entries(filters).forEach(([key, value]) => {
        if (key === "quincena" || key === "quinzena") {
          return;
        }
        if (value) {
          params.append(key, value);
        }
      });

      if (quinzenaValue) {
        params.append("quinzena", quinzenaValue);
      }

      const url = `/api/integrations/adm-logistica/dispositivos/aggregates${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return parseApiJsonResponse<LogisticaDispositivosResponse>(res, "Dispositivos Aggregates");
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    retry: 1,
  });
}

// Hook para buscar dados de coletas
export function useAdmColetas(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ["/api/integrations/adm-logistica/coletas", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/coletas${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para buscar dados agregados da aba de Coletas
export function useAdmColetasAggregates(filters: LogisticaColetasFilters = {}) {
  return useQuery<LogisticaColetasResponse>({
    queryKey: ["/api/integrations/adm-logistica/coletas/aggregates", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/coletas/aggregates${params.toString() ? '?' + params.toString() : ''}`;

      const res = await apiRequest("GET", url);
      return parseApiJsonResponse<LogisticaColetasResponse>(res, "Coletas Aggregates");
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// Hook para buscar dados de recebimentos
export function useAdmRecebimentos(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ["/api/integrations/adm-logistica/recebimentos", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/recebimentos${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para buscar dados de triagem
export function useAdmTriagem(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ["/api/integrations/adm-logistica/triagem", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/triagem${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para buscar dados de bloqueados
export function useAdmBloqueados(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ["/api/integrations/adm-logistica/bloqueados", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/bloqueados${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para buscar dados de manutenção
export function useAdmManutencao(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ["/api/integrations/adm-logistica/manutencao", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/manutencao${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para buscar dados de divergentes
export function useAdmDivergentes(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ["/api/integrations/adm-logistica/divergentes", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const url = `/api/integrations/adm-logistica/divergentes${params.toString() ? '?' + params.toString() : ''}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============== CONSULTA AGGREGATES ==============

export interface LogisticaConsultaFilters {
  codigos?: string;  // Lista de IMEIs/Vouchers separados por vírgula
  rede?: string;
}

export interface LogisticaConsultaMeta {
  total_registros: number;
  criterio: string;
}

export interface LogisticaConsultaResultado {
  "Numero do Voucher": string;
  "IMEI": string;
  "Rede": string;
  "Valor do Dispositivo": string;
  "Valor do Voucher": string;
  "Data de Uso": string | null;
  "Data Recebimento": string | null;
  "Triagem": string | null;
  "Situacao do voucher": string;
  "Status do Recebimento": string;
}

export interface LogisticaConsultaResponse {
  meta: LogisticaConsultaMeta;
  tabela_resultado: LogisticaConsultaResultado[];
  mensagem: string;
  error?: string;
}

// Hook para buscar dados agregados da aba de Consulta (Vouchers/IMEIs)
export function useAdmConsultaAggregates(filters: LogisticaConsultaFilters = {}, enabled: boolean = true) {
  return useQuery<LogisticaConsultaResponse>({
    queryKey: ["/api/integrations/adm-logistica/consulta/aggregates", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.codigos) {
        params.append("codigos", filters.codigos);
      }
      if (filters.rede) {
        params.append("rede", filters.rede);
      }

      const url = `/api/integrations/adm-logistica/consulta/aggregates${params.toString() ? '?' + params.toString() : ''}`;

      const res = await apiRequest("GET", url);
      return parseApiJsonResponse<LogisticaConsultaResponse>(res, "Consulta Aggregates");
    },
    enabled: enabled && (!!filters.codigos || !!filters.rede),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ============== FECHAMENTOS AGGREGATES ==============

export interface LogisticaFechamentosFilters {
  rede?: string;
  data_corte?: string;
}

export interface LogisticaFechamentosMeta {
  total_registros: number;
}

export interface LogisticaFechamentosResultado {
  [key: string]: string | number | null;
}

export interface LogisticaFechamentosResponse {
  meta: LogisticaFechamentosMeta;
  tabela_resultado: LogisticaFechamentosResultado[];
  mensagem: string;
  error?: string;
}

// Hook para buscar dados agregados da aba de Fechamentos
export function useAdmFechamentosAggregates(
  filters: LogisticaFechamentosFilters = {},
  enabled: boolean = true
) {
  return useQuery<LogisticaFechamentosResponse>({
    queryKey: ["/api/integrations/adm-logistica/fechamentos/aggregates", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.rede) {
        params.append("rede", filters.rede);
      }
      if (filters.data_corte) {
        params.append("data_corte", filters.data_corte);
      }

      const url = `/api/integrations/adm-logistica/fechamentos/aggregates${params.toString() ? '?' + params.toString() : ''}`;

      const res = await apiRequest("GET", url);
      return parseApiJsonResponse<LogisticaFechamentosResponse>(res, "Fechamentos Aggregates");
    },
    enabled: enabled && !!filters.data_corte,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}