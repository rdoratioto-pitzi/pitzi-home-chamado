/**
 * Rotas para módulo de Triagem
 * Agrega dados da API Admin Logística para visualização operacional
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getTriagemResumo,
  getRecebimentos,
  getFilaTriagem,
  getDesvios,
} from "../services/triagem.service";

export function registerTriagemRoutes(router: Router) {
  // GET /api/triagem/resumo — KPIs consolidados
  router.get("/api/triagem/resumo", requireAuth, async (_req, res) => {
    try {
      const resumo = await getTriagemResumo();
      res.json({ success: true, data: resumo });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Triagem] resumo error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/triagem/recebimentos — lista paginada com filtros
  router.get("/api/triagem/recebimentos", requireAuth, async (req, res) => {
    try {
      const { page = "1", limit = "50", imei, categoria, status, rede, dataInicio, dataFim } = req.query;

      const filters: Record<string, string> = {};
      if (imei) filters.imei = String(imei);
      if (categoria) filters.categoria = String(categoria);
      if (status) filters.status = String(status);
      if (rede) filters.rede = String(rede);
      if (dataInicio) filters.dataInicio = String(dataInicio);
      if (dataFim) filters.dataFim = String(dataFim);

      const result = await getRecebimentos(filters, parseInt(String(page)), parseInt(String(limit)));
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Triagem] recebimentos error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/triagem/fila — itens atualmente em triagem
  router.get("/api/triagem/fila", requireAuth, async (_req, res) => {
    try {
      const items = await getFilaTriagem();
      res.json({ success: true, data: items, total: items.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Triagem] fila error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/triagem/desvios — bloqueados + manutenção + divergentes
  router.get("/api/triagem/desvios", requireAuth, async (_req, res) => {
    try {
      const items = await getDesvios();
      res.json({ success: true, data: items, total: items.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Triagem] desvios error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });
}
