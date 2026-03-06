/**
 * Rotas para módulo de Estoques
 * Integração com API Omie para posição de estoques
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import { omieService } from "../services/omie.service";
import ExcelJS from "exceljs";

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
  
  console.log('[Estoque Routes] Routes registered successfully');
}
