/**
 * Rotas para integração com API Omie (ERP)
 */
import { Router } from "express";
import { omieService } from "../services/omie.service";

export function registerOmieRoutes(router: Router) {
  
  // GET /api/omie/config - Obter configuração atual
  router.get("/api/omie/config", async (req, res) => {
    try {
      console.log('[OMIE Routes] GET /api/omie/config - Getting config');
      
      const config = await omieService.getConfig();
      if (!config) {
        console.log('[OMIE Routes] Config not found');
        return res.status(404).json({ success: false, error: "Config not found", data: null });
      }
      
      console.log('[OMIE Routes] Config found, app_key:', config.app_key?.substring(0, 5) + '...');
      console.log('[OMIE Routes] app_secret present:', !!config.app_secret);
      
      res.json({
        success: true,
        data: {
          app_key: config.app_key || '',
          app_secret: config.app_secret || '',
          is_active: config.is_active
        }
      });
    } catch (error: any) {
      console.error('[OMIE Routes] Error getting config:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/config - Atualizar configuração
  router.post("/api/omie/config", async (req, res) => {
    try {
      console.log('[OMIE Routes] POST /api/omie/config - Updating config');
      console.log('[OMIE Routes] Request body keys:', Object.keys(req.body));
      
      const { app_key, app_secret } = req.body;
      
      if (!app_key || !app_secret) {
        console.log('[OMIE Routes] Missing credentials');
        return res.status(400).json({ 
          success: false, 
          error: "app_key and app_secret são obrigatórios" 
        });
      }
      
      await omieService.updateConfig(app_key, app_secret);
      res.json({ success: true, message: "Configuração atualizada com sucesso" });
    } catch (error: any) {
      console.error('[OMIE Routes] Error updating config:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/test - Testar conexão
  router.post("/api/omie/test", async (req, res) => {
    try {
      console.log('[OMIE Routes] POST /api/omie/test - Testing connection');
      
      const result = await omieService.testConnection();
      
      console.log('[OMIE Routes] Test result:', result);
      
      res.json({ 
        success: result.success, 
        connected: result.success,
        message: result.message
      });
    } catch (error: any) {
      console.error('[OMIE Routes] Test error:', error.message);
      res.status(500).json({ 
        success: false, 
        connected: false,
        error: error.message 
      });
    }
  });

  // GET /api/omie/logs - Obter logs de sincronização
  router.get("/api/omie/logs", async (req, res) => {
    try {
      console.log('[OMIE Routes] GET /api/omie/logs - Fetching logs');
      
      const { category, limit } = req.query;
      const logs = await omieService.getSyncLogs(
        category as string, 
        limit ? parseInt(limit as string, 10) : 50
      );
      
      console.log('[OMIE Routes] Found', logs.length, 'logs');
      res.json({ success: true, data: logs });
    } catch (error: any) {
      console.error('[OMIE Routes] Error fetching logs:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/call - Executar chamada direta à API
  router.post("/api/omie/call", async (req, res) => {
    try {
      console.log('[OMIE Routes] =======================================');
      console.log('[OMIE Routes] POST /api/omie/call - Making API call');
      console.log('[OMIE Routes] Request body:', JSON.stringify(req.body, null, 2));
      
      const { endpoint, call, params, category } = req.body;
      
      if (!endpoint || !call) {
        console.log('[OMIE Routes] Missing required fields');
        return res.status(400).json({ 
          success: false, 
          error: "endpoint e call são obrigatórios" 
        });
      }
      
      console.log('[OMIE Routes] Calling endpoint:', endpoint);
      console.log('[OMIE Routes] Calling method:', call);
      
      const startTime = Date.now();
      const data = await omieService.callApi(endpoint, call, params || []);
      const duration = Date.now() - startTime;
      
      console.log('[OMIE Routes] API call successful');
      console.log('[OMIE Routes] Duration:', duration, 'ms');
      console.log('[OMIE Routes] Response type:', typeof data);
      console.log('[OMIE Routes] Response keys:', Object.keys(data || {}));
      
      // Log de sucesso
      await omieService.logSync({
        endpoint: `${endpoint}/${call}`,
        category: category || 'geral',
        status: 'success',
        total_records: Array.isArray(data) ? data.length : (data?.total_de_registros || 1),
        request_params: { endpoint, call, params },
        response_data: data
      });
      
      res.json({ success: true, data, duration });
    } catch (error: any) {
      console.error('[OMIE Routes] =======================================');
      console.error('[OMIE Routes] API call FAILED:');
      console.error('[OMIE Routes] Error:', error.message);
      console.error('[OMIE Routes] Stack:', error.stack);
      
      // Log de erro
      await omieService.logSync({
        endpoint: `${req.body.endpoint}/${req.body.call}`,
        category: req.body.category || 'geral',
        status: 'error',
        error_message: error.message,
        request_params: req.body
      });
      
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
