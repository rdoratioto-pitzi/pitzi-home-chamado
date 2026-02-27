/**
 * Tipos TypeScript para integração com API Omie (ERP)
 */

export interface OmieConfig {
  id: number;
  app_key: string;
  app_secret: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OmieSyncLog {
  id: number;
  endpoint: string;
  category: 'compras' | 'vendas' | 'financas' | 'geral';
  status: 'success' | 'error';
  total_records: number;
  request_params?: Record<string, any>;
  response_data?: Record<string, any>;
  error_message?: string;
  synced_at: Date;
}

export interface OmieRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
}

export interface OmieResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
}

export interface OmieCallParams {
  endpoint: string;
  call: string;
  params?: any[];
  category?: 'compras' | 'vendas' | 'financas' | 'geral';
}

export interface OmieTestConnectionResponse {
  success: boolean;
  connected: boolean;
  message?: string;
}

export interface OmieConfigResponse {
  success: boolean;
  data?: {
    app_key: string;
    is_active: boolean;
  };
  error?: string;
}

export interface OmieLogsResponse {
  success: boolean;
  data: OmieSyncLog[];
}
