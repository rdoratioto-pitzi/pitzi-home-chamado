/**
 * Rotas para integração com API Omie (ERP)
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { omieService } from "../services/omie.service";
import { getCachedPosEstoque } from "../services/estoque-pos.service";

export function registerOmieRoutes(router: Router) {
  
  // GET /api/omie/config - Obter configuração atual
  router.get("/api/omie/config", requireAuth, async (req, res) => {
    try {
      console.log('[OMIE Routes] GET /api/omie/config - Getting config');
      
      const config = await omieService.getConfig();
      if (!config) {
        console.log('[OMIE Routes] Config not found');
        return res.status(404).json({ success: false, error: "Config not found", data: null });
      }
      
      console.log('[OMIE Routes] Config found, app_key:', config.app_key?.substring(0, 5) + '...');
      
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
  router.post("/api/omie/config", requireAuth, async (req, res) => {
    try {
      console.log('[OMIE Routes] POST /api/omie/config - Updating config');
      
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
      console.error('[OMIE Routes] Error updating config:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/test - Testar conexão
  router.post("/api/omie/test", requireAuth, async (req, res) => {
    try {
      console.log('[OMIE Routes] POST /api/omie/test - Testing connection');
      
      const result = await omieService.testConnection();
      
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
  router.get("/api/omie/logs", requireAuth, async (req, res) => {
    try {
      const { category, limit } = req.query;
      const logs = await omieService.getSyncLogs(
        category as string, 
        limit ? parseInt(limit as string, 10) : 50
      );
      
      res.json({ success: true, data: logs });
    } catch (error: any) {
      console.error('[OMIE Routes] Error fetching logs:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/omie/call - Executar chamada direta à API
  router.post("/api/omie/call", requireAuth, async (req, res) => {
    try {
      console.log('[OMIE Routes] POST /api/omie/call - Making API call');
      
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
      
      console.log('[OMIE Routes] API call successful, duration:', duration, 'ms');
      
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
      console.error('[OMIE Routes] API call failed:', error.message);
      
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

  // ─── FINANÇAS ───────────────────────────────────────────────────────────────

  // POST /api/omie/financas/contas-pagar - Listar contas a pagar
  router.post("/api/omie/financas/contas-pagar", requireAuth, async (req, res) => {
    try {
      const { nPagina = 1, nRegPorPagina = 50, dDtVencIni, dDtVencFim, cStatus } = req.body;

      const params: any = { nPagina, nRegPorPagina };
      if (dDtVencIni) params.dDtVencIni = dDtVencIni;
      if (dDtVencFim) params.dDtVencFim = dDtVencFim;
      if (cStatus && cStatus !== 'ALL') params.cStatus = cStatus;

      const data = await omieService.callApi('financas/contapagar/', 'ListarContasPagar', [params]);

      const contas = (data.conta_pagar_cadastro || []).map((c: any) => ({
        codigoLancamento: c.codigo_lancamento_omie,
        numeroDocumento: c.numero_documento_fiscal || c.numero_documento || '-',
        codigoFornecedor: c.codigo_cliente_fornecedor,
        nomeFornecedor: c.nome_fornecedor || null,
        dataVencimento: c.data_vencimento,
        dataPrevisao: c.data_previsao,
        valorDocumento: c.valor_documento || 0,
        valorBaixado: c.valor_baixado || 0,
        saldo: (c.valor_documento || 0) - (c.valor_baixado || 0),
        statusTitulo: c.status_titulo,
      }));

      const totalValor = contas.reduce((s: number, c: any) => s + c.valorDocumento, 0);
      const totalPago = contas.reduce((s: number, c: any) => s + c.valorBaixado, 0);
      const qtdVencidas = contas.filter((c: any) => c.statusTitulo === 'VENCIDO').length;
      const qtdPagas = contas.filter((c: any) => c.statusTitulo === 'PAGO').length;

      res.json({
        sucesso: true,
        pagina: data.nPagina || data.pagina || 1,
        totalPaginas: data.nTotPaginas || data.total_de_paginas || 1,
        totalRegistros: data.nTotRegistros || data.total_de_registros || contas.length,
        resumo: { totalValor, totalPago, saldoAberto: totalValor - totalPago, qtdVencidas, qtdPagas },
        contas,
      });
    } catch (error: any) {
      console.error('[OMIE Routes] Error listing contas a pagar:', error.message);
      res.status(500).json({ sucesso: false, error: error.message });
    }
  });

  // POST /api/omie/financas/contas-receber - Listar contas a receber
  router.post("/api/omie/financas/contas-receber", requireAuth, async (req, res) => {
    try {
      const { nPagina = 1, nRegPorPagina = 50, dDtVencIni, dDtVencFim, cStatus } = req.body;

      const params: any = { nPagina, nRegPorPagina };
      if (dDtVencIni) params.dDtVencIni = dDtVencIni;
      if (dDtVencFim) params.dDtVencFim = dDtVencFim;
      if (cStatus && cStatus !== 'ALL') params.cStatus = cStatus;

      const data = await omieService.callApi('financas/contareceber/', 'ListarContasReceber', [params]);

      const contas = (data.conta_receber_cadastro || []).map((c: any) => ({
        codigoLancamento: c.codigo_lancamento_omie,
        numeroDocumento: c.numero_documento_fiscal || c.numero_documento || '-',
        codigoCliente: c.codigo_cliente_fornecedor,
        nomeCliente: c.nome_cliente || null,
        dataVencimento: c.data_vencimento,
        dataPrevisao: c.data_previsao,
        valorDocumento: c.valor_documento || 0,
        valorBaixado: c.valor_baixado || 0,
        saldo: (c.valor_documento || 0) - (c.valor_baixado || 0),
        statusTitulo: c.status_titulo,
      }));

      const totalValor = contas.reduce((s: number, c: any) => s + c.valorDocumento, 0);
      const totalRecebido = contas.reduce((s: number, c: any) => s + c.valorBaixado, 0);
      const qtdVencidas = contas.filter((c: any) => c.statusTitulo === 'VENCIDO').length;
      const qtdRecebidas = contas.filter((c: any) => c.statusTitulo === 'RECEBIDO').length;

      res.json({
        sucesso: true,
        pagina: data.nPagina || data.pagina || 1,
        totalPaginas: data.nTotPaginas || data.total_de_paginas || 1,
        totalRegistros: data.nTotRegistros || data.total_de_registros || contas.length,
        resumo: { totalValor, totalRecebido, saldoAberto: totalValor - totalRecebido, qtdVencidas, qtdRecebidas },
        contas,
      });
    } catch (error: any) {
      console.error('[OMIE Routes] Error listing contas a receber:', error.message);
      res.status(500).json({ sucesso: false, error: error.message });
    }
  });

  // POST /api/omie/financas/resumo - Resumo financeiro consolidado
  router.post("/api/omie/financas/resumo", requireAuth, async (req, res) => {
    try {
      const data = await omieService.callApi('financas/resumo/', 'ObterResumoFinancas', [{}]);
      res.json({ sucesso: true, resumo: data });
    } catch (error: any) {
      console.error('[OMIE Routes] Error fetching resumo financas:', error.message);
      res.status(500).json({ sucesso: false, error: error.message });
    }
  });

  // ─── ESTOQUE ─────────────────────────────────────────────────────────────────

  // GET /api/omie/estoque/posicao/:codigo - Posição de estoque por código de produto
  router.get("/api/omie/estoque/posicao/:codigo", requireAuth, async (req, res) => {
    try {
      const codigo = String(req.params.codigo);
      console.log(`[OMIE Routes] GET /api/omie/estoque/posicao/${codigo}`);

      const index = await getCachedPosEstoque();
      const entries = index.get(codigo.trim().toUpperCase()) ?? index.get(codigo.trim()) ?? [];

      const totalFisico = entries.reduce((s, e) => s + (e.fisico ?? 0), 0);
      const totalSaldo = entries.reduce((s, e) => s + (e.nSaldo ?? 0), 0);
      const totalReservado = entries.reduce((s, e) => s + (e.reservado ?? 0), 0);

      res.json({
        success: true,
        data: {
          codigo,
          descricao: entries[0]?.cDescricao ?? null,
          totalFisico,
          totalSaldo,
          totalReservado,
          locais: entries,
          fromCache: true,
        }
      });
    } catch (error: any) {
      console.error('[OMIE Routes] Error fetching posicao estoque:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
