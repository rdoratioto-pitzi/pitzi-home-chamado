// worker/src/routes/shipments.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import {
  insertShipmentSchema,
  insertShipmentEventSchema,
  insertLogisticOperatorSchema,
  insertCollectionRequestSchema,
  insertLogisticaReversaPedidoSchema,
} from "../../../shared/schema";
import { getCorreiosService } from "../services/correios.service";

const shipments = new Hono<AppEnv>();

// ============== SHIPMENTS ==============

// GET /api/shipments
shipments.get("/api/shipments", async (c) => {
  const storage = getStorage(c.get("db"));
  const result = await storage.getShipments();
  return c.json(result);
});

// GET /api/shipments/:id
shipments.get("/api/shipments/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const shipment = await storage.getShipment(c.req.param("id"));
  if (!shipment) return c.json({ error: "Shipment not found" }, 404);
  return c.json(shipment);
});

// POST /api/shipments
shipments.post("/api/shipments", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const validated = insertShipmentSchema.parse(body);
    const shipment = await storage.createShipment(validated);
    return c.json(shipment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create shipment" }, 400);
  }
});

// PATCH /api/shipments/:id
shipments.patch("/api/shipments/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const partialSchema = insertShipmentSchema.partial();
    const validated = partialSchema.parse(body);
    const shipment = await storage.updateShipment(c.req.param("id"), validated);
    if (!shipment) return c.json({ error: "Shipment not found" }, 404);
    return c.json(shipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update shipment" }, 400);
  }
});

// DELETE /api/shipments/:id (admin)
shipments.delete("/api/shipments/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteShipment(c.req.param("id"));
  if (!deleted) return c.json({ error: "Shipment not found" }, 404);
  return c.body(null, 204);
});

// ============== SHIPMENT EVENTS ==============

// GET /api/shipments/:id/events
shipments.get("/api/shipments/:id/events", async (c) => {
  const storage = getStorage(c.get("db"));
  const events = await storage.getShipmentEvents(c.req.param("id"));
  return c.json(events);
});

// POST /api/shipments/:id/events
shipments.post("/api/shipments/:id/events", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const validated = insertShipmentEventSchema.parse({
      ...body,
      shipmentId: c.req.param("id"),
    });
    const event = await storage.createShipmentEvent(validated);
    return c.json(event, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create event" }, 400);
  }
});

// ============== LOGISTICS DASHBOARD ==============

// GET /api/logistics/dashboard
shipments.get("/api/logistics/dashboard", async (c) => {
  const storage = getStorage(c.get("db"));
  const stats = await storage.getLogisticsDashboardStats();
  return c.json(stats);
});

// ============== LOGISTIC OPERATORS ==============

// GET /api/logistic-operators
shipments.get("/api/logistic-operators", async (c) => {
  const storage = getStorage(c.get("db"));
  const operators = await storage.getLogisticOperators();
  return c.json(operators);
});

// GET /api/logistic-operators/:id
shipments.get("/api/logistic-operators/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const operator = await storage.getLogisticOperator(c.req.param("id"));
  if (!operator) return c.json({ error: "Operator not found" }, 404);
  return c.json(operator);
});

// POST /api/logistic-operators (admin)
shipments.post("/api/logistic-operators", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const validated = insertLogisticOperatorSchema.parse(body);
    const operator = await storage.createLogisticOperator(validated);
    return c.json(operator, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create operator" }, 400);
  }
});

// PATCH /api/logistic-operators/:id (admin)
shipments.patch("/api/logistic-operators/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const partialSchema = insertLogisticOperatorSchema.partial();
    const validated = partialSchema.parse(body);
    const operator = await storage.updateLogisticOperator(c.req.param("id"), validated);
    if (!operator) return c.json({ error: "Operator not found" }, 404);
    return c.json(operator);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update operator" }, 400);
  }
});

// DELETE /api/logistic-operators/:id (admin)
shipments.delete("/api/logistic-operators/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteLogisticOperator(c.req.param("id"));
  if (!deleted) return c.json({ error: "Operator not found" }, 404);
  return c.body(null, 204);
});

// ============== COLLECTION REQUESTS ==============

// GET /api/collection-requests
shipments.get("/api/collection-requests", async (c) => {
  const storage = getStorage(c.get("db"));
  const requests = await storage.getCollectionRequests();
  return c.json(requests);
});

// GET /api/collection-requests/:id
shipments.get("/api/collection-requests/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const request = await storage.getCollectionRequest(c.req.param("id"));
  if (!request) return c.json({ error: "Request not found" }, 404);
  return c.json(request);
});

// POST /api/collection-requests
shipments.post("/api/collection-requests", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const validated = insertCollectionRequestSchema.parse(body);
    const request = await storage.createCollectionRequest(validated);
    return c.json(request, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create request" }, 400);
  }
});

// PATCH /api/collection-requests/:id
shipments.patch("/api/collection-requests/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const partialSchema = insertCollectionRequestSchema.partial();
    const validated = partialSchema.parse(body);
    const request = await storage.updateCollectionRequest(c.req.param("id"), validated);
    if (!request) return c.json({ error: "Request not found" }, 404);
    return c.json(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update request" }, 400);
  }
});

// DELETE /api/collection-requests/:id (admin)
shipments.delete("/api/collection-requests/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteCollectionRequest(c.req.param("id"));
  if (!deleted) return c.json({ error: "Request not found" }, 404);
  return c.body(null, 204);
});

// ============== LOGISTICA REVERSA ==============

// GET /api/logistica-reversa/pedidos
shipments.get("/api/logistica-reversa/pedidos", async (c) => {
  const storage = getStorage(c.get("db"));
  const pedidos = await storage.getLogisticaReversaPedidos();
  return c.json(pedidos);
});

// GET /api/logistica-reversa/pedidos/:id
shipments.get("/api/logistica-reversa/pedidos/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const pedido = await storage.getLogisticaReversaPedido(c.req.param("id"));
  if (!pedido) return c.json({ error: "Pedido not found" }, 404);
  return c.json(pedido);
});

// POST /api/logistica-reversa/solicitar
shipments.post("/api/logistica-reversa/solicitar", async (c) => {
  const storage = getStorage(c.get("db"));
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();

  const {
    tipo: tipoInput,
    codigoServico: servicoInput,
    remetente,
    destinatario,
    observacao,
  } = body;

  const tipo = tipoInput || "A";
  const codigoServico = servicoInput || "03247";

  try {
    const result = await correios.solicitarPostagemReversa({
      codigo_servico: codigoServico,
      destinatario,
      coletas_solicitadas: [
        {
          tipo,
          remetente,
          descricao: observacao || "Logística Reversa - Trade-in",
        },
      ],
    });

    // Save pedido to database if successful
    if (result.resultado_solicitacao?.length > 0) {
      const primeiro = result.resultado_solicitacao[0];
      await storage.createLogisticaReversaPedido({
        numeroPedido: primeiro.numero_coleta || "",
        numeroEtiqueta: primeiro.numero_etiqueta || "",
        tipo,
        codigoServico,
        status: "solicitado",
        remetente: JSON.stringify(remetente),
        destinatario: JSON.stringify(destinatario),
        observacao: observacao || null,
      });
    }

    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao solicitar postagem reversa", details: msg },
      500,
    );
  }
});

// PATCH /api/logistica-reversa/pedidos/:id
shipments.patch("/api/logistica-reversa/pedidos/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  try {
    const partialSchema = insertLogisticaReversaPedidoSchema.partial();
    const validated = partialSchema.parse(body);
    const pedido = await storage.updateLogisticaReversaPedido(c.req.param("id"), validated);
    if (!pedido) return c.json({ error: "Pedido not found" }, 404);
    return c.json(pedido);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update pedido" }, 400);
  }
});

// POST /api/logistica-reversa/cancelar/:id
shipments.post("/api/logistica-reversa/cancelar/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const pedido = await storage.updateLogisticaReversaPedido(c.req.param("id"), { status: "cancelado" });
  if (!pedido) return c.json({ error: "Pedido not found" }, 404);

  await storage.createLogisticaReversaEvento({
    pedidoId: pedido.id,
    status: "cancelado",
    descricao: "Pedido cancelado pelo usuário",
  });

  return c.json({ pedido, success: true });
});

// GET /api/logistica-reversa/pedidos/:id/eventos
shipments.get("/api/logistica-reversa/pedidos/:id/eventos", async (c) => {
  const storage = getStorage(c.get("db"));
  const eventos = await storage.getLogisticaReversaEventos(c.req.param("id"));
  return c.json(eventos);
});

// GET /api/logistica-reversa/stats
shipments.get("/api/logistica-reversa/stats", async (c) => {
  const storage = getStorage(c.get("db"));
  const pedidos = await storage.getLogisticaReversaPedidos();
  const stats = {
    total: pedidos.length,
    pendentes: pedidos.filter((p: any) => p.status === "solicitado" || p.status === "aguardando_postagem").length,
    concluidos: pedidos.filter((p: any) => p.status === "entregue").length,
    cancelados: pedidos.filter((p: any) => p.status === "cancelado").length,
  };
  return c.json(stats);
});

// GET /api/logistica-reversa/servicos
shipments.get("/api/logistica-reversa/servicos", async (c) => {
  return c.json({
    servicos: [
      { codigo: "03301", nome: "PAC Reversa" },
      { codigo: "03247", nome: "SEDEX Reversa" },
    ],
    tipos: [
      { codigo: "A", nome: "Autorização de Postagem" },
      { codigo: "C", nome: "Coleta Domiciliar" },
      { codigo: "CA", nome: "Coleta Simultânea" },
    ],
    embalagens: [
      { codigo: "P", nome: "Pequena", dimensoes: "20x15x10cm", peso: 0.2 },
      { codigo: "M", nome: "Média", dimensoes: "30x25x15cm", peso: 0.4 },
      { codigo: "G", nome: "Grande", dimensoes: "40x30x20cm", peso: 0.6 },
    ],
  });
});

// GET /api/logistica-reversa/check-api-status
shipments.get("/api/logistica-reversa/check-api-status", async (c) => {
  const correios = getCorreiosService(c.env);
  try {
    const status = await correios.checkApi250Status();
    return c.json(status);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao verificar status da API", details: msg },
      500,
    );
  }
});

// ============== RS LOGISTICA API INTEGRATION ==============

const RS_API_BASE_URL = "https://dash.renovsmart.com.br/api";
const RS_API_TOKEN = "Renov123";

// POST /api/integrations/rs-logistica/test-connection (admin)
shipments.post("/api/integrations/rs-logistica/test-connection", requireAdmin, async (c) => {
  try {
    const response = await fetch(`${RS_API_BASE_URL}/logistica/meus_dispositivos?imei=000000000000000`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return c.json({ connected: true, message: "Conexão estabelecida com sucesso" });
    } else {
      return c.json({ connected: false, message: `Erro: ${response.status} ${response.statusText}` });
    }
  } catch (error: any) {
    return c.json({ connected: false, message: error.message || "Falha ao conectar com a API" });
  }
});

// GET /api/integrations/rs-logistica/meus-dispositivos
shipments.get("/api/integrations/rs-logistica/meus-dispositivos", async (c) => {
  const params = new URLSearchParams();
  const queryParams = ["imei", "filiais", "voucher_code", "status"];

  queryParams.forEach((param) => {
    const value = c.req.query(param);
    if (value) params.append(param, value);
  });

  const response = await fetch(`${RS_API_BASE_URL}/logistica/meus_dispositivos?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return c.json(data);
});

// GET /api/integrations/rs-logistica/meus-fechamentos
shipments.get("/api/integrations/rs-logistica/meus-fechamentos", async (c) => {
  const params = new URLSearchParams();
  const queryParams = ["code", "rede", "status"];

  queryParams.forEach((param) => {
    const value = c.req.query(param);
    if (value) params.append(param, value);
  });

  const response = await fetch(`${RS_API_BASE_URL}/logistica/meus-fechamentos?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return c.json(data);
});

// ============== ADMINISTRAÇÃO LOGÍSTICA API INTEGRATION ==============

// POST /api/integrations/adm-logistica/test-connection (admin)
shipments.post("/api/integrations/adm-logistica/test-connection", requireAdmin, async (c) => {
  try {
    const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/coletas?voucher_imei=000000000000000`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return c.json({ connected: true, message: "Conexão estabelecida com sucesso" });
    } else {
      return c.json({ connected: false, message: `Erro: ${response.status} ${response.statusText}` });
    }
  } catch (error: any) {
    return c.json({ connected: false, message: error.message || "Falha ao conectar com a API" });
  }
});

// GET /api/integrations/adm-logistica/coletas
shipments.get("/api/integrations/adm-logistica/coletas", async (c) => {
  const params = new URLSearchParams();
  const queryParams = [
    "voucher_imei", "code", "awb_code", "rede", "operator",
    "req_start", "req_end", "col_start", "col_end", "status", "represados",
  ];
  queryParams.forEach((param) => {
    const value = c.req.query(param);
    if (value) params.append(param, value);
  });

  const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/coletas?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// GET /api/integrations/adm-logistica/coleta-detalhes
shipments.get("/api/integrations/adm-logistica/coleta-detalhes", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Código da coleta é obrigatório" }, 400);
  }

  const [coletaResponse, ordersResponse] = await Promise.all([
    fetch(`${RS_API_BASE_URL}/adm_logistica/coletas?code=${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
    }),
    fetch(`${RS_API_BASE_URL}/orders/advanced?coleta_code=${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
    }),
  ]);

  if (!coletaResponse.ok) throw new Error(`Coletas API error: ${coletaResponse.status}`);

  const coletaData = await coletaResponse.json();
  const coletaItems = Array.isArray(coletaData) ? coletaData : [];

  let orders: any[] = [];
  if (ordersResponse.ok) {
    const ordersData = await ordersResponse.json();
    orders = Array.isArray(ordersData) ? ordersData : [];
  }

  if (coletaItems.length === 0) {
    return c.json({ coleta: null, dispositivos: [] });
  }

  const coleta = coletaItems[0];

  const dispositivos = orders.map((order: any) => ({
    descricao: order["Descrição do dispositivo"] || order["Categoria"] || "Dispositivo",
    imei: order["IMEI / Serial"] || order["IMEI"] || "",
    valor: parseFloat(order["Valor do dispositivo"] || "0") || 0,
    filial: order["Filial"] || "",
    rede: order["Rede"] || "",
    uf: order["UF"] || "",
    categoria: order["Categoria"] || "",
  }));

  const uniqueDevices = dispositivos.filter((d: any, i: number, arr: any[]) => {
    if (!d.imei) return true;
    return arr.findIndex((x: any) => x.imei === d.imei) === i;
  });

  return c.json({
    coleta: {
      codigo: coleta["Código"] || coleta["Codigo"] || code,
      filial: coleta["Filial / Centro de distribuição"] || coleta["Filial / Centro de distribuicao"] || "",
      operador: coleta["Operador logístico"] || coleta["Operador logistico"] || "",
      dataSolicitacao: coleta["Data de solicitação"] || coleta["Data de solicitacao"] || "",
      dataColeta: coleta["Data de coleta"] || "",
      status: coleta["Status"] || "",
      codigoAwb: coleta["Código AWB"] || coleta["Codigo AWB"] || "",
      numPedidos: coleta["Nº de pedidos"] || coleta["N de pedidos"] || 0,
    },
    dispositivos: uniqueDevices,
    totalDispositivos: orders.length,
    dispositivosUnicos: uniqueDevices.length,
  });
});

// GET /api/integrations/adm-logistica/recebimentos
shipments.get("/api/integrations/adm-logistica/recebimentos", async (c) => {
  const params = new URLSearchParams();
  const queryParams = [
    "imei", "serial_number", "categories", "status_recebimento", "redes",
    "voucher_use_start", "voucher_use_end", "col_start", "col_end",
    "receipt_start", "receipt_end", "coleta_code", "awb_code",
  ];
  queryParams.forEach((param) => {
    const value = c.req.query(param);
    if (value) params.append(param, value);
  });

  const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/recebimentos?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// GET /api/integrations/adm-logistica/triagem
shipments.get("/api/integrations/adm-logistica/triagem", async (c) => {
  const params = new URLSearchParams();
  const queryParams = [
    "imei", "serial_number", "categories", "status_recebimento", "redes",
    "responsavel_triagem", "receipt_start", "receipt_end",
    "col_start", "col_end", "triagem_start", "triagem_end",
  ];
  queryParams.forEach((param) => {
    const value = c.req.query(param);
    if (value) params.append(param, value);
  });

  const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/triagem?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// GET /api/integrations/adm-logistica/bloqueados
shipments.get("/api/integrations/adm-logistica/bloqueados", async (c) => {
  const params = new URLSearchParams();
  const queryParams = ["imei", "redes", "date_start", "date_end", "status"];
  queryParams.forEach((param) => {
    const value = c.req.query(param);
    if (value) params.append(param, value);
  });

  const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/bloqueados?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// GET /api/integrations/adm-logistica/manutencao
shipments.get("/api/integrations/adm-logistica/manutencao", async (c) => {
  const params = new URLSearchParams();
  const imei = c.req.query("imei");
  if (imei) params.append("imei", imei);

  const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/manutencao?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// GET /api/integrations/adm-logistica/divergentes
shipments.get("/api/integrations/adm-logistica/divergentes", async (c) => {
  const params = new URLSearchParams();
  const imei = c.req.query("imei");
  if (imei) params.append("imei", imei);

  const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/divergentes?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// ============== CORREIOS LOGISTICA REVERSA ==============

// GET /api/correios/config
shipments.get("/api/correios/config", async (c) => {
  const correios = getCorreiosService(c.env);
  return c.json(correios.getConfig());
});

// POST /api/correios/solicitar-postagem-reversa
shipments.post("/api/correios/solicitar-postagem-reversa", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.solicitarPostagemReversa(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao solicitar postagem reversa", details: msg },
      500,
    );
  }
});

// POST /api/correios/cancelar-pedido
shipments.post("/api/correios/cancelar-pedido", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.cancelarPedido(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao cancelar pedido", details: msg },
      500,
    );
  }
});

// POST /api/correios/acompanhar-pedido
shipments.post("/api/correios/acompanhar-pedido", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.acompanharPedido(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao acompanhar pedido", details: msg },
      500,
    );
  }
});

// POST /api/correios/acompanhar-pedido-por-data
shipments.post("/api/correios/acompanhar-pedido-por-data", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.acompanharPedidoPorData(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao acompanhar pedidos por data", details: msg },
      500,
    );
  }
});

// POST /api/correios/revalidar-prazo
shipments.post("/api/correios/revalidar-prazo", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.revalidarPrazoAutorizacaoPostagem(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao revalidar prazo", details: msg },
      500,
    );
  }
});

// POST /api/correios/solicitar-range
shipments.post("/api/correios/solicitar-range", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.solicitarRange(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao solicitar range", details: msg },
      500,
    );
  }
});

// POST /api/correios/calcular-digito-verificador
shipments.post("/api/correios/calcular-digito-verificador", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.calcularDigitoVerificador(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao calcular dígito verificador", details: msg },
      500,
    );
  }
});

// POST /api/correios/solicitar-postagem-simultanea
shipments.post("/api/correios/solicitar-postagem-simultanea", async (c) => {
  const correios = getCorreiosService(c.env);
  const body = await c.req.json();
  try {
    const result = await correios.solicitarPostagemSimultanea(body);
    return c.json(result);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Erro desconhecido";
    return c.json(
      { error: "Falha ao solicitar postagem simultânea", details: msg },
      500,
    );
  }
});

export { shipments };
