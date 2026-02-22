import { Router } from "express";
import { insertLogisticaReversaEventoSchema } from "@shared/schema";
import { storage } from "../storage";
import { z } from "zod";

export function registerIntegrationRoutes(router: Router) {
  const RS_API_BASE_URL = "https://dash.renovsmart.com.br/api";
  const RS_API_TOKEN = "Renov123";

  // ============== RELATÓRIO PEDIDOS API INTEGRATION ==============

  // Test connection to Relatório Pedidos API
  router.post("/api/integrations/relatorio-pedidos/test-connection", async (req, res) => {
    try {
      const response = await fetch(`${RS_API_BASE_URL}/orders/advanced?imei=000000000000000`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${RS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        res.json({ connected: true, message: "Conexão estabelecida com sucesso" });
      } else {
        res.json({ connected: false, message: `Erro: ${response.status} ${response.statusText}` });
      }
    } catch (error: any) {
      res.json({ connected: false, message: error.message || "Falha ao conectar com a API" });
    }
  });

  // Relatório Pedidos - Consulta Avançada
  router.get("/api/integrations/relatorio-pedidos/orders/advanced", async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["imei", "voucher_code", "voucher_status", "customer_cpf", "created_start", "created_end", "used_start", "used_end", "category", "network", "seller_name", "regional", "filial", "store_type", "boost", "global_status"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });
      const response = await fetch(`${RS_API_BASE_URL}/orders/advanced?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Relatório Pedidos orders/advanced error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar pedidos" });
    }
  });

  // ============== LOGISTICA REVERSA EVENTOS (WEBHOOK) ==============
  router.post("/api/logistica-reversa/eventos", async (req, res) => {
    try {
      // TODO: Adicionar um token de segurança para validar a origem do webhook
      const validated = insertLogisticaReversaEventoSchema.parse(req.body);
      const evento = await storage.createLogisticaReversaEvento(validated);
      res.status(201).json(evento);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error receiving logistica reversa event:", error);
      res.status(400).json({ error: "Failed to process event" });
    }
  });
}
