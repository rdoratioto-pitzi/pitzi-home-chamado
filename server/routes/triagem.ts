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

const RS_API_BASE_URL = "https://dash.pitzi.com.br/api";
const RS_API_TOKEN = process.env.RENOVSMART_API_TOKEN || "Renov123";

function buildSearchParams(query: Record<string, unknown>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          params.append(key, String(item));
        }
      });
      return;
    }

    params.append(key, String(value));
  });

  return params;
}

export function registerTriagemRoutes(router: Router) {
  // GET /api/triagem/consulta — proxy para API externa usada no dashboard de triagem
  router.get("/api/triagem/consulta", requireAuth, async (req, res) => {
    try {
      const params = buildSearchParams(req.query as Record<string, unknown>);
      const url = `${RS_API_BASE_URL}/triagem/consulta${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      const raw = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: raw || `Falha ao consultar triagem externa (${response.status})`,
        });
      }

      if (!raw) {
        return res.json([]);
      }

      try {
        return res.json(JSON.parse(raw));
      } catch {
        return res.status(502).json({
          success: false,
          error: "Resposta inválida da API externa de triagem (não-JSON).",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Triagem] consulta error:", message);
      return res.status(500).json({ success: false, error: message });
    }
  });

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
