/**
 * Serviço de integração com API Omie (ERP)
 */
import axios from 'axios';
import { pool } from '../db';
import { OmieConfig, OmieSyncLog, OmieRequest } from '../types/omie.types';

export class OmieService {
  private baseUrl = 'https://app.omie.com.br/api/v1/';
  
  /**
   * Obtém a configuração ativa do Omie
   */
  async getConfig(): Promise<OmieConfig | null> {
    try {
      console.log('[OMIE Service] Loading config from database...');
      const result = await pool?.query(
        'SELECT * FROM omie_config WHERE is_active = true LIMIT 1'
      );
      
      if (!result?.rows[0]) {
        console.error('[OMIE Service] No config found in database');
        return null;
      }
      
      console.log('[OMIE Service] Config loaded successfully');
      console.log('[OMIE Service] App key present:', !!result.rows[0].app_key);
      console.log('[OMIE Service] App secret present:', !!result.rows[0].app_secret);
      
      return result.rows[0];
    } catch (error: any) {
      console.error('[OMIE Service] Error loading config:', error.message);
      return null;
    }
  }
  
  /**
   * Atualiza as credenciais do Omie
   */
  async updateConfig(app_key: string, app_secret: string): Promise<void> {
    console.log('[OMIE Service] Updating config...');
    console.log('[OMIE Service] New app_key:', app_key.substring(0, 5) + '...');
    console.log('[OMIE Service] App secret length:', app_secret.length);
    
    // Verificar se já existe configuração
    const existingConfig = await pool?.query('SELECT id FROM omie_config LIMIT 1');
    
    if (existingConfig?.rows && existingConfig.rows.length > 0) {
      console.log('[OMIE Service] Updating existing config, id:', existingConfig.rows[0].id);
      await pool?.query(
        'UPDATE omie_config SET app_key = $1, app_secret = $2, is_active = true, updated_at = NOW() WHERE id = $3',
        [app_key, app_secret, existingConfig.rows[0].id]
      );
    } else {
      console.log('[OMIE Service] No existing config, inserting new...');
      await pool?.query(
        'INSERT INTO omie_config (app_key, app_secret, is_active) VALUES ($1, $2, $3)',
        [app_key, app_secret, true]
      );
    }
    
    console.log('[OMIE Service] Config updated successfully');
  }
  
  /**
   * Faz uma chamada à API do Omie
   */
  async callApi(endpoint: string, call: string, params: any[] = []): Promise<any> {
    console.log('[OMIE Service] =======================================');
    console.log('[OMIE Service] Starting API call...');
    console.log('[OMIE Service] Endpoint:', endpoint);
    console.log('[OMIE Service] Call:', call);
    console.log('[OMIE Service] Params:', JSON.stringify(params, null, 2));
    
    const config = await this.getConfig();
    if (!config) {
      console.error('[OMIE Service] Config not found - cannot make API call');
      throw new Error('Omie config not found. Please configure API credentials first.');
    }
    
    console.log('[OMIE Service] Config loaded, app_key:', config.app_key.substring(0, 5) + '...');
    
    const requestBody: OmieRequest = {
      call,
      app_key: config.app_key,
      app_secret: config.app_secret,
      param: params
    };
    
    const fullUrl = `${this.baseUrl}${endpoint}`;
    
    console.log('[OMIE Service] Full URL:', fullUrl);
    console.log('[OMIE Service] Request body:', JSON.stringify({
      call: requestBody.call,
      app_key: requestBody.app_key?.substring(0, 5) + '...',
      app_secret: '***',
      param: requestBody.param
    }, null, 2));
    
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[OMIE Service] Sending request to Omie API (attempt ${attempt}/${MAX_RETRIES})...`);
        const startTime = Date.now();

        // Accept all HTTP status codes so we can always inspect the response body
        const response = await axios.post(fullUrl, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
          validateStatus: () => true
        });

        const duration = Date.now() - startTime;

        console.log('[OMIE Service] Response received:');
        console.log('- Status:', response.status);
        console.log('- Duration:', duration, 'ms');
        console.log('- Data type:', typeof response.data);
        console.log('- Data keys:', Object.keys(response.data || {}));
        if (response.status >= 400) {
          console.error('[OMIE Service] Non-2xx response body:', JSON.stringify(response.data));
        }

        // Check for SOAP fault — not retryable (business error)
        if (response.data?.faultstring) {
          console.error('[OMIE Service] API returned fault:', response.data.faultstring);
          throw new Error(response.data.faultstring);
        }

        if (response.data?.error) {
          console.error('[OMIE Service] API returned error:', JSON.stringify(response.data.error));
          throw new Error(response.data.error.message || JSON.stringify(response.data.error));
        }

        if (response.data?.status === 'error') {
          console.error('[OMIE Service] API returned error status:', response.data.message);
          throw new Error(response.data.message || 'API returned error status');
        }

        // Surface any unexpected HTTP error with the actual response body
        if (response.status >= 400) {
          const bodyMsg = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
          console.error(`[OMIE Service] HTTP ${response.status} from Omie:`, bodyMsg);
          throw new Error(`Omie HTTP ${response.status}: ${bodyMsg}`);
        }

        console.log('[OMIE Service] API call successful');
        return response.data;

      } catch (error: any) {
        console.error(`[OMIE Service] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);

        // Network/timeout errors are retryable; business logic errors are not
        const isNetworkError = !error.response && error.request;
        const isRetryable = isNetworkError;

        if (!isRetryable || attempt === MAX_RETRIES) {
          throw new Error(error.message);
        }

        // Exponential backoff before retry: 1s, 2s
        const delay = attempt * 1000;
        console.log(`[OMIE Service] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries reached calling Omie API');
  }
  
  /**
   * Testa a conexão com a API Omie
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[OMIE Service] =======================================');
      console.log('[OMIE Service] Testing connection...');
      
      const config = await this.getConfig();
      if (!config) {
        console.error('[OMIE Service] Config not found in database');
        return { success: false, message: 'Configuração não encontrada. Execute a migration.' };
      }

      console.log('[OMIE Service] Testing connection with app_key:', config.app_key?.substring(0, 5) + '...');

      // Usar método ListarClientes com parâmetros mínimos para testar conexão
      // A API Omie requer parâmetros válidos no campo "param"
      const requestBody = {
        call: 'ListarClientes',
        app_key: config.app_key,
        app_secret: config.app_secret,
        param: [{
          pagina: 1,
          registros_por_pagina: 1
        }]
      };

      console.log('[OMIE Service] Request body:', JSON.stringify({
        call: requestBody.call,
        app_key: requestBody.app_key?.substring(0, 5) + '...',
        app_secret: '***',
        param: requestBody.param
      }, null, 2));

      const response = await axios.post(
        `${this.baseUrl}geral/clientes/`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
          validateStatus: () => true
        }
      );

      console.log('[OMIE Service] Response status:', response.status);
      console.log('[OMIE Service] Response data:', JSON.stringify(response.data, null, 2));

      // API Omie retorna faultstring em caso de erro SOAP
      if (response.data?.faultstring) {
        console.error('[OMIE Service] API returned error:', response.data.faultstring);
        return { success: false, message: response.data.faultstring };
      }

      // Se não tem faultstring e recebeu resposta com dados de clientes, a conexão foi bem-sucedida
      if (response.status === 200 && !response.data.faultstring) {
        console.log('[OMIE Service] Connection successful!');
        return { success: true, message: 'Conexão estabelecida com sucesso!' };
      }

      console.error('[OMIE Service] Unexpected response:', response.data);
      return { success: false, message: 'Resposta inesperada da API Omie' };

    } catch (error: any) {
      console.error('[OMIE Service] =======================================');
      console.error('[OMIE Service] Connection test FAILED:');
      console.error('- Error message:', error.message);
      
      if (error.response?.data) {
        console.error('- Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (error.response?.data?.faultstring) {
        return { success: false, message: error.response.data.faultstring };
      }
      
      return { success: false, message: error.message || 'Erro ao testar conexão' };
    }
  }
  
  /**
   * Registra um log de sincronização
   */
  async logSync(data: Partial<OmieSyncLog>): Promise<void> {
    try {
      console.log('[OMIE Service] Logging sync:', data.endpoint, '-', data.status);
      
      await pool?.query(
        `INSERT INTO omie_sync_log (endpoint, category, status, total_records, request_params, response_data, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.endpoint,
          data.category || 'geral',
          data.status,
          data.total_records || 0,
          JSON.stringify(data.request_params || {}),
          JSON.stringify(data.response_data || {}),
          data.error_message || null
        ]
      );
      
      console.log('[OMIE Service] Sync log saved successfully');
    } catch (error: any) {
      console.error('[OMIE Service] Error saving log:', error.message);
    }
  }
  
  /**
   * Busca logs de sincronização
   */
  async getSyncLogs(category?: string, limit: number = 50): Promise<OmieSyncLog[]> {
    try {
      console.log('[OMIE Service] Fetching sync logs, category:', category, 'limit:', limit);
      
      let query = 'SELECT * FROM omie_sync_log';
      const params: any[] = [];
      
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY synced_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      const result = await pool?.query(query, params);
      console.log('[OMIE Service] Found', result?.rows?.length || 0, 'log entries');
      return result?.rows || [];
    } catch (error: any) {
      console.error('[OMIE Service] Error fetching logs:', error.message);
      return [];
    }
  }
}

// Instância singleton do serviço
export const omieService = new OmieService();
