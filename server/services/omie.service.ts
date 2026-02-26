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
      const result = await pool?.query(
        'SELECT * FROM omie_config WHERE is_active = true LIMIT 1'
      );
      return result?.rows[0] || null;
    } catch (error) {
      console.error('[OmieService] Erro ao buscar config:', error);
      return null;
    }
  }
  
  /**
   * Atualiza as credenciais do Omie
   */
  async updateConfig(app_key: string, app_secret: string): Promise<void> {
    await pool?.query(
      'UPDATE omie_config SET app_key = $1, app_secret = $2, updated_at = NOW() WHERE id = 1',
      [app_key, app_secret]
    );
  }
  
  /**
   * Faz uma chamada à API do Omie
   */
  async callApi(endpoint: string, call: string, params: any[] = []): Promise<any> {
    const config = await this.getConfig();
    if (!config) throw new Error('Omie config not found');
    
    const requestBody: OmieRequest = {
      call,
      app_key: config.app_key,
      app_secret: config.app_secret,
      param: params
    };
    
    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      return response.data;
    } catch (error: any) {
      console.error('[OmieService] Erro na chamada API:', error.response?.data || error.message);
      throw new Error(error.response?.data?.faultstring || error.message);
    }
  }
  
  /**
   * Testa a conexão com a API Omie
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[OmieService] Testing connection...');
      
      const config = await this.getConfig();
      if (!config) {
        console.error('[OmieService] Config not found in database');
        return { success: false, message: 'Configuração não encontrada. Execute a migration.' };
      }

      console.log('[OmieService] Testing connection with app_key:', config.app_key?.substring(0, 5) + '...');

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

      console.log('[OmieService] Request body:', JSON.stringify({
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
          validateStatus: (status) => status < 500
        }
      );

      console.log('[OmieService] Response status:', response.status);
      console.log('[OmieService] Response data:', JSON.stringify(response.data, null, 2));

      // API Omie retorna faultstring em caso de erro SOAP
      if (response.data?.faultstring) {
        console.error('[OmieService] API returned error:', response.data.faultstring);
        return { success: false, message: response.data.faultstring };
      }

      // Se não tem faultstring e recebeu resposta com dados de clientes, a conexão foi bem-sucedida
      if (response.status === 200 && !response.data.faultstring) {
        console.log('[OmieService] Connection successful');
        return { success: true, message: 'Conexão estabelecida com sucesso!' };
      }

      console.error('[OmieService] Unexpected response:', response.data);
      return { success: false, message: 'Resposta inesperada da API Omie' };

    } catch (error: any) {
      console.error('[OmieService] Connection test failed:', error.message);
      console.error('[OmieService] Error details:', error.response?.data);
      
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
    } catch (error) {
      console.error('[OmieService] Erro ao salvar log:', error);
    }
  }
  
  /**
   * Busca logs de sincronização
   */
  async getSyncLogs(category?: string, limit: number = 50): Promise<OmieSyncLog[]> {
    try {
      let query = 'SELECT * FROM omie_sync_log';
      const params: any[] = [];
      
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY synced_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      const result = await pool?.query(query, params);
      return result?.rows || [];
    } catch (error) {
      console.error('[OmieService] Erro ao buscar logs:', error);
      return [];
    }
  }
}

// Instância singleton do serviço
export const omieService = new OmieService();
