// worker/src/routes/integrations.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { insertLogisticaReversaEventoSchema } from "@shared/schema";

const integrations = new Hono<AppEnv>();

const RS_API_BASE_URL = "https://dash.renovsmart.com.br/api";
const RS_API_TOKEN = "Renov123";

// ============== HELPERS ==============

async function fetchAiEvaluation(endpoint: string, query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.append(key, value);
    }
  });

  const url = `${RS_API_BASE_URL}/avaliacoes-ia/${endpoint}`;
  const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Não autenticado na API externa via backend");
    }
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || `API error: ${response.status}`);
    } catch {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  }
  return response.json();
}

async function fetchEstoque(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.append(key, value);
    }
  });

  const url = `${RS_API_BASE_URL}/estoques`;
  const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Não autenticado na API externa via backend");
    if (response.status === 403) throw new Error("Token de acesso inválido");
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || `API error: ${response.status}`);
    } catch {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  }
  return response.json();
}

// ============== RELATÓRIO PEDIDOS ==============

// POST /api/integrations/relatorio-pedidos/test-connection (public)
integrations.post("/api/integrations/relatorio-pedidos/test-connection", async (c) => {
  try {
    const response = await fetch(
      `${RS_API_BASE_URL}/orders/advanced?imei=000000000000000`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (response.ok) {
      return c.json({ connected: true, message: "Conexão estabelecida com sucesso" });
    }
    return c.json({
      connected: false,
      message: `Erro: ${response.status} ${response.statusText}`,
    });
  } catch (error: any) {
    return c.json({
      connected: false,
      message: error.message || "Falha ao conectar com a API",
    });
  }
});

// GET /api/integrations/relatorio-pedidos/orders/advanced (public)
integrations.get("/api/integrations/relatorio-pedidos/orders/advanced", async (c) => {
  const params = new URLSearchParams();
  const queryParams = [
    "imei", "voucher_code", "voucher_status", "customer_cpf",
    "created_start", "created_end", "used_start", "used_end",
    "category", "network", "seller_name", "regional",
    "filial", "store_type", "boost", "global_status",
  ];
  queryParams.forEach((param) => {
    const val = c.req.query(param);
    if (val) params.append(param, val);
  });
  const response = await fetch(
    `${RS_API_BASE_URL}/orders/advanced?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok)
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// ============== LOGÍSTICA REVERSA ==============

// POST /api/logistica-reversa/eventos (public)
integrations.post("/api/logistica-reversa/eventos", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertLogisticaReversaEventoSchema.parse(body);
  const evento = await storage.createLogisticaReversaEvento(validated);
  return c.json(evento, 201);
});

// ============== AVALIAÇÕES IA ==============

const aiEndpoints = [
  "resumo", "evolucao", "evolucao-categoria", "dispositivos",
  "detalhes", "categorias", "assertividade-fotos",
] as const;

for (const endpoint of aiEndpoints) {
  integrations.get(`/api/avaliacoes-ia/${endpoint}`, async (c) => {
    const data = await fetchAiEvaluation(endpoint, c.req.query() as any);
    return c.json(data);
  });
}

// ============== ESTOQUES ==============

// GET /api/estoques (public)
integrations.get("/api/estoques", async (c) => {
  const data = await fetchEstoque(c.req.query() as any);
  return c.json(data);
});

export { integrations };
