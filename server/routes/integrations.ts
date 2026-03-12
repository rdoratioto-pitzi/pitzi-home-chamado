import { Router } from "express";
import { insertLogisticaReversaEventoSchema } from "@shared/schema";
import { storage } from "../storage";
import { z } from "zod";

export function registerIntegrationRoutes(router: Router) {
  console.log("Registering Integration Routes...");
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

  // ============== AVALIAÇÕES IA INTEGRATION ==============

  // Helper method for AI Evaluation API calls
  const fetchAiEvaluation = async (endpoint: string, query: any) => {
    const params = new URLSearchParams();
    Object.keys(query).forEach(key => {
      const value = query[key];
      if (Array.isArray(value)) {
        value.forEach((v: any) => params.append(key, v as string));
      } else if (value) {
        params.append(key, value as string);
      }
    });
    
    // Assume external API follows similar structure: /avaliacoes-ia/{endpoint}
    // If RS_API_BASE_URL ends with /api, we append /avaliacoes-ia/{endpoint}
    // Result: https://dash.renovsmart.com.br/api/avaliacoes-ia/resumo
    const url = `${RS_API_BASE_URL}/avaliacoes-ia/${endpoint}`;
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    
    console.log(`[BACKEND] Fetching ${endpoint}:`, fullUrl);
    
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RS_API_TOKEN}`,
        "Content-Type": "application/json"
      },
    });

    console.log(`[BACKEND] ${endpoint} response status:`, response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Não autenticado na API externa via backend");
      }
      const text = await response.text();
      console.log(`[BACKEND] ${endpoint} error response:`, text);
      try {
        const json = JSON.parse(text);
        throw new Error(json.message || json.error || `API error: ${response.status}`);
      } catch (e) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    }
    const data = await response.json();
    console.log(`[BACKEND] ${endpoint} response data:`, data);
    return data;
  };

  // 1. Resumo de Assertividade
  router.get("/api/avaliacoes-ia/resumo", async (req, res) => {
    try {
      const data = await fetchAiEvaluation("resumo", req.query);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation resumo error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar resumo" });
    }
  });

  // 2. Evolução Temporal
  router.get("/api/avaliacoes-ia/evolucao", async (req, res) => {
    try {
      const data = await fetchAiEvaluation("evolucao", req.query);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation evolucao error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar evolução" });
    }
  });

  // 2.1. Evolução por Categoria
  router.get("/api/avaliacoes-ia/evolucao-categoria", async (req, res) => {
    try {
      const data = await fetchAiEvaluation("evolucao-categoria", req.query);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation evolucao-categoria error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar evolução por categoria" });
    }
  });

  // 3. Acurácia por Dispositivo
  router.get("/api/avaliacoes-ia/dispositivos", async (req, res) => {
    try {
      const data = await fetchAiEvaluation("dispositivos", req.query);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation dispositivos error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar dispositivos" });
    }
  });

  // 4. Detalhamento de Avaliações
  router.get("/api/avaliacoes-ia/detalhes", async (req, res) => {
    try {
      const data = await fetchAiEvaluation("detalhes", req.query);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation detalhes error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar detalhes" });
    }
  });

  // 5. Acurácia por Categoria
  router.get("/api/avaliacoes-ia/categorias", async (req, res) => {
    try {
      console.log("[API] Calling categorias endpoint with params:", req.query);
      const data = await fetchAiEvaluation("categorias", req.query);
      console.log("[API] categorias response:", data);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation categorias error:", error);
      res.status(500).json({
        error: error.message || "Falha ao buscar categorias",
        details: "Verifique se o endpoint /categorias existe na API externa",
        endpoint: "/avaliacoes-ia/categorias"
      });
    }
  });

  // 6. Assertividade por Foto
  router.get("/api/avaliacoes-ia/assertividade-fotos", async (req, res) => {
    try {
      console.log("[API] Calling assertividade-fotos endpoint with params:", req.query);
      const data = await fetchAiEvaluation("assertividade-fotos", req.query);
      console.log("[API] assertividade-fotos response:", data);
      res.json(data);
    } catch (error: any) {
      console.error("AI Evaluation assertividade-fotos error:", error);
      res.status(500).json({
        error: error.message || "Falha ao buscar assertividade por fotos",
        details: "Verifique se o endpoint /assertividade-fotos existe na API externa",
        endpoint: "/avaliacoes-ia/assertividade-fotos"
      });
    }
  });

  // ============== ESTOQUE API INTEGRATION ==============

  // Helper method for Estoque API calls
  const fetchEstoque = async (query: any) => {
    const params = new URLSearchParams();
    Object.keys(query).forEach(key => {
      const value = query[key];
      if (Array.isArray(value)) {
        value.forEach((v: any) => params.append(key, v as string));
      } else if (value) {
        params.append(key, value as string);
      }
    });
    
    const url = `${RS_API_BASE_URL}/estoques`;
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
    
    console.log(`[BACKEND] Fetching estoques:`, fullUrl);
    
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RS_API_TOKEN}`,
        "Content-Type": "application/json"
      },
    });

    console.log(`[BACKEND] estoques response status:`, response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Não autenticado na API externa via backend");
      }
      if (response.status === 403) {
        throw new Error("Token de acesso inválido");
      }
      const text = await response.text();
      console.log(`[BACKEND] estoques error response:`, text);
      try {
        const json = JSON.parse(text);
        throw new Error(json.message || json.error || `API error: ${response.status}`);
      } catch (e) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    }
    const data = await response.json();
    console.log(`[BACKEND] estoques response data:`, data);
    return data;
  };

  // Get Estoques
  router.get("/api/estoques", async (req, res) => {
    try {
      const data = await fetchEstoque(req.query);
      res.json(data);
    } catch (error: any) {
      console.error("Estoque API error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar estoques" });
    }
  });
}
