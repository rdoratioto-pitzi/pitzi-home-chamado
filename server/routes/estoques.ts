/**
 * Rotas para módulo de Estoques
 * Integração com API Omie para posição de estoques
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import { getSessionUser } from "../middleware/auth";
import { omieService } from "../services/omie.service";
import ExcelJS from "exceljs";
import { db } from "../db";
import {
  estoquesContagens,
  estoquesContagemItens,
  estoquesContagemLogs,
  estoquesContagemDivergencias,
  estoquesAjustes,
  users,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export function registerEstoqueRoutes(router: Router) {
  
  // ============== POSIÇÃO DE ESTOQUES ==============
  
  // GET /api/estoques/posicao - Obter posição de estoques
  router.get("/api/estoques/posicao", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { categoria, marca, modelo, codigoErp } = req.query;
      
      console.log('[Estoque Routes] GET /api/estoques/posicao - Fetching stock position');
      console.log('[Estoque Routes] Filters:', { categoria, marca, modelo, codigoErp });
      
      // Chamar API Omie para listar produtos/estoque
      // Endpoint: geral/produtos (listar produtos)
      const params: any[] = [
        {
          pagina: 1,
          registros_por_pagina: 500
        }
      ];
      
      const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);
      
      console.log('[Estoque Routes] Raw API response type:', typeof data);
      console.log('[Estoque Routes] Raw API response sample:', JSON.stringify(data)?.substring(0, 1000));
      
      // Parsear dados se vier como string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
          console.log('[Estoque Routes] Parsed data type:', typeof parsedData);
          console.log('[Estoque Routes] Parsed data keys:', Object.keys(parsedData).slice(0, 20));
        } catch (e) {
          console.log('[Estoque Routes] Failed to parse string data');
        }
      }
      
      // Verificar diferentes estruturas de resposta
      let produtos = null;
      
      // Tentar várias chaves possíveis
      if (parsedData?.produto_servico_cadastro) {
        produtos = parsedData.produto_servico_cadastro;
      } else if (parsedData?.produtos?.produto_servico_cadastro) {
        produtos = parsedData.produtos.produto_servico_cadastro;
      } else if (Array.isArray(parsedData)) {
        produtos = parsedData;
      } else if (parsedData) {
        // Se for objeto, usar como array de um elemento
        produtos = [parsedData];
      }
      
      if (!produtos) {
        console.log('[Estoque Routes] No products found in response');
        return res.json({ success: true, data: [] });
      }
      
      let produtosArray = Array.isArray(produtos) ? produtos : [produtos];
      
      // Filtrar apenas produtos válidos (com código)
      produtosArray = produtosArray.filter((p: any) => p.codigo_produto || p.codigo);
      
      console.log('[Estoque Routes] Products found:', produtosArray.length);
      console.log('[Estoque Routes] Sample product:', JSON.stringify(produtosArray[0])?.substring(0, 500));
      
      // Aplicar filtros
      let filteredProdutos = produtosArray;
      
      if (categoria) {
        filteredProdutos = filteredProdutos.filter((p: any) =>
          p.categoria?.toLowerCase().includes((categoria as string).toLowerCase())
        );
      }
      
      if (marca) {
        filteredProdutos = filteredProdutos.filter((p: any) =>
          p.marca?.toLowerCase().includes((marca as string).toLowerCase())
        );
      }
      
      if (modelo) {
        filteredProdutos = filteredProdutos.filter((p: any) =>
          p.descricao?.toLowerCase().includes((modelo as string).toLowerCase()) ||
          p.modelo?.toLowerCase().includes((modelo as string).toLowerCase())
        );
      }
      
      if (codigoErp) {
        filteredProdutos = filteredProdutos.filter((p: any) =>
          p.codigo_produto?.toString().includes(codigoErp as string)
        );
      }
      
      console.log('[Estoque Routes] Filtered products:', filteredProdutos.length);
      
      // Formatar dados para a tabela
      const formattedData = filteredProdutos.map((p: any) => ({
        codigoErp: p.codigo_produto || p.codigo || '',
        descricao: p.descricao || '',
        categoria: p.categoria || '',
        marca: p.marca || '',
        modelo: p.modelo || p.descricao || '',
        unidade: p.unidade || 'UN',
        // Estoque - buscar em call separada se necessário
        estoqueDisponivel: parseInt(p.estoque_local || p.estoque || 0, 10),
        // Custo - usar valor de custo ou preço de custo
        custoUnitario: parseFloat(p.preco_custo || p.valor_custo || 0),
        // Valor venda - usar preço de venda
        valorVenda: parseFloat(p.preco_venda || p.valor_unitario || 0),
        // Calcular custo total
        custoTotal: 0, // Será calculado no frontend
        // Calcular markup
        markup: 0, // Será calculado no frontend
      }));
      
      console.log('[Estoque Routes] Returning', formattedData.length, 'products');
      
      res.json({ 
        success: true, 
        data: formattedData,
        total: formattedData.length
      });
    } catch (error: any) {
      console.error('[Estoque Routes] Error fetching stock position:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/estoques/posicao/totais - Obter totais de estoques
  router.get("/api/estoques/posicao/totais", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('[Estoque Routes] GET /api/estoques/posicao/totais - Calculating totals');
      
      // Buscar todos os produtos
      const params: any[] = [
        {
          pagina: 1,
          registros_por_pagina: 500
        }
      ];
      
      const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);
      
      // Parsear dados se vier como string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.log('[Estoque Routes] Failed to parse string data in totals');
        }
      }
      
      // Verificar diferentes estruturas de resposta
      let produtos = null;
      if (parsedData?.produto_servico_cadastro) {
        produtos = parsedData.produto_servico_cadastro;
      } else if (parsedData?.produtos?.produto_servico_cadastro) {
        produtos = parsedData.produtos.produto_servico_cadastro;
      } else if (Array.isArray(parsedData)) {
        produtos = parsedData;
      } else if (parsedData) {
        produtos = [parsedData];
      }
      
      if (!produtos) {
        return res.json({
          success: true,
          data: {
            qtdeTotal: 0,
            valorTotal: 0,
            custoMedioUnitario: 0
          }
        });
      }
      
      let produtosArray = Array.isArray(produtos) ? produtos : [produtos];
      
      // Calcular totais
      let qtdeTotal = 0;
      let valorTotal = 0;
      
      produtosArray.forEach((p: any) => {
        const qtde = parseInt(p.estoque_local || p.estoque || 0, 10);
        const custo = parseFloat(p.preco_custo || p.valor_custo || 0);
        
        qtdeTotal += qtde;
        valorTotal += (qtde * custo);
      });
      
      const custoMedioUnitario = qtdeTotal > 0 ? valorTotal / qtdeTotal : 0;
      
      console.log('[Estoque Routes] Totals:', { qtdeTotal, valorTotal, custoMedioUnitario });
      
      res.json({ 
        success: true, 
        data: {
          qtdeTotal,
          valorTotal,
          custoMedioUnitario
        }
      });
    } catch (error: any) {
      console.error('[Estoque Routes] Error calculating totals:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/estoques/posicao/export - Exportar para Excel
  router.get("/api/estoques/posicao/export", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('[Estoque Routes] GET /api/estoques/posicao/export - Exporting to Excel');
      
      // Buscar todos os produtos
      const params: any[] = [
        {
          pagina: 1,
          registros_por_pagina: 500
        }
      ];
      
      const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);
      
      // Parsear dados se vier como string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.log('[Estoque Routes] Failed to parse string data in export');
        }
      }
      
      // Verificar diferentes estruturas de resposta
      let produtos = null;
      if (parsedData?.produto_servico_cadastro) {
        produtos = parsedData.produto_servico_cadastro;
      } else if (parsedData?.produtos?.produto_servico_cadastro) {
        produtos = parsedData.produtos.produto_servico_cadastro;
      } else if (Array.isArray(parsedData)) {
        produtos = parsedData;
      } else if (parsedData) {
        produtos = [parsedData];
      }
      
      if (!produtos) {
        return res.status(404).json({ error: "Nenhum produto encontrado" });
      }
      
      let produtosArray = Array.isArray(produtos) ? produtos : [produtos];
      
      // Criar workbook Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Renov Home";
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet("Posição de Estoques");
      
      // Adicionar cabeçalhos
      worksheet.columns = [
        { header: "Código ERP", key: "codigoErp", width: 15 },
        { header: "Descrição", key: "descricao", width: 40 },
        { header: "Categoria", key: "categoria", width: 20 },
        { header: "Marca", key: "marca", width: 20 },
        { header: "Modelo", key: "modelo", width: 30 },
        { header: "Estoque Disponível", key: "estoqueDisponivel", width: 18 },
        { header: "Custo Unitário (R$)", key: "custoUnitario", width: 18 },
        { header: "Custo Total (R$)", key: "custoTotal", width: 18 },
        { header: "Valor Venda (R$)", key: "valorVenda", width: 18 },
        { header: "Markup (%)", key: "markup", width: 12 }
      ];
      
      // Adicionar dados
      produtosArray.forEach((p: any) => {
        const qtde = parseInt(p.estoque_local || p.estoque || 0, 10);
        const custo = parseFloat(p.preco_custo || p.valor_custo || 0);
        const venda = parseFloat(p.preco_venda || p.valor_unitario || 0);
        const custoTotal = qtde * custo;
        const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
        
        worksheet.addRow({
          codigoErp: p.codigo_produto || p.codigo || '',
          descricao: p.descricao || '',
          categoria: p.categoria || '',
          marca: p.marca || '',
          modelo: p.modelo || p.descricao || '',
          estoqueDisponivel: qtde,
          custoUnitario: custo,
          custoTotal: custoTotal,
          valorVenda: venda,
          markup: markup.toFixed(2)
        });
      });
      
      // Formatar cabeçalhos
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF366092" }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      
      // Configurar resposta
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=posicao-estoques.xlsx");
      
      await workbook.xlsx.write(res);
      res.end();
      
      console.log('[Estoque Routes] Excel exported successfully');
    } catch (error: any) {
      console.error('[Estoque Routes] Error exporting to Excel:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // ============== FILTROS DINÂMICOS ==============
  
  // GET /api/estoques/filtros/categorias - Listar categorias únicas
  router.get("/api/estoques/filtros/categorias", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('[Estoque Routes] GET /api/estoques/filtros/categorias');
      
      const params: any[] = [
        {
          pagina: 1,
          registros_por_pagina: 500
        }
      ];
      
      const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);
      
      // Parsear dados se vier como string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.log('[Estoque Routes] Failed to parse string data in categorias');
        }
      }
      
      // Verificar diferentes estruturas de resposta
      let produtos = null;
      if (parsedData?.produto_servico_cadastro) {
        produtos = parsedData.produto_servico_cadastro;
      } else if (parsedData?.produtos?.produto_servico_cadastro) {
        produtos = parsedData.produtos.produto_servico_cadastro;
      } else if (Array.isArray(parsedData)) {
        produtos = parsedData;
      } else if (parsedData) {
        produtos = [parsedData];
      }
      
      if (!produtos) {
        return res.json({ success: true, data: [] });
      }
      
      let produtosArray = Array.isArray(produtos) ? produtos : [produtos];
      
      // Extrair categorias únicas
      const categorias = [...new Set(produtosArray.map((p: any) => p.categoria).filter(Boolean))];
      
      res.json({ success: true, data: categorias.sort() });
    } catch (error: any) {
      console.error('[Estoque Routes] Error fetching categorias:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/estoques/filtros/marcas - Listar marcas únicas
  router.get("/api/estoques/filtros/marcas", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('[Estoque Routes] GET /api/estoques/filtros/marcas');
      
      const params: any[] = [
        {
          pagina: 1,
          registros_por_pagina: 500
        }
      ];
      
      const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);
      
      // Parsear dados se vier como string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.log('[Estoque Routes] Failed to parse string data in marcas');
        }
      }
      
      // Verificar diferentes estruturas de resposta
      let produtos = null;
      if (parsedData?.produto_servico_cadastro) {
        produtos = parsedData.produto_servico_cadastro;
      } else if (parsedData?.produtos?.produto_servico_cadastro) {
        produtos = parsedData.produtos.produto_servico_cadastro;
      } else if (Array.isArray(parsedData)) {
        produtos = parsedData;
      } else if (parsedData) {
        produtos = [parsedData];
      }
      
      if (!produtos) {
        return res.json({ success: true, data: [] });
      }
      
      let produtosArray = Array.isArray(produtos) ? produtos : [produtos];
      
      // Extrair marcas únicas
      const marcas = [...new Set(produtosArray.map((p: any) => p.marca).filter(Boolean))];
      
      res.json({ success: true, data: marcas.sort() });
    } catch (error: any) {
      console.error('[Estoque Routes] Error fetching marcas:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/estoques/filtros/modelos - Listar modelos únicos
  router.get("/api/estoques/filtros/modelos", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('[Estoque Routes] GET /api/estoques/filtros/modelos');
      
      const params: any[] = [
        {
          pagina: 1,
          registros_por_pagina: 500
        }
      ];
      
      const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);
      
      // Parsear dados se vier como string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.log('[Estoque Routes] Failed to parse string data in modelos');
        }
      }
      
      // Verificar diferentes estruturas de resposta
      let produtos = null;
      if (parsedData?.produto_servico_cadastro) {
        produtos = parsedData.produto_servico_cadastro;
      } else if (parsedData?.produtos?.produto_servico_cadastro) {
        produtos = parsedData.produtos.produto_servico_cadastro;
      } else if (Array.isArray(parsedData)) {
        produtos = parsedData;
      } else if (parsedData) {
        produtos = [parsedData];
      }
      
      if (!produtos) {
        return res.json({ success: true, data: [] });
      }
      
      let produtosArray = Array.isArray(produtos) ? produtos : [produtos];
      
      // Extrair modelos únicos (usando descricao ou modelo)
      const modelos = [...new Set(produtosArray.map((p: any) => p.modelo || p.descricao).filter(Boolean))];
      
      res.json({ success: true, data: modelos.sort() });
    } catch (error: any) {
      console.error('[Estoque Routes] Error fetching modelos:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // ============== CONTAGEM INTERNA ==============

  // GET /api/estoques/contagens - Listar todas as contagens (Admin)
  router.get("/api/estoques/contagens", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const contagens = await db
        .select()
        .from(estoquesContagens)
        .orderBy(desc(estoquesContagens.createdAt));
      res.json({ success: true, data: contagens });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/ativa - Contagem ativa do usuário logado
  // IMPORTANTE: esta rota deve vir ANTES de /:id para não ser capturada por ela
  router.get("/api/estoques/contagens/ativa", requireAuth, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId } = getSessionUser(req);
      const [contagem] = await db
        .select()
        .from(estoquesContagens)
        .where(
          and(
            eq(estoquesContagens.responsavelId, userId),
            eq(estoquesContagens.status, "em_andamento")
          )
        )
        .limit(1);
      res.json({ success: true, data: contagem || null });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/estoques/contagens - Iniciar nova contagem
  router.post("/api/estoques/contagens", requireAuth, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId } = getSessionUser(req);

      // Verificar se já existe contagem em andamento para este usuário
      const [existing] = await db
        .select()
        .from(estoquesContagens)
        .where(
          and(
            eq(estoquesContagens.responsavelId, userId),
            eq(estoquesContagens.status, "em_andamento")
          )
        )
        .limit(1);

      if (existing) {
        return res.status(400).json({
          success: false,
          error: "Já existe uma contagem em andamento. Finalize-a antes de iniciar outra.",
        });
      }

      // Gerar código CNT-YYYYMMDD-XXX
      const hoje = new Date();
      const dateStr = hoje.toISOString().slice(0, 10).replace(/-/g, "");

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(estoquesContagens)
        .where(sql`codigo LIKE ${"CNT-" + dateStr + "-%"}`);

      const seq = (Number(countResult?.count ?? 0) + 1).toString().padStart(3, "0");
      const codigo = `CNT-${dateStr}-${seq}`;

      const [novaContagem] = await db
        .insert(estoquesContagens)
        .values({
          codigo,
          responsavelId: userId,
          status: "em_andamento",
        })
        .returning();

      // Log de auditoria
      await db.insert(estoquesContagemLogs).values({
        contagemId: novaContagem.id,
        userId,
        acao: "contagem_iniciada",
        detalhes: { codigo },
      });

      res.json({ success: true, data: novaContagem });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/:id - Detalhes de uma contagem
  router.get("/api/estoques/contagens/:id", requireAuth, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const { id } = req.params;

      const [contagem] = await db
        .select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);

      if (!contagem) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }

      // Verificar acesso: própria contagem ou admin
      if (!isAdmin && contagem.responsavelId !== userId) {
        return res.status(403).json({ success: false, error: "Acesso negado" });
      }

      res.json({ success: true, data: contagem });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/estoques/contagens/:id/item - Adicionar item à contagem
  router.post("/api/estoques/contagens/:id/item", requireAuth, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const { id } = req.params;
      const { imei, metodoLeitura } = req.body;

      // Validar IMEI: 15 dígitos numéricos
      if (!imei || !/^\d{15}$/.test(imei)) {
        return res.status(400).json({
          success: false,
          error: "IMEI inválido - deve ter exatamente 15 dígitos numéricos",
        });
      }

      const [contagem] = await db
        .select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);

      if (!contagem) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }

      // Verificar acesso
      if (!isAdmin && contagem.responsavelId !== userId) {
        return res.status(403).json({ success: false, error: "Acesso negado" });
      }

      // Verificar se contagem está em andamento
      if (contagem.status !== "em_andamento") {
        return res.status(400).json({
          success: false,
          error: "Esta contagem já foi finalizada",
        });
      }

      // Verificar duplicidade de IMEI nesta contagem
      const [itemExistente] = await db
        .select()
        .from(estoquesContagemItens)
        .where(
          and(
            eq(estoquesContagemItens.contagemId, id),
            eq(estoquesContagemItens.imei, imei)
          )
        )
        .limit(1);

      if (itemExistente) {
        return res.status(400).json({
          success: false,
          error: `IMEI ${imei} já foi contado nesta contagem`,
        });
      }

      // Inserir item
      const [novoItem] = await db
        .insert(estoquesContagemItens)
        .values({
          contagemId: id,
          imei,
          metodoLeitura: metodoLeitura || "manual",
          contadoPor: userId,
        })
        .returning();

      // Atualizar totalItensContados
      await db
        .update(estoquesContagens)
        .set({
          totalItensContados: sql`${estoquesContagens.totalItensContados} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(estoquesContagens.id, id));

      // Log de auditoria
      await db.insert(estoquesContagemLogs).values({
        contagemId: id,
        userId,
        acao: "item_adicionado",
        imei,
        detalhes: { metodoLeitura: metodoLeitura || "manual" },
      });

      res.json({ success: true, data: novoItem });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/:id/itens - Listar itens da contagem
  router.get("/api/estoques/contagens/:id/itens", requireAuth, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const { id } = req.params;

      const [contagem] = await db
        .select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);

      if (!contagem) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }

      if (!isAdmin && contagem.responsavelId !== userId) {
        return res.status(403).json({ success: false, error: "Acesso negado" });
      }

      const itens = await db
        .select()
        .from(estoquesContagemItens)
        .where(eq(estoquesContagemItens.contagemId, id))
        .orderBy(desc(estoquesContagemItens.contadoEm));

      res.json({ success: true, data: itens });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/estoques/contagens/:id/finalizar - Finalizar contagem
  router.post("/api/estoques/contagens/:id/finalizar", requireAuth, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const { id } = req.params;

      const [contagem] = await db
        .select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);

      if (!contagem) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }

      if (!isAdmin && contagem.responsavelId !== userId) {
        return res.status(403).json({ success: false, error: "Acesso negado" });
      }

      if (contagem.status !== "em_andamento") {
        return res.status(400).json({
          success: false,
          error: "Esta contagem já foi finalizada",
        });
      }

      const [contagemFinalizada] = await db
        .update(estoquesContagens)
        .set({
          status: "finalizada",
          dataFim: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(estoquesContagens.id, id))
        .returning();

      await db.insert(estoquesContagemLogs).values({
        contagemId: id,
        userId,
        acao: "contagem_finalizada",
        detalhes: { totalItensContados: contagem.totalItensContados },
      });

      res.json({ success: true, data: contagemFinalizada });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== RELATÓRIO CONTAGENS (ADMIN ONLY) ==============

  // GET /api/estoques/contagens/:id/resumo - Resumo da contagem
  router.get("/api/estoques/contagens/:id/resumo", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { id } = req.params;

      const [contagem] = await db
        .select({
          id: estoquesContagens.id,
          codigo: estoquesContagens.codigo,
          status: estoquesContagens.status,
          dataInicio: estoquesContagens.dataInicio,
          dataFim: estoquesContagens.dataFim,
          totalItensContados: estoquesContagens.totalItensContados,
          totalItensSistema: estoquesContagens.totalItensSistema,
          divergencia: estoquesContagens.divergencia,
          acuracidade: estoquesContagens.acuracidade,
          responsavelId: estoquesContagens.responsavelId,
          responsavelNome: users.name,
        })
        .from(estoquesContagens)
        .leftJoin(users, eq(estoquesContagens.responsavelId, users.id))
        .where(eq(estoquesContagens.id, id))
        .limit(1);

      if (!contagem) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }

      const divergencias = await db
        .select({
          tipo: estoquesContagemDivergencias.tipo,
          count: sql<number>`count(*)`,
        })
        .from(estoquesContagemDivergencias)
        .where(eq(estoquesContagemDivergencias.contagemId, id))
        .groupBy(estoquesContagemDivergencias.tipo);

      const sobras = Number(divergencias.find(d => d.tipo === "sobra")?.count ?? 0);
      const faltas = Number(divergencias.find(d => d.tipo === "falta")?.count ?? 0);

      const totalContado = contagem.totalItensContados ?? 0;
      const totalSistema = contagem.totalItensSistema ?? totalContado;
      const acuracidade = contagem.acuracidade
        ? parseFloat(contagem.acuracidade)
        : totalSistema > 0
        ? Math.min(100, (totalContado / totalSistema) * 100)
        : 100;

      res.json({
        success: true,
        data: { ...contagem, totalSistema, totalContado, sobras, faltas, acuracidade },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/:id/categoria - Agrupado por categoria
  router.get("/api/estoques/contagens/:id/categoria", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { id } = req.params;

      const itens = await db
        .select({
          categoria: estoquesContagemItens.categoria,
          count: sql<number>`count(*)`,
        })
        .from(estoquesContagemItens)
        .where(eq(estoquesContagemItens.contagemId, id))
        .groupBy(estoquesContagemItens.categoria);

      const categorias = itens.map(item => ({
        categoria: item.categoria || "Sem Categoria",
        qtdeContada: Number(item.count),
      }));

      res.json({ success: true, data: categorias });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/:id/itens-comparativo - Lista de itens contados
  router.get("/api/estoques/contagens/:id/itens-comparativo", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { id } = req.params;

      const itens = await db
        .select()
        .from(estoquesContagemItens)
        .where(eq(estoquesContagemItens.contagemId, id))
        .orderBy(desc(estoquesContagemItens.contadoEm));

      res.json({ success: true, data: itens, total: itens.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/:id/divergencias - Lista de divergências
  router.get("/api/estoques/contagens/:id/divergencias", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { id } = req.params;

      const divergencias = await db
        .select()
        .from(estoquesContagemDivergencias)
        .where(eq(estoquesContagemDivergencias.contagemId, id))
        .orderBy(estoquesContagemDivergencias.tipo, estoquesContagemDivergencias.createdAt);

      res.json({ success: true, data: divergencias });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/contagens/:id/export - Exportar Excel multi-abas
  router.get("/api/estoques/contagens/:id/export", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { id } = req.params;

      const [contagem] = await db
        .select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);

      if (!contagem) return res.status(404).json({ error: "Contagem não encontrada" });

      const itens = await db
        .select()
        .from(estoquesContagemItens)
        .where(eq(estoquesContagemItens.contagemId, id))
        .orderBy(estoquesContagemItens.contadoEm);

      const divergencias = await db
        .select()
        .from(estoquesContagemDivergencias)
        .where(eq(estoquesContagemDivergencias.contagemId, id));

      const ajustes = await db
        .select()
        .from(estoquesAjustes)
        .where(eq(estoquesAjustes.contagemId, id));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Renov Home";
      workbook.created = new Date();

      // Aba 1: Resumo Geral
      const wsResumo = workbook.addWorksheet("Resumo Geral");
      wsResumo.columns = [
        { header: "Campo", key: "campo", width: 25 },
        { header: "Valor", key: "valor", width: 30 },
      ];
      wsResumo.addRows([
        { campo: "Código", valor: contagem.codigo },
        { campo: "Status", valor: contagem.status },
        { campo: "Data Início", valor: contagem.dataInicio ? new Date(contagem.dataInicio).toLocaleString("pt-BR") : "" },
        { campo: "Data Fim", valor: contagem.dataFim ? new Date(contagem.dataFim).toLocaleString("pt-BR") : "" },
        { campo: "Total Itens Contados", valor: contagem.totalItensContados ?? 0 },
        { campo: "Total Itens Sistema", valor: contagem.totalItensSistema ?? "N/A" },
        { campo: "Acuracidade", valor: contagem.acuracidade ? `${contagem.acuracidade}%` : "N/A" },
      ]);
      wsResumo.getRow(1).font = { bold: true };

      // Aba 2: Por Categoria
      const wsCategoria = workbook.addWorksheet("Por Categoria");
      wsCategoria.columns = [
        { header: "Categoria", key: "categoria", width: 25 },
        { header: "Qtd Contada", key: "qtde", width: 15 },
      ];
      const categoriaMap: Record<string, number> = {};
      itens.forEach((item) => {
        const cat = item.categoria || "Sem Categoria";
        categoriaMap[cat] = (categoriaMap[cat] || 0) + 1;
      });
      Object.entries(categoriaMap).forEach(([cat, qtde]) => {
        wsCategoria.addRow({ categoria: cat, qtde });
      });
      wsCategoria.getRow(1).font = { bold: true };

      // Aba 3: Por Item
      const wsItens = workbook.addWorksheet("Por Item");
      wsItens.columns = [
        { header: "IMEI", key: "imei", width: 20 },
        { header: "Código ERP", key: "codigoErp", width: 15 },
        { header: "Modelo", key: "modelo", width: 30 },
        { header: "Categoria", key: "categoria", width: 20 },
        { header: "Marca", key: "marca", width: 15 },
        { header: "Método", key: "metodo", width: 12 },
        { header: "Contado Em", key: "contadoEm", width: 20 },
      ];
      itens.forEach((item) => {
        wsItens.addRow({
          imei: item.imei,
          codigoErp: item.codigoErp || "",
          modelo: item.modelo || "",
          categoria: item.categoria || "",
          marca: item.marca || "",
          metodo: item.metodoLeitura,
          contadoEm: item.contadoEm ? new Date(item.contadoEm).toLocaleString("pt-BR") : "",
        });
      });
      wsItens.getRow(1).font = { bold: true };

      // Aba 4: Divergências - Faltas
      const wsFaltas = workbook.addWorksheet("Divergências - Faltas");
      const divCols = [
        { header: "IMEI", key: "imei", width: 20 },
        { header: "Código ERP", key: "codigoErp", width: 15 },
        { header: "Modelo", key: "modelo", width: 30 },
        { header: "Categoria", key: "categoria", width: 20 },
        { header: "Status Análise", key: "statusAnalise", width: 18 },
      ];
      wsFaltas.columns = divCols;
      divergencias
        .filter((d) => d.tipo === "falta")
        .forEach((d) => {
          wsFaltas.addRow({ imei: d.imei || "", codigoErp: d.codigoErp || "", modelo: d.modelo || "", categoria: d.categoria || "", statusAnalise: d.statusAnalise || "pendente" });
        });
      wsFaltas.getRow(1).font = { bold: true };

      // Aba 5: Divergências - Sobras
      const wsSobras = workbook.addWorksheet("Divergências - Sobras");
      wsSobras.columns = divCols;
      divergencias
        .filter((d) => d.tipo === "sobra")
        .forEach((d) => {
          wsSobras.addRow({ imei: d.imei || "", codigoErp: d.codigoErp || "", modelo: d.modelo || "", categoria: d.categoria || "", statusAnalise: d.statusAnalise || "pendente" });
        });
      wsSobras.getRow(1).font = { bold: true };

      // Aba 6: Ajustes Realizados
      const wsAjustes = workbook.addWorksheet("Ajustes Realizados");
      wsAjustes.columns = [
        { header: "Tipo Ajuste", key: "tipoAjuste", width: 18 },
        { header: "IMEI", key: "imei", width: 20 },
        { header: "Código ERP", key: "codigoErp", width: 15 },
        { header: "Quantidade", key: "quantidade", width: 12 },
        { header: "Justificativa", key: "justificativa", width: 50 },
        { header: "Criado Em", key: "createdAt", width: 20 },
      ];
      ajustes.forEach((a) => {
        wsAjustes.addRow({
          tipoAjuste: a.tipoAjuste,
          imei: a.imei || "",
          codigoErp: a.codigoErp || "",
          quantidade: a.quantidade ?? "",
          justificativa: a.justificativa,
          createdAt: a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : "",
        });
      });
      wsAjustes.getRow(1).font = { bold: true };

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=contagem-${contagem.codigo}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============== AJUSTES DE INVENTÁRIO (ADMIN ONLY) ==============

  // POST /api/estoques/ajustes - Registrar ajuste
  router.post("/api/estoques/ajustes", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { contagemId, divergenciaId, tipoAjuste, imei, codigoErp, quantidade, justificativa } = req.body;

      if (!contagemId || !tipoAjuste || !justificativa) {
        return res.status(400).json({ success: false, error: "Campos obrigatórios: contagemId, tipoAjuste, justificativa" });
      }
      if (justificativa.length < 20) {
        return res.status(400).json({ success: false, error: "Justificativa deve ter no mínimo 20 caracteres" });
      }

      const [ajuste] = await db
        .insert(estoquesAjustes)
        .values({ contagemId, divergenciaId, tipoAjuste, imei, codigoErp, quantidade, justificativa })
        .returning();

      if (divergenciaId) {
        await db
          .update(estoquesContagemDivergencias)
          .set({ statusAnalise: "investigando" })
          .where(eq(estoquesContagemDivergencias.id, divergenciaId));
      }

      res.json({ success: true, data: ajuste });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/estoques/ajustes/:contagemId - Listar ajustes de uma contagem
  router.get("/api/estoques/ajustes/:contagemId", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { contagemId } = req.params;
      const ajustes = await db
        .select()
        .from(estoquesAjustes)
        .where(eq(estoquesAjustes.contagemId, contagemId))
        .orderBy(desc(estoquesAjustes.createdAt));
      res.json({ success: true, data: ajustes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PATCH /api/estoques/ajustes/:id/aprovar - Aprovar ajuste
  router.patch("/api/estoques/ajustes/:id/aprovar", requireAuth, requireAdmin, async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    try {
      const { userId } = getSessionUser(req);
      const { id } = req.params;

      const [ajuste] = await db
        .update(estoquesAjustes)
        .set({ aprovadoPor: userId, aprovadoEm: new Date() })
        .where(eq(estoquesAjustes.id, id))
        .returning();

      if (!ajuste) return res.status(404).json({ success: false, error: "Ajuste não encontrado" });

      if (ajuste.divergenciaId) {
        await db
          .update(estoquesContagemDivergencias)
          .set({ statusAnalise: "resolvido" })
          .where(eq(estoquesContagemDivergencias.id, ajuste.divergenciaId));
      }

      res.json({ success: true, data: ajuste });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('[Estoque Routes] Routes registered successfully');
}
