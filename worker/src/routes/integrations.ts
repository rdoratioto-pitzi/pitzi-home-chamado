// worker/src/routes/integrations.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { insertLogisticaReversaEventoSchema } from "../../../shared/schema";

const integrations = new Hono<AppEnv>();

const RS_API_BASE_URL = "https://dash.renovsmart.com.br/api";

function getApiToken(c?: any): string {
  try {
    return c?.env?.RENOVSMART_API_TOKEN || "Renov123";
  } catch {
    return "Renov123";
  }
}

// ============== HELPERS ==============

async function fetchAiEvaluation(endpoint: string, query: Record<string, string | string[] | undefined>, apiToken?: string) {
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
  const token = apiToken || "Renov123";

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
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

async function fetchEstoque(query: Record<string, string | string[] | undefined>, apiToken?: string) {
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
  const token = apiToken || "Renov123";

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
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

async function fetchApoioVendas(
  endpoint: string,
  query: Record<string, string | string[] | undefined>,
  apiToken?: string,
) {
  const params = new URLSearchParams();

  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined && v !== null && v !== "") {
          params.append(key, v);
        }
      });
    } else if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  });

  const url = `${RS_API_BASE_URL}/${endpoint}`;
  const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
  const token = apiToken || "Renov123";

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
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
    const token = getApiToken(c);
    const response = await fetch(
      `${RS_API_BASE_URL}/orders/advanced?imei=000000000000000`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
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
  const token = getApiToken(c);
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
        Authorization: `Bearer ${token}`,
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
    const token = getApiToken(c);
    const data = await fetchAiEvaluation(endpoint, c.req.query() as any, token);
    return c.json(data);
  });
}

integrations.get("/api/avaliacoes-ia/imei", async (c) => {
  const token = getApiToken(c);
  const params = new URLSearchParams();
  const limitDate = c.req.query("limit_date") || new Date().toISOString().slice(0, 10);
  params.append("limit_date", limitDate);

  const imei = c.req.query("imei");
  if (imei) {
    params.append("imei", imei);
  }

  const data = await fetchAiEvaluation("imei", Object.fromEntries(params.entries()) as any, token);
  return c.json(data);
});

// ============== APOIO A VENDAS ==============

integrations.get("/api/apoio-vendas/inicial/opcoes-filtros", async (c) => {
  const token = getApiToken(c);
  const data = await fetchApoioVendas("apoio-vendas/inicial/opcoes-filtros", c.req.query() as any, token);
  return c.json(data);
});

integrations.get("/api/apoio-vendas/inicial/dados", async (c) => {
  const token = getApiToken(c);
  const data = await fetchApoioVendas("apoio-vendas/inicial/dados", c.req.query() as any, token);
  return c.json(data);
});

integrations.get("/api/apoio-gestao/insumos-desempenho-avaliadores", async (c) => {
  const token = getApiToken(c);
  const data = await fetchApoioVendas("apoio-gestao/insumos-desempenho-avaliadores", c.req.query() as any, token);
  return c.json(data);
});

// ============== ESTOQUES ==============

// GET /api/estoques (public)
integrations.get("/api/estoques", async (c) => {
  const token = getApiToken(c);
  const data = await fetchEstoque(c.req.query() as any, token);
  return c.json(data);
});

export { integrations };
