/**
 * Rotas para integração com API Omie (ERP)
 */
import { Router } from "express";
import { omieService } from "../services/omie.service";

export function registerOmieRoutes(router: Router) {
  
  // GET /api/omie/config - Obter configuração atual
  router.get("/api/omie/config", async (req, res) => {
    try {
      const config = await omieService.getConfig();
      if (!config) {
        return res.status(404).json({ success: false, error: "Config not found" });
      }
      
      res.json({
        success: true,
        data: {
          app_key: config.app_key,
          is_active: config.is_active
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/config - Atualizar configuração
  router.post("/api/omie/config", async (req, res) => {
    try {
      const { app_key, app_secret } = req.body;
      
      if (!app_key || !app_secret) {
        return res.status(400).json({ 
          success: false, 
          error: "app_key and app_secret são obrigatórios" 
        });
      }
      
      await omieService.updateConfig(app_key, app_secret);
      res.json({ success: true, message: "Configuração atualizada com sucesso" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/test - Testar conexão
  router.post("/api/omie/test", async (req, res) => {
    try {
      console.log('[Omie Routes] Testing connection...');
      
      const result = await omieService.testConnection();
      
      console.log('[Omie Routes] Test result:', result);
      
      res.json({ 
        success: true, 
        connected: result.success,
        message: result.message
      });
    } catch (error: any) {
      console.error('[Omie Routes] Test error:', error.message);
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
      const { category, limit } = req.query;
      const logs = await omieService.getSyncLogs(
        category as string, 
        limit ? parseInt(limit as string, 10) : 50
      );
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/call - Executar chamada direta à API
  router.post("/api/omie/call", async (req, res) => {
    try {
      const { endpoint, call, params, category } = req.body;
      
      if (!endpoint || !call) {
        return res.status(400).json({ 
          success: false, 
          error: "endpoint e call são obrigatórios" 
        });
      }
      
      const startTime = Date.now();
      const data = await omieService.callApi(endpoint, call, params || []);
      const duration = Date.now() - startTime;
      
      // Log de sucesso
      await omieService.logSync({
        endpoint: `${endpoint}/${call}`,
        category: category || 'geral',
        status: 'success',
        total_records: Array.isArray(data) ? data.length : 1,
        request_params: { endpoint, call, params },
        response_data: data
      });
      
      res.json({ success: true, data, duration });
    } catch (error: any) {
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
