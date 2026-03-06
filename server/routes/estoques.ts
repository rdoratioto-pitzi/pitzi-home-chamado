/**
 * Rotas para módulo de Estoques
 * Integração com API Omie para posição de estoques
 */
import { Router } from "express";
import { requireAuth, requireAdmin, getSessionUser } from "../middleware/auth";
import { omieService } from "../services/omie.service";
import ExcelJS from "exceljs";
import { db } from "../db";
import { estoquesContagens, estoquesContagemItens, estoquesContagemLogs, estoquesContagemDivergencias } from "@shared/schema";
import { eq, desc, and, sql, like } from "drizzle-orm";

// Cache simples para dados do Omie (evita 5 chamadas idênticas por page load)
let cachedProdutos: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 segundos

async function getCachedProdutos(): Promise<any[]> {
  const now = Date.now();
  if (cachedProdutos && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[Estoque Routes] Using cached products (' + cachedProdutos.length + ' items)');
    return cachedProdutos;
  }

  console.log('[Estoque Routes] Fetching products from Omie API...');
  const params = [{ pagina: 1, registros_por_pagina: 500 }];
  const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);

  let parsedData = data;
  if (typeof data === 'string') {
    try { parsedData = JSON.parse(data); } catch (e) { /* ignore */ }
  }

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
    cachedProdutos = [];
  } else {
    cachedProdutos = (Array.isArray(produtos) ? produtos : [produtos])
      .filter((p: any) => p.codigo_produto || p.codigo);
  }

  cacheTimestamp = now;
  console.log('[Estoque Routes] Cached', cachedProdutos.length, 'products');
  return cachedProdutos;
}

export function registerEstoqueRoutes(router: Router) {

  // ============== CONTAGENS ==============
  
  // GET /api/estoques/contagens - Listar todas as contagens (Admin)
  router.get("/api/estoques/contagens", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      console.log('[Estoque Routes] GET /api/estoques/contagens - Listing contagens');
      
      // Buscar contagens com dados do responsável
      const conditions = [];
      if (status) {
        conditions.push(eq(estoquesContagens.status, status as string));
      }
      
      const contagens = await db.select({
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
      })
      .from(estoquesContagens)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(estoquesContagens.dataInicio))
      .limit(Number(limit))
      .offset(offset);
      
      // Contar total
      const totalCount = await db.select({ count: sql<number>`count(*)` })
        .from(estoquesContagens)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      res.json({
        success: true,
        data: contagens,
        total: totalCount[0]?.count || 0,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error: any) {
      console.error('[Estoque Routes] Error listing contagens:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/estoques/contagens/ativa - Contagem ativa do usuário
  router.get("/api/estoques/contagens/ativa", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      
      console.log('[Estoque Routes] GET /api/estoques/contagens/ativa - User:', userId);
      
      // Buscar contagem em andamento do usuário
      const contagem = await db.select({
        id: estoquesContagens.id,
        codigo: estoquesContagens.codigo,
        status: estoquesContagens.status,
        dataInicio: estoquesContagens.dataInicio,
        totalItensContados: estoquesContagens.totalItensContados,
        responsavelId: estoquesContagens.responsavelId,
      })
      .from(estoquesContagens)
      .where(
        and(
          eq(estoquesContagens.responsavelId, userId),
          eq(estoquesContagens.status, 'em_andamento')
        )
      )
      .limit(1);
      
      if (contagem.length === 0) {
        return res.json({ success: true, data: null });
      }
      
      res.json({ success: true, data: contagem[0] });
    } catch (error: any) {
      console.error('[Estoque Routes] Error fetching contagem ativa:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // POST /api/estoques/contagens - Iniciar nova contagem
  router.post("/api/estoques/contagens", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      
      console.log('[Estoque Routes] POST /api/estoques/contagens - User:', userId);
      
      // Verificar se já existe contagem em andamento
      const contagemExistente = await db.select({ id: estoquesContagens.id })
        .from(estoquesContagens)
        .where(
          and(
            eq(estoquesContagens.responsavelId, userId),
            eq(estoquesContagens.status, 'em_andamento')
          )
        )
        .limit(1);
      
      if (contagemExistente.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Já existe uma contagem em andamento. Finalize ou cancele antes de iniciar uma nova."
        });
      }
      
      // Gerar código: CNT-YYYYMMDD-XXX
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      
      // Buscar último código do dia
      const lastContagem = await db.select({ codigo: estoquesContagens.codigo })
        .from(estoquesContagens)
        .where(like(estoquesContagens.codigo, `CNT-${dateStr}-%`))
        .orderBy(desc(estoquesContagens.codigo))
        .limit(1);
      
      let seq = 1;
      if (lastContagem.length > 0) {
        const lastSeq = parseInt(lastContagem[0].codigo.split('-')[2], 10);
        seq = lastSeq + 1;
      }
      
      const codigo = `CNT-${dateStr}-${String(seq).padStart(3, '0')}`;
      
      // Criar contagem
      const novaContagem = await db.insert(estoquesContagens)
        .values({
          codigo,
          responsavelId: userId,
          status: 'em_andamento',
          dataInicio: new Date(),
          totalItensContados: 0,
        })
        .returning();
      
      // Criar log
      await db.insert(estoquesContagemLogs)
        .values({
          contagemId: novaContagem[0].id,
          userId,
          acao: 'contagem_iniciada',
          detalhes: { codigo },
        });
      
      console.log('[Estoque Routes] Contagem criada:', codigo);
      
      res.json({ success: true, data: novaContagem[0] });
    } catch (error: any) {
      console.error('[Estoque Routes] Error creating contagem:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // POST /api/estoques/contagens/:id/item - Adicionar item à contagem
  router.post("/api/estoques/contagens/:id/item", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { imei, metodoLeitura = 'manual' } = req.body;
      const { userId, isAdmin } = getSessionUser(req);
      
      console.log('[Estoque Routes] POST /api/estoques/contagens/:id/item - Contagem:', id, 'IMEI:', imei);
      
      // Validar IMEI (15 dígitos numéricos)
      if (!imei || !/^\d{15}$/.test(imei)) {
        return res.status(400).json({
          success: false,
          error: "IMEI inválido - deve ter 15 dígitos numéricos"
        });
      }
      
      // Buscar contagem
      const contagem = await db.select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);
      
      if (contagem.length === 0) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }
      
      // Verificar permissão (própria contagem ou admin)
      if (contagem[0].responsavelId !== userId && !isAdmin) {
        return res.status(403).json({ success: false, error: "Sem permissão para adicionar itens a esta contagem" });
      }
      
      // Verificar se contagem está em andamento
      if (contagem[0].status !== 'em_andamento') {
        return res.status(400).json({
          success: false,
          error: "Contagem não está mais em andamento"
        });
      }
      
      // Verificar duplicidade de IMEI na mesma contagem
      const itemExistente = await db.select({ id: estoquesContagemItens.id })
        .from(estoquesContagemItens)
        .where(
          and(
            eq(estoquesContagemItens.contagemId, id),
            eq(estoquesContagemItens.imei, imei)
          )
        )
        .limit(1);
      
      if (itemExistente.length > 0) {
        return res.status(400).json({
          success: false,
          error: `IMEI ${imei} já foi contado nesta contagem`
        });
      }
      
      // Buscar dados do produto no Omie pelo IMEI (se possível)
      let produtoData = null;
      try {
        // Tentar buscar produto pelo código ERP (primeiros 9 dígitos do IMEI podem ser o código)
        const params = [{
          pagina: 1,
          registros_por_pagina: 1,
          codigo_produto: imei.substring(0, 9) // Tentar usar parte do IMEI como código
        }];
        
        const omieData = await omieService.callApi("geral/produtos", "ListarProdutos", params);
        
        if (omieData?.produto_servico_cadastro) {
          const produtos = Array.isArray(omieData.produto_servico_cadastro)
            ? omieData.produto_servico_cadastro
            : [omieData.produto_servico_cadastro];
          
          if (produtos.length > 0) {
            produtoData = produtos[0];
          }
        }
      } catch (e) {
        console.log('[Estoque Routes] Produto não encontrado no Omie para IMEI:', imei);
      }
      
      // Inserir item
      const novoItem = await db.insert(estoquesContagemItens)
        .values({
          contagemId: id,
          imei,
          codigoErp: produtoData?.codigo_produto || null,
          modelo: produtoData?.descricao || null,
          categoria: produtoData?.categoria || null,
          marca: produtoData?.marca || null,
          metodoLeitura,
          contadoPor: userId,
        })
        .returning();
      
      // Atualizar total de itens contados
      await db.update(estoquesContagens)
        .set({
          totalItensContados: sql`${estoquesContagens.totalItensContados} + 1`,
          updatedAt: new Date()
        })
        .where(eq(estoquesContagens.id, id));
      
      // Criar log
      await db.insert(estoquesContagemLogs)
        .values({
          contagemId: id,
          userId,
          acao: 'item_adicionado',
          imei,
          detalhes: { metodoLeitura },
        });
      
      console.log('[Estoque Routes] Item adicionado:', imei);
      
      res.json({ success: true, data: novoItem[0] });
    } catch (error: any) {
      console.error('[Estoque Routes] Error adding item:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // GET /api/estoques/contagens/:id/itens - Listar itens da contagem
  router.get("/api/estoques/contagens/:id/itens", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, isAdmin } = getSessionUser(req);
      
      console.log('[Estoque Routes] GET /api/estoques/contagens/:id/itens - Contagem:', id);
      
      // Buscar contagem
      const contagem = await db.select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);
      
      if (contagem.length === 0) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }
      
      // Verificar permissão
      if (contagem[0].responsavelId !== userId && !isAdmin) {
        return res.status(403).json({ success: false, error: "Sem permissão para visualizar esta contagem" });
      }
      
      // Buscar itens
      const itens = await db.select({
        id: estoquesContagemItens.id,
        imei: estoquesContagemItens.imei,
        codigoErp: estoquesContagemItens.codigoErp,
        modelo: estoquesContagemItens.modelo,
        categoria: estoquesContagemItens.categoria,
        marca: estoquesContagemItens.marca,
        metodoLeitura: estoquesContagemItens.metodoLeitura,
        contadoEm: estoquesContagemItens.contadoEm,
      })
      .from(estoquesContagemItens)
      .where(eq(estoquesContagemItens.contagemId, id))
      .orderBy(desc(estoquesContagemItens.contadoEm));
      
      res.json({ success: true, data: itens });
    } catch (error: any) {
      console.error('[Estoque Routes] Error listing itens:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // POST /api/estoques/contagens/:id/finalizar - Finalizar contagem
  router.post("/api/estoques/contagens/:id/finalizar", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, isAdmin } = getSessionUser(req);
      
      console.log('[Estoque Routes] POST /api/estoques/contagens/:id/finalizar - Contagem:', id);
      
      // Buscar contagem
      const contagem = await db.select()
        .from(estoquesContagens)
        .where(eq(estoquesContagens.id, id))
        .limit(1);
      
      if (contagem.length === 0) {
        return res.status(404).json({ success: false, error: "Contagem não encontrada" });
      }
      
      // Verificar permissão (apenas o responsável pode finalizar)
      if (contagem[0].responsavelId !== userId) {
        return res.status(403).json({ success: false, error: "Apenas o responsável pode finalizar a contagem" });
      }
      
      // Verificar se contagem está em andamento
      if (contagem[0].status !== 'em_andamento') {
        return res.status(400).json({
          success: false,
          error: "Contagem não está mais em andamento"
        });
      }
      
      // Buscar total de itens no sistema (Omie)
      let totalItensSistema = 0;
      try {
        const params = [{ pagina: 1, registros_por_pagina: 500 }];
        const omieData = await omieService.callApi("geral/produtos", "ListarProdutos", params);
        
        if (omieData?.produto_servico_cadastro) {
          const produtos = Array.isArray(omieData.produto_servico_cadastro)
            ? omieData.produto_servico_cadastro
            : [omieData.produto_servico_cadastro];
          
          totalItensSistema = produtos.reduce((sum: number, p: any) => {
            return sum + parseInt(p.estoque_local || p.estoque || 0, 10);
          }, 0);
        }
      } catch (e) {
        console.log('[Estoque Routes] Erro ao buscar total do sistema:', e);
      }
      
      // Calcular divergência e acuracidade
      const totalContado = contagem[0].totalItensContados || 0;
      const divergencia = totalItensSistema - totalContado;
      const acuracidade = totalItensSistema > 0
        ? ((totalContado / totalItensSistema) * 100).toFixed(2)
        : '0.00';
      
      // Atualizar contagem
      const contagemFinalizada = await db.update(estoquesContagens)
        .set({
          status: 'finalizada',
          dataFim: new Date(),
          totalItensSistema,
          divergencia,
          acuracidade: acuracidade,
          updatedAt: new Date()
        })
        .where(eq(estoquesContagens.id, id))
        .returning();
      
      // Criar log
      await db.insert(estoquesContagemLogs)
        .values({
          contagemId: id,
          userId,
          acao: 'contagem_finalizada',
          detalhes: {
            totalItensContados: totalContado,
            totalItensSistema,
            divergencia,
            acuracidade
          },
        });
      
      console.log('[Estoque Routes] Contagem finalizada:', contagem[0].codigo);
      
      res.json({ success: true, data: contagemFinalizada[0] });
    } catch (error: any) {
      console.error('[Estoque Routes] Error finalizing contagem:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // ============== POSIÇÃO DE ESTOQUES ==============
  
  // GET /api/estoques/posicao - Obter posição de estoques
  router.get("/api/estoques/posicao", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { categoria, marca, modelo, codigoErp } = req.query;

      console.log('[Estoque Routes] GET /api/estoques/posicao - Fetching stock position');

      const produtosArray = await getCachedProdutos();

      if (produtosArray.length === 0) {
        return res.json({ success: true, data: [] });
      }

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

      const produtosArray = await getCachedProdutos();

      if (produtosArray.length === 0) {
        return res.json({
          success: true,
          data: { qtdeTotal: 0, valorTotal: 0, custoMedioUnitario: 0 }
        });
      }
      
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

      const produtosArray = await getCachedProdutos();

      if (produtosArray.length === 0) {
        return res.status(404).json({ error: "Nenhum produto encontrado" });
      }
      
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

      const produtosArray = await getCachedProdutos();

      if (produtosArray.length === 0) {
        return res.json({ success: true, data: [] });
      }

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

      const produtosArray = await getCachedProdutos();

      if (produtosArray.length === 0) {
        return res.json({ success: true, data: [] });
      }

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

      const produtosArray = await getCachedProdutos();

      if (produtosArray.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Extrair modelos únicos (usando descricao ou modelo)
      const modelos = [...new Set(produtosArray.map((p: any) => p.modelo || p.descricao).filter(Boolean))];
      
      res.json({ success: true, data: modelos.sort() });
    } catch (error: any) {
      console.error('[Estoque Routes] Error fetching modelos:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  console.log('[Estoque Routes] Routes registered successfully');
}
