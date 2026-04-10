import { Router } from "express";
import { storage } from "../storage";
import * as correiosService from "../correios-service";
import bwipjs from "bwip-js";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { z } from "zod";
import {
  insertShipmentSchema,
  insertShipmentEventSchema,
  insertLogisticOperatorSchema,
  insertCollectionRequestSchema,
  insertLogisticaReversaPedidoSchema,
} from "@shared/schema";

export function registerShipmentRoutes(router: Router) {
  // ============== SHIPMENTS ==============
  router.get("/api/shipments", requireAuth, async (req, res) => {
    const shipments = await storage.getShipments();
    res.json(shipments);
  });

  router.get("/api/shipments/:id", requireAuth, async (req, res) => {
    const shipment = await storage.getShipment(req.params.id as string);
    if (!shipment) return res.status(404).json({ error: "Shipment not found" });
    res.json(shipment);
  });

  router.post("/api/shipments", requireAuth, async (req, res) => {
    try {
      const validated = insertShipmentSchema.parse(req.body);
      const shipment = await storage.createShipment(validated);
      res.status(201).json(shipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create shipment" });
    }
  });

  router.patch("/api/shipments/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertShipmentSchema.partial();
      const validated = partialSchema.parse(req.body);
      const shipment = await storage.updateShipment(req.params.id as string, validated);
      if (!shipment) return res.status(404).json({ error: "Shipment not found" });
      res.json(shipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update shipment" });
    }
  });

  router.delete("/api/shipments/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteShipment(req.params.id as string);
    if (!deleted) return res.status(404).json({ error: "Shipment not found" });
    res.status(204).send();
  });

  // Shipment Events
  router.get("/api/shipments/:id/events", requireAuth, async (req, res) => {
    const events = await storage.getShipmentEvents(req.params.id as string);
    res.json(events);
  });

  router.post("/api/shipments/:id/events", requireAuth, async (req, res) => {
    try {
      const validated = insertShipmentEventSchema.parse({
        ...req.body,
        shipmentId: req.params.id,
      });
      const event = await storage.createShipmentEvent(validated);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create event" });
    }
  });

  // ============== LOGISTICS DASHBOARD ==============
  router.get("/api/logistics/dashboard", requireAuth, async (req, res) => {
    const stats = await storage.getLogisticsDashboardStats();
    res.json(stats);
  });

  // ============== LOGISTIC OPERATORS ==============
  router.get("/api/logistic-operators", requireAuth, async (req, res) => {
    const operators = await storage.getLogisticOperators();
    res.json(operators);
  });

  router.get("/api/logistic-operators/:id", requireAuth, async (req, res) => {
    const operator = await storage.getLogisticOperator(req.params.id as string);
    if (!operator) return res.status(404).json({ error: "Operator not found" });
    res.json(operator);
  });

  router.post("/api/logistic-operators", requireAdmin, async (req, res) => {
    try {
      const validated = insertLogisticOperatorSchema.parse(req.body);
      const operator = await storage.createLogisticOperator(validated);
      res.status(201).json(operator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create operator" });
    }
  });

  router.patch("/api/logistic-operators/:id", requireAdmin, async (req, res) => {
    try {
      const partialSchema = insertLogisticOperatorSchema.partial();
      const validated = partialSchema.parse(req.body);
      const operator = await storage.updateLogisticOperator(req.params.id as string, validated);
      if (!operator) return res.status(404).json({ error: "Operator not found" });
      res.json(operator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update operator" });
    }
  });

  router.delete("/api/logistic-operators/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteLogisticOperator(req.params.id as string);
    if (!deleted) return res.status(404).json({ error: "Operator not found" });
    res.status(204).send();
  });

  // ============== COLLECTION REQUESTS ==============
  router.get("/api/collection-requests", requireAuth, async (req, res) => {
    const requests = await storage.getCollectionRequests();
    res.json(requests);
  });

  router.get("/api/collection-requests/:id", requireAuth, async (req, res) => {
    const request = await storage.getCollectionRequest(req.params.id as string);
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
  });

  router.post("/api/collection-requests", requireAuth, async (req, res) => {
    try {
      const validated = insertCollectionRequestSchema.parse(req.body);
      const request = await storage.createCollectionRequest(validated);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create request" });
    }
  });

  router.patch("/api/collection-requests/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertCollectionRequestSchema.partial();
      const validated = partialSchema.parse(req.body);
      const request = await storage.updateCollectionRequest(req.params.id as string, validated);
      if (!request) return res.status(404).json({ error: "Request not found" });
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update request" });
    }
  });

  router.delete("/api/collection-requests/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteCollectionRequest(req.params.id as string);
    if (!deleted) return res.status(404).json({ error: "Request not found" });
    res.status(204).send();
  });

  // ============== LOGISTICA REVERSA ==============
  router.get("/api/logistica-reversa/pedidos", requireAuth, async (req, res) => {
    const pedidos = await storage.getLogisticaReversaPedidos();
    res.json(pedidos);
  });

  router.get("/api/logistica-reversa/pedidos/:id", requireAuth, async (req, res) => {
    const pedido = await storage.getLogisticaReversaPedido(req.params.id as string);
    if (!pedido) return res.status(404).json({ error: "Pedido not found" });
    res.json(pedido);
  });

  router.post("/api/logistica-reversa/solicitar", requireAuth, async (req, res) => {
    try {
      const { tipo: tipoInput, codigoServico: servicoInput, remetente, destinatario, observacao, tipoEmbalagem } = req.body;

      // Define valores padrão
      const tipo = tipoInput || 'A'; // A = Autorização de Postagem (padrão)
      const codigoServico = servicoInput || '03247'; // SEDEX Reversa (padrão)

      // Chama a API real dos Correios
      console.log('=== Solicitando Logística Reversa nos Correios ===');
      console.log('Tipo:', tipo);
      console.log('Serviço:', codigoServico);
      console.log('Remetente:', remetente?.nome);
      console.log('Destinatário:', destinatario?.nome);

      const correiosParams: correiosService.SolicitarPostagemReversaParams = {
        codigo_servico: codigoServico,
        destinatario: {
          nome: destinatario?.nome || 'RENOV SOLUCOES E SERVICOS LTDA',
          logradouro: destinatario?.logradouro || 'R LUIGI GALVANI',
          numero: destinatario?.numero || '200',
          complemento: destinatario?.complemento,
          bairro: destinatario?.bairro || 'CIDADE MONCOES',
          referencia: destinatario?.referencia,
          cidade: destinatario?.cidade || 'SAO PAULO',
          uf: destinatario?.uf || 'SP',
          cep: (destinatario?.cep || '04575020').replace(/\D/g, ''),
          ddd: destinatario?.ddd,
          telefone: destinatario?.telefone,
          email: destinatario?.email,
          ciencia_conteudo_proibido: 'S',
        },
        ...(tipoEmbalagem ? {
          produto: {
            codigo: tipoEmbalagem,
            tipo: correiosService.getEmbalagemTipo(tipoEmbalagem),
            qtd: 1,
          },
        } : {}),
        coletas_solicitadas: [{
          tipo: tipo as 'A' | 'C' | 'CA',
          remetente: {
            nome: remetente?.nome || '',
            logradouro: remetente?.logradouro || '',
            numero: remetente?.numero || 'S/N',
            complemento: remetente?.complemento,
            bairro: remetente?.bairro || '',
            cidade: remetente?.cidade || '',
            uf: remetente?.uf || '',
            cep: (remetente?.cep || '').replace(/\D/g, ''),
            referencia: remetente?.referencia,
            ddd: remetente?.ddd || '47',
            telefone: remetente?.telefone || '',
            email: remetente?.email || '',
            restricao_anac: 'N',
          },
          obj_col: [{
            item: 1,
            desc: observacao || 'Devolução de produto',
          }],
        }],
      };

      let numeroPedido: string;
      let numeroEtiqueta: string;
      let prazo: string;
      let correiosResponse: correiosService.SolicitarPostagemReversaResponse | null = null;

      try {
        correiosResponse = await correiosService.solicitarPostagemReversa(correiosParams);
        console.log('=== Resposta dos Correios ===');
        console.log('Status:', correiosResponse.status_processamento);
        console.log('Erro:', correiosResponse.cod_erro, correiosResponse.msg_erro);
        console.log('Resultados:', JSON.stringify(correiosResponse.resultado_solicitacao, null, 2));

        // Verifica se houve erro geral (00 e 0 são sucesso)
        const codErroGeral = correiosResponse.cod_erro?.trim();
        if (codErroGeral && codErroGeral !== '0' && codErroGeral !== '00' && codErroGeral !== '') {
          throw new Error(`Correios: ${correiosResponse.msg_erro || correiosResponse.cod_erro}`);
        }

        const resultado = correiosResponse.resultado_solicitacao[0];
        if (!resultado) {
          throw new Error('Correios: Nenhum resultado retornado');
        }

        // Verifica erro no resultado individual (0 e 00 são sucesso)
        const codErroItem = resultado.codigo_erro?.toString().trim();
        if (codErroItem && codErroItem !== '0' && codErroItem !== '00' && codErroItem !== '') {
          throw new Error(`Correios: ${resultado.descricao_erro || resultado.codigo_erro}`);
        }

        // Usa os valores reais retornados pelos Correios
        numeroPedido = resultado.numero_coleta || `LR${Date.now()}`;
        numeroEtiqueta = resultado.numero_etiqueta || '';
        prazo = resultado.prazo || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

        console.log('Número do Pedido:', numeroPedido);
        console.log('Número da Etiqueta:', numeroEtiqueta);
        console.log('Prazo:', prazo);

      } catch (correiosError: any) {
        console.error('=== Erro na API dos Correios ===');
        console.error(correiosError.message);

        // Retorna o erro para o usuário em vez de criar pedido falso
        return res.status(400).json({
          error: correiosError.message || 'Erro ao comunicar com os Correios',
          details: 'Verifique as credenciais e tente novamente'
        });
      }

      const pedidoData = {
        numeroPedido,
        numeroEtiqueta,
        tipo,
        codigoServico,
        status: "solicitado",
        idCliente: null,
        prazo,
        remetenteNome: remetente?.nome || null,
        remetenteCep: remetente?.cep || null,
        remetenteEndereco: remetente?.logradouro ? `${remetente.logradouro}, ${remetente.numero}` : null,
        remetenteCidade: remetente?.cidade || null,
        remetenteUf: remetente?.uf || null,
        remetenteEmail: remetente?.email || null,
        remetenteTelefone: remetente?.telefone || null,
        destinatarioNome: destinatario?.nome || null,
        destinatarioCep: destinatario?.cep || null,
        destinatarioEndereco: destinatario?.logradouro ? `${destinatario.logradouro}, ${destinatario.numero}` : null,
        destinatarioCidade: destinatario?.cidade || null,
        destinatarioUf: destinatario?.uf || null,
        observacao: observacao || null,
      };

      const pedido = await storage.createLogisticaReversaPedido(pedidoData);

      // Create initial event with Correios response info
      await storage.createLogisticaReversaEvento({
        pedidoId: pedido.id,
        status: "solicitado",
        descricao: `Pedido de logística reversa criado nos Correios. Etiqueta: ${numeroEtiqueta}`,
      });

      res.status(201).json({
        pedido,
        success: true,
        correiosResponse: correiosResponse ? {
          status: correiosResponse.status_processamento,
          dataProcessamento: correiosResponse.data_processamento,
          horaProcessamento: correiosResponse.hora_processamento,
        } : null
      });
    } catch (error: any) {
      console.error('Erro ao criar pedido de logística reversa:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: error.message || "Failed to create reverse logistics request" });
    }
  });

  router.patch("/api/logistica-reversa/pedidos/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertLogisticaReversaPedidoSchema.partial();
      const validated = partialSchema.parse(req.body);
      const pedido = await storage.updateLogisticaReversaPedido(req.params.id as string, validated);
      if (!pedido) return res.status(404).json({ error: "Pedido not found" });
      res.json(pedido);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update pedido" });
    }
  });

  router.post("/api/logistica-reversa/cancelar/:id", requireAuth, async (req, res) => {
    try {
      const pedido = await storage.updateLogisticaReversaPedido(req.params.id as string, { status: "cancelado" });
      if (!pedido) return res.status(404).json({ error: "Pedido not found" });

      await storage.createLogisticaReversaEvento({
        pedidoId: pedido.id,
        status: "cancelado",
        descricao: "Pedido cancelado pelo usuário",
      });

      res.json({ pedido, success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to cancel pedido" });
    }
  });

  router.get("/api/logistica-reversa/pedidos/:id/eventos", requireAuth, async (req, res) => {
    const eventos = await storage.getLogisticaReversaEventos(req.params.id as string);
    res.json(eventos);
  });

  router.get("/api/logistica-reversa/stats", requireAuth, async (req, res) => {
    const pedidos = await storage.getLogisticaReversaPedidos();
    const stats = {
      total: pedidos.length,
      pendentes: pedidos.filter(p => p.status === "solicitado" || p.status === "aguardando_postagem").length,
      concluidos: pedidos.filter(p => p.status === "entregue").length,
      cancelados: pedidos.filter(p => p.status === "cancelado").length,
    };
    res.json(stats);
  });

  router.get("/api/logistica-reversa/servicos", requireAuth, async (req, res) => {
    res.json({
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

  // Verifica status da API 250 (Logística Reversa) no contrato Correios
  router.get("/api/logistica-reversa/check-api-status", requireAuth, async (req, res) => {
    try {
      const status = await correiosService.checkApi250Status();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============== RS LOGISTICA API INTEGRATION ==============
  const RS_API_BASE_URL = "https://dash.renovsmart.com.br/api";
  const RS_API_TOKEN = "Renov123";

  // Test connection to RS Logística API
  router.post("/api/integrations/rs-logistica/test-connection", requireAdmin, async (req, res) => {
    try {
      const response = await fetch(`${RS_API_BASE_URL}/logistica/meus_dispositivos?imei=000000000000000`, {
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

  // Meus Dispositivos
  router.get("/api/integrations/rs-logistica/meus-dispositivos", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["imei", "filiais", "voucher_code", "status"];

      queryParams.forEach(param => {
        if (req.query[param]) {
          params.append(param, req.query[param] as string);
        }
      });

      const response = await fetch(`${RS_API_BASE_URL}/logistica/meus_dispositivos?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${RS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("RS Logística meus-dispositivos error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar dispositivos" });
    }
  });

  // Meus Fechamentos
  router.get("/api/integrations/rs-logistica/meus-fechamentos", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["code", "rede", "status"];

      queryParams.forEach(param => {
        if (req.query[param]) {
          params.append(param, req.query[param] as string);
        }
      });

      const response = await fetch(`${RS_API_BASE_URL}/logistica/meus-fechamentos?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${RS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("RS Logística meus-fechamentos error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar fechamentos" });
    }
  });

  // ============== ADMINISTRAÇÃO LOGÍSTICA API INTEGRATION ==============

  // Test connection to Administração Logística API
  router.post("/api/integrations/adm-logistica/test-connection", requireAdmin, async (req, res) => {
    try {
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/coletas?voucher_imei=000000000000000`, {
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

  // Adm Logística - Coletas
  router.get("/api/integrations/adm-logistica/coletas", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["voucher_imei", "code", "awb_code", "rede", "operator", "req_start", "req_end", "col_start", "col_end", "status", "represados"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/coletas?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística coletas error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar coletas" });
    }
  });

  // Adm Logística - Coletas (Aggregates para dashboard)
  router.get("/api/integrations/adm-logistica/coletas/aggregates", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["start_date", "end_date", "receipt_start", "receipt_end", "tsp", "status_controle", "responsavel"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });

      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/coletas/aggregates?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística coletas aggregates error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar agregados de coletas" });
    }
  });

  router.get("/api/integrations/adm-logistica/coleta-detalhes", requireAuth, async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).json({ error: "Código da coleta é obrigatório" });
      }

      const [coletaResponse, ordersResponse] = await Promise.all([
        fetch(`${RS_API_BASE_URL}/adm_logistica/coletas?code=${encodeURIComponent(code)}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
        }),
        fetch(`${RS_API_BASE_URL}/orders/advanced?coleta_code=${encodeURIComponent(code)}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
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
        return res.json({ coleta: null, dispositivos: [] });
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

      res.json({
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
    } catch (error: any) {
      console.error("Coleta detalhes error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar detalhes da coleta" });
    }
  });

  // Adm Logística - Recebimentos
  router.get("/api/integrations/adm-logistica/recebimentos", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["imei", "serial_number", "categories", "status_recebimento", "redes", "voucher_use_start", "voucher_use_end", "col_start", "col_end", "receipt_start", "receipt_end", "coleta_code", "awb_code"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/recebimentos?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística recebimentos error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar recebimentos" });
    }
  });

  // Adm Logística - Triagem
  router.get("/api/integrations/adm-logistica/triagem", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["imei", "serial_number", "voucher_code", "categories", "status_recebimento", "redes", "responsavel_triagem", "receipt_start", "receipt_end", "col_start", "col_end", "triagem_start", "triagem_end"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/triagem?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística triagem error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar triagem" });
    }
  });

  // Adm Logística - Bloqueados
  router.get("/api/integrations/adm-logistica/bloqueados", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["imei", "redes", "date_start", "date_end", "status"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/bloqueados?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística bloqueados error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar bloqueados" });
    }
  });

  // Adm Logística - Manutenção
  router.get("/api/integrations/adm-logistica/manutencao", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      if (req.query.imei) params.append("imei", req.query.imei as string);
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/manutencao?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística manutencao error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar manutenção" });
    }
  });

  // Adm Logística - Divergentes
  router.get("/api/integrations/adm-logistica/divergentes", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      if (req.query.imei) params.append("imei", req.query.imei as string);
      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/divergentes?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística divergentes error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar divergentes" });
    }
  });

  // Adm Logística - Dispositivos Aggregates (Dashboard)
  router.get("/api/integrations/adm-logistica/dispositivos/aggregates", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      const queryParams = ["start_date", "end_date", "rede", "filial", "status_coleta", "transportadora", "responsavel", "imei", "voucher"];
      queryParams.forEach(param => {
        if (req.query[param]) params.append(param, req.query[param] as string);
      });

      // API Python espera "quinzena".
      const quinzena = (req.query.quinzena ?? req.query.quincena) as string | undefined;
      if (quinzena) {
        params.append("quinzena", quinzena);
      }

      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/dispositivos/aggregates?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística dispositivos aggregates error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar dados de dispositivos" });
    }
  });

  // Adm Logística - Consulta Aggregates (Dashboard - Aba Consulta)
  router.get("/api/integrations/adm-logistica/consulta/aggregates", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();
      
      // codigos pode ser uma lista separada por vírgula de IMEIs/Vouchers
      if (req.query.codigos) {
        params.append("codigos", req.query.codigos as string);
      }
      if (req.query.rede) {
        params.append("rede", req.query.rede as string);
      }

      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/consulta/aggregates?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística consulta aggregates error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar dados de consulta" });
    }
  });

  // Adm Logística - Fechamentos Aggregates (Dashboard - Aba Fechamentos)
  router.get("/api/integrations/adm-logistica/fechamentos/aggregates", requireAuth, async (req, res) => {
    try {
      const params = new URLSearchParams();

      if (req.query.rede) {
        params.append("rede", req.query.rede as string);
      }
      if (req.query.data_corte) {
        params.append("data_corte", req.query.data_corte as string);
      }

      const response = await fetch(`${RS_API_BASE_URL}/adm_logistica/fechamentos/aggregates?${params.toString()}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RS_API_TOKEN}`, "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Adm Logística fechamentos aggregates error:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar dados de fechamentos" });
    }
  });

  // ============== CORREIOS LOGISTICA REVERSA ==============

  // Get Correios configuration status
  router.get("/api/correios/config", requireAuth, async (req, res) => {
    try {
      const config = correiosService.getCorreiosConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get Correios configuration" });
    }
  });

  // Solicitar Postagem Reversa (Authorization or Collection)
  router.post("/api/correios/solicitar-postagem-reversa", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.solicitarPostagemReversa(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios solicitarPostagemReversa error:", error);
      res.status(500).json({ error: error.message || "Failed to request reverse posting" });
    }
  });

  // Cancelar Pedido
  router.post("/api/correios/cancelar-pedido", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.cancelarPedido(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios cancelarPedido error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel request" });
    }
  });

  // Acompanhar Pedido (by number)
  router.post("/api/correios/acompanhar-pedido", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.acompanharPedido(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios acompanharPedido error:", error);
      res.status(500).json({ error: error.message || "Failed to track request" });
    }
  });

  // Acompanhar Pedido por Data
  router.post("/api/correios/acompanhar-pedido-por-data", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.acompanharPedidoPorData(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios acompanharPedidoPorData error:", error);
      res.status(500).json({ error: error.message || "Failed to track requests by date" });
    }
  });

  // Revalidar Prazo Autorização de Postagem
  router.post("/api/correios/revalidar-prazo", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.revalidarPrazoAutorizacaoPostagem(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios revalidarPrazoAutorizacaoPostagem error:", error);
      res.status(500).json({ error: error.message || "Failed to revalidate deadline" });
    }
  });

  // Solicitar Range de e-Tickets
  router.post("/api/correios/solicitar-range", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.solicitarRange(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios solicitarRange error:", error);
      res.status(500).json({ error: error.message || "Failed to request e-ticket range" });
    }
  });

  // Calcular Dígito Verificador
  router.post("/api/correios/calcular-digito-verificador", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.calcularDigitoVerificador(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios calcularDigitoVerificador error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate check digit" });
    }
  });

  // Solicitar Postagem Simultânea
  router.post("/api/correios/solicitar-postagem-simultanea", requireAuth, async (req, res) => {
    try {
      const result = await correiosService.solicitarPostagemSimultanea(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios solicitarPostagemSimultanea error:", error);
      res.status(500).json({ error: error.message || "Failed to request simultaneous posting" });
    }
  });
}
