/**
 * Rotas para módulo de Avaliações Estéticas
 * Integra com API RenovSmart e persiste curadoria no PostgreSQL
 */
import { Router } from "express";
import { requireAuth, getSessionUser } from "../middleware/auth";
import {
  getTradeInsAvaliacoes,
  getTradeInById,
  getAvaliadores,
  calcularMetricasResumo,
  calcularEvolucaoTemporal,
  calcularRankingAvaliadores,
  calcularCustoErro,
  calcularMatrizConfusao,
  calcularImpactoFinanceiro,
  calcularRankingAvaliadorCompleto,
  calcularAvaliadorEvolucao,
  saveCuradoria,
  getCuradorias,
  getCuradoriaPendentes,
  getConfiguracoes,
  updateConfiguracoes,
  type AvaliacoesFilters,
} from "../services/renovsmart-avaliacoes";

export function registerAvaliacoesRoutes(router: Router) {
  // GET /api/avaliacoes/trade-ins — lista paginada com filtros
  router.get("/api/avaliacoes/trade-ins", requireAuth, async (req, res) => {
    try {
      const {
        data_inicio, data_fim, categoria, avaliador_id,
        page = "1", limit = "50",
      } = req.query;

      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);
      if (categoria) filtros.categoria = String(categoria);
      if (avaliador_id) filtros.avaliadorId = String(avaliador_id);

      const result = await getTradeInsAvaliacoes(filtros, parseInt(String(page)), parseInt(String(limit)));
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] trade-ins error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/trade-ins/:tradeInId — trade-in individual com imagens
  router.get("/api/avaliacoes/trade-ins/:tradeInId", requireAuth, async (req, res) => {
    try {
      const tradeInId = String(req.params.tradeInId);
      const item = await getTradeInById(tradeInId);
      if (!item) {
        return res.status(404).json({ success: false, error: "Trade-in não encontrado" });
      }
      res.json({ success: true, data: item });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] trade-in by id error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/avaliadores — lista de avaliadores humanos
  router.get("/api/avaliacoes/avaliadores", requireAuth, async (_req, res) => {
    try {
      const avaliadores = await getAvaliadores();
      res.json({ success: true, data: avaliadores });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] avaliadores error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // POST /api/avaliacoes/curadoria — salvar registro de curadoria
  router.post("/api/avaliacoes/curadoria", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const {
        tradeInId, gradeCorretaDisplay, gradeCorretaCarcaca,
        revisaoAvaliador, revisaoTipo, observacao,
        imei, modelo, categoria,
        gradeIaDisplay, gradeIaCarcaca, gradeHumanoDisplay, gradeHumanoCarcaca,
        avaliadorHumanoId, precoMaximo, dataTradeIn,
        imagemFrontal, imagemTraseira, imagemLateral1, imagemLateral2, imagemDetalhe,
        gradesPorFoto,
      } = req.body;

      if (!tradeInId) {
        return res.status(400).json({ success: false, error: "tradeInId é obrigatório" });
      }

      const saved = await saveCuradoria({
        tradeInId,
        imei: imei ?? null,
        modelo: modelo ?? null,
        categoria: categoria ?? null,
        gradeIaDisplay: gradeIaDisplay ?? null,
        gradeIaCarcaca: gradeIaCarcaca ?? null,
        gradeHumanoDisplay: gradeHumanoDisplay ?? null,
        gradeHumanoCarcaca: gradeHumanoCarcaca ?? null,
        avaliadorHumanoId: avaliadorHumanoId ?? null,
        gradeCorretaDisplay: gradeCorretaDisplay ?? null,
        gradeCorretaCarcaca: gradeCorretaCarcaca ?? null,
        revisaoAvaliador: revisaoAvaliador ?? false,
        revisaoTipo: revisaoTipo ?? null,
        curadorId: userId,
        observacao: observacao ?? null,
        dataTradeIn: dataTradeIn ? new Date(dataTradeIn) : null,
        precoMaximo: precoMaximo ? String(precoMaximo) : null,
        imagemFrontal: imagemFrontal ?? null,
        imagemTraseira: imagemTraseira ?? null,
        imagemLateral1: imagemLateral1 ?? null,
        imagemLateral2: imagemLateral2 ?? null,
        imagemDetalhe: imagemDetalhe ?? null,
        gradesPorFoto: gradesPorFoto ?? null,
        tenantId: null,
      });

      res.status(201).json({ success: true, data: saved });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] save curadoria error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/curadoria — registros de curadoria salvos
  router.get("/api/avaliacoes/curadoria", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim, curador_id, page = "1", limit = "50" } = req.query;
      const result = await getCuradorias(
        {
          dataInicio: data_inicio ? String(data_inicio) : undefined,
          dataFim: data_fim ? String(data_fim) : undefined,
          curadorId: curador_id ? String(curador_id) : undefined,
        },
        parseInt(String(page)),
        parseInt(String(limit))
      );
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] get curadorias error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/curadoria/pendentes — trade-ins pendentes de curadoria
  router.get("/api/avaliacoes/curadoria/pendentes", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const { start_date, end_date, categoria, imei, voucher } = req.query;
      const pendentes = await getCuradoriaPendentes(tenantId ?? null, {
        startDate: start_date ? String(start_date) : undefined,
        endDate: end_date ? String(end_date) : undefined,
        categoria: categoria ? String(categoria) : undefined,
        imei: imei ? String(imei) : undefined,
        voucher: voucher ? String(voucher) : undefined,
      });
      res.json({ success: true, data: pendentes, total: pendentes.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] pendentes error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/configuracoes — configurações atuais
  router.get("/api/avaliacoes/configuracoes", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const config = await getConfiguracoes(tenantId ?? null);
      res.json({ success: true, data: config });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] configuracoes error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // PUT /api/avaliacoes/configuracoes — atualizar configurações
  router.put("/api/avaliacoes/configuracoes", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const { percentualAmostragem, modoPrioridade } = req.body;
      const updated = await updateConfiguracoes(
        { percentualAmostragem: percentualAmostragem ? String(percentualAmostragem) : undefined, modoPrioridade: modoPrioridade ? String(modoPrioridade) : undefined },
        tenantId ?? null
      );
      res.json({ success: true, data: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] update configuracoes error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/configuracoes/versoes-ia — histórico completo de versões
  router.get("/api/avaliacoes/configuracoes/versoes-ia", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const config = await getConfiguracoes(tenantId ?? null);
      const versoes = (config as any).versoesIa ?? [];
      res.json({ success: true, data: versoes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/configuracoes/versao-ia — versão atual (mais recente)
  router.get("/api/avaliacoes/configuracoes/versao-ia", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const config = await getConfiguracoes(tenantId ?? null);
      const versoes: any[] = (config as any).versoesIa ?? [];
      res.json({ success: true, data: versoes[0] ?? null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      res.status(500).json({ success: false, error: message });
    }
  });

  // PUT /api/avaliacoes/configuracoes/versao-ia — adiciona nova versão no topo
  router.put("/api/avaliacoes/configuracoes/versao-ia", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const { data, versao, descricao } = req.body as { data: string; versao: string; descricao: string };
      if (!data || !versao || !descricao) {
        return res.status(400).json({ success: false, error: "data, versao e descricao são obrigatórios" });
      }
      const config = await getConfiguracoes(tenantId ?? null);
      const versoesAtuais: any[] = (config as any).versoesIa ?? [];
      const novasVersoes = [{ data, versao, descricao }, ...versoesAtuais];
      await updateConfiguracoes({ versoesIa: novasVersoes } as any, tenantId ?? null);
      res.json({ success: true, data: novasVersoes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      res.status(500).json({ success: false, error: message });
    }
  });

  // DELETE /api/avaliacoes/configuracoes/versoes-ia/:index — remove versão pelo índice
  router.delete("/api/avaliacoes/configuracoes/versoes-ia/:index", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).session ?? {};
      const idx = parseInt(String(req.params.index), 10);
      const config = await getConfiguracoes(tenantId ?? null);
      const versoesAtuais: any[] = (config as any).versoesIa ?? [];
      if (isNaN(idx) || idx < 0 || idx >= versoesAtuais.length) {
        return res.status(400).json({ success: false, error: "Índice inválido" });
      }
      const novasVersoes = versoesAtuais.filter((_, i) => i !== idx);
      await updateConfiguracoes({ versoesIa: novasVersoes } as any, tenantId ?? null);
      res.json({ success: true, data: novasVersoes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/resumo — KPIs de acurácia
  router.get("/api/avaliacoes/metricas/resumo", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim, categoria, area } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);
      if (categoria) filtros.categoria = String(categoria);
      if (area) filtros.area = String(area) as AvaliacoesFilters["area"];

      const metricas = await calcularMetricasResumo(filtros);
      res.json({ success: true, data: metricas });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] metricas resumo error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/evolucao — dados temporais de acurácia
  router.get("/api/avaliacoes/metricas/evolucao", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim, granularidade } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);
      if (granularidade) filtros.granularidade = String(granularidade) as AvaliacoesFilters["granularidade"];

      const evolucao = await calcularEvolucaoTemporal(filtros);
      res.json({ success: true, data: evolucao });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] metricas evolucao error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/ranking-avaliadores — ranking por acurácia
  router.get("/api/avaliacoes/metricas/ranking-avaliadores", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);

      const ranking = await calcularRankingAvaliadores(filtros);
      res.json({ success: true, data: ranking });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] ranking avaliadores error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/custo-erro — custo financeiro dos erros de avaliação
  router.get("/api/avaliacoes/metricas/custo-erro", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);

      const custo = await calcularCustoErro(filtros);
      res.json({ success: true, data: custo });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] custo erro error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/matriz-confusao — matriz cruzada de grades
  router.get("/api/avaliacoes/metricas/matriz-confusao", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim, tipo, area, categoria } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);
      if (tipo) filtros.tipo = String(tipo) as AvaliacoesFilters["tipo"];
      if (area) filtros.area = String(area) as AvaliacoesFilters["area"];
      if (categoria) filtros.categoria = String(categoria);

      const matriz = await calcularMatrizConfusao(filtros);
      res.json({ success: true, data: matriz });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] matriz confusao error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/impacto-financeiro — impacto bidirecional com voucher real
  router.get("/api/avaliacoes/metricas/impacto-financeiro", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);

      const impacto = await calcularImpactoFinanceiro(filtros);
      res.json({ success: true, data: impacto });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] impacto financeiro error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/ranking-avaliadores-completo — ranking com nomes reais + flag automática
  router.get("/api/avaliacoes/metricas/ranking-avaliadores-completo", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);

      const ranking = await calcularRankingAvaliadorCompleto(filtros);
      res.json({ success: true, data: ranking });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] ranking completo error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // GET /api/avaliacoes/metricas/avaliadores-evolucao — evolução temporal por avaliador
  router.get("/api/avaliacoes/metricas/avaliadores-evolucao", requireAuth, async (req, res) => {
    try {
      const { data_inicio, data_fim, granularidade = "dia" } = req.query;
      const filtros: AvaliacoesFilters = {};
      if (data_inicio) filtros.dataInicio = String(data_inicio);
      if (data_fim) filtros.dataFim = String(data_fim);

      const evolucao = await calcularAvaliadorEvolucao(filtros, String(granularidade) as "dia" | "mes");
      res.json({ success: true, data: evolucao });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro interno";
      console.error("[Avaliacoes] avaliadores evolucao error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });
}
