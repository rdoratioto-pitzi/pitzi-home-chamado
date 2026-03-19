// worker/src/routes/omie.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getOmieService } from "../services/omie.service";
import { getCachedPosEstoque } from "../services/estoque-pos-cache";

const omie = new Hono<AppEnv>();

// Helper to get omie service from context
function getOmie(c: any) {
  return getOmieService(c.get("db"));
}

// ============== CONFIG ==============

// GET /api/omie/config
omie.get("/api/omie/config", async (c) => {
  try {
    const service = getOmie(c);
    const config = await service.getConfig();
    if (!config) {
      return c.json(
        { success: false, error: "Config not found", data: null },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        app_key: config.app_key || "",
        app_secret: config.app_secret || "",
        is_active: config.is_active,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/omie/config
omie.post("/api/omie/config", async (c) => {
  try {
    const service = getOmie(c);
    const { app_key, app_secret } = await c.req.json();

    if (!app_key || !app_secret) {
      return c.json(
        { success: false, error: "app_key and app_secret são obrigatórios" },
        400,
      );
    }

    await service.updateConfig(app_key, app_secret);
    return c.json({
      success: true,
      message: "Configuração atualizada com sucesso",
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============== TEST CONNECTION ==============

// POST /api/omie/test
omie.post("/api/omie/test", async (c) => {
  try {
    const service = getOmie(c);
    const result = await service.testConnection();
    return c.json({
      success: result.success,
      connected: result.success,
      message: result.message,
    });
  } catch (error: any) {
    return c.json(
      { success: false, connected: false, error: error.message },
      500,
    );
  }
});

// ============== SYNC LOGS ==============

// GET /api/omie/logs
omie.get("/api/omie/logs", async (c) => {
  try {
    const service = getOmie(c);
    const category = c.req.query("category");
    const limit = c.req.query("limit");
    const logs = await service.getSyncLogs(
      category || undefined,
      limit ? parseInt(limit, 10) : 50,
    );
    return c.json({ success: true, data: logs });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============== DIRECT API CALL ==============

// POST /api/omie/call
omie.post("/api/omie/call", async (c) => {
  try {
    const service = getOmie(c);
    const { endpoint, call, params, category } = await c.req.json();

    if (!endpoint || !call) {
      return c.json(
        { success: false, error: "endpoint e call são obrigatórios" },
        400,
      );
    }

    const startTime = Date.now();
    const data = await service.callApi(endpoint, call, params || []);
    const duration = Date.now() - startTime;

    await service.logSync({
      endpoint: `${endpoint}/${call}`,
      category: category || "geral",
      status: "success",
      total_records: Array.isArray(data)
        ? data.length
        : data?.total_de_registros || 1,
      request_params: { endpoint, call, params },
      response_data: data,
    });

    return c.json({ success: true, data, duration });
  } catch (error: any) {
    const body = await c.req
      .json()
      .catch(() => ({ endpoint: "unknown", call: "unknown" }));
    const service = getOmie(c);
    await service.logSync({
      endpoint: `${body.endpoint}/${body.call}`,
      category: body.category || "geral",
      status: "error",
      error_message: error.message,
      request_params: body,
    });

    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============== FINANÇAS ==============

// POST /api/omie/financas/contas-pagar
omie.post("/api/omie/financas/contas-pagar", async (c) => {
  try {
    const service = getOmie(c);
    const {
      nPagina = 1,
      nRegPorPagina = 50,
      dDtVencIni,
      dDtVencFim,
      cStatus,
    } = await c.req.json();

    const params: any = { nPagina, nRegPorPagina };
    if (dDtVencIni) params.dDtVencIni = dDtVencIni;
    if (dDtVencFim) params.dDtVencFim = dDtVencFim;
    if (cStatus && cStatus !== "ALL") params.cStatus = cStatus;

    const data = await service.callApi(
      "financas/contapagar/",
      "ListarContasPagar",
      [params],
    );

    const contas = (data.conta_pagar_cadastro || []).map((ct: any) => ({
      codigoLancamento: ct.codigo_lancamento_omie,
      numeroDocumento:
        ct.numero_documento_fiscal || ct.numero_documento || "-",
      codigoFornecedor: ct.codigo_cliente_fornecedor,
      nomeFornecedor: ct.nome_fornecedor || null,
      dataVencimento: ct.data_vencimento,
      dataPrevisao: ct.data_previsao,
      valorDocumento: ct.valor_documento || 0,
      valorBaixado: ct.valor_baixado || 0,
      saldo: (ct.valor_documento || 0) - (ct.valor_baixado || 0),
      statusTitulo: ct.status_titulo,
    }));

    const totalValor = contas.reduce(
      (s: number, ct: any) => s + ct.valorDocumento,
      0,
    );
    const totalPago = contas.reduce(
      (s: number, ct: any) => s + ct.valorBaixado,
      0,
    );
    const qtdVencidas = contas.filter(
      (ct: any) => ct.statusTitulo === "VENCIDO",
    ).length;
    const qtdPagas = contas.filter(
      (ct: any) => ct.statusTitulo === "PAGO",
    ).length;

    return c.json({
      sucesso: true,
      pagina: data.nPagina || data.pagina || 1,
      totalPaginas: data.nTotPaginas || data.total_de_paginas || 1,
      totalRegistros:
        data.nTotRegistros || data.total_de_registros || contas.length,
      resumo: {
        totalValor,
        totalPago,
        saldoAberto: totalValor - totalPago,
        qtdVencidas,
        qtdPagas,
      },
      contas,
    });
  } catch (error: any) {
    return c.json({ sucesso: false, error: error.message }, 500);
  }
});

// POST /api/omie/financas/contas-receber
omie.post("/api/omie/financas/contas-receber", async (c) => {
  try {
    const service = getOmie(c);
    const {
      nPagina = 1,
      nRegPorPagina = 50,
      dDtVencIni,
      dDtVencFim,
      cStatus,
    } = await c.req.json();

    const params: any = { nPagina, nRegPorPagina };
    if (dDtVencIni) params.dDtVencIni = dDtVencIni;
    if (dDtVencFim) params.dDtVencFim = dDtVencFim;
    if (cStatus && cStatus !== "ALL") params.cStatus = cStatus;

    const data = await service.callApi(
      "financas/contareceber/",
      "ListarContasReceber",
      [params],
    );

    const contas = (data.conta_receber_cadastro || []).map((ct: any) => ({
      codigoLancamento: ct.codigo_lancamento_omie,
      numeroDocumento:
        ct.numero_documento_fiscal || ct.numero_documento || "-",
      codigoCliente: ct.codigo_cliente_fornecedor,
      nomeCliente: ct.nome_cliente || null,
      dataVencimento: ct.data_vencimento,
      dataPrevisao: ct.data_previsao,
      valorDocumento: ct.valor_documento || 0,
      valorBaixado: ct.valor_baixado || 0,
      saldo: (ct.valor_documento || 0) - (ct.valor_baixado || 0),
      statusTitulo: ct.status_titulo,
    }));

    const totalValor = contas.reduce(
      (s: number, ct: any) => s + ct.valorDocumento,
      0,
    );
    const totalRecebido = contas.reduce(
      (s: number, ct: any) => s + ct.valorBaixado,
      0,
    );
    const qtdVencidas = contas.filter(
      (ct: any) => ct.statusTitulo === "VENCIDO",
    ).length;
    const qtdRecebidas = contas.filter(
      (ct: any) => ct.statusTitulo === "RECEBIDO",
    ).length;

    return c.json({
      sucesso: true,
      pagina: data.nPagina || data.pagina || 1,
      totalPaginas: data.nTotPaginas || data.total_de_paginas || 1,
      totalRegistros:
        data.nTotRegistros || data.total_de_registros || contas.length,
      resumo: {
        totalValor,
        totalRecebido,
        saldoAberto: totalValor - totalRecebido,
        qtdVencidas,
        qtdRecebidas,
      },
      contas,
    });
  } catch (error: any) {
    return c.json({ sucesso: false, error: error.message }, 500);
  }
});

// POST /api/omie/financas/resumo
omie.post("/api/omie/financas/resumo", async (c) => {
  try {
    const service = getOmie(c);
    const data = await service.callApi(
      "financas/resumo/",
      "ObterResumoFinancas",
      [{}],
    );
    return c.json({ sucesso: true, resumo: data });
  } catch (error: any) {
    return c.json({ sucesso: false, error: error.message }, 500);
  }
});

// ============== GERAL ==============

// POST /api/omie/geral/clientes
omie.post("/api/omie/geral/clientes", async (c) => {
  try {
    const service = getOmie(c);
    const {
      nPagina = 1,
      nRegPorPagina = 50,
      cnpj_cpf,
      razao_social,
      cidade,
      inativo,
    } = await c.req.json();

    const clientesFiltro: any = {};
    if (cnpj_cpf) clientesFiltro.cnpj_cpf = cnpj_cpf;
    if (razao_social) clientesFiltro.razao_social = razao_social;
    if (cidade) clientesFiltro.cidade = cidade;
    if (inativo && inativo !== "ALL") clientesFiltro.inativo = inativo;

    const params: any = {
      pagina: nPagina,
      registros_por_pagina: nRegPorPagina,
      apenas_importado_api: "N",
    };
    if (Object.keys(clientesFiltro).length > 0)
      params.clientesFiltro = clientesFiltro;

    const data = await service.callApi("geral/clientes/", "ListarClientes", [
      params,
    ]);

    const clientes = (data.clientes_cadastro || []).map((ct: any) => ({
      codigoOmie: ct.codigo_cliente_omie,
      codigoIntegracao: ct.codigo_cliente_integracao,
      razaoSocial: ct.razao_social,
      nomeFantasia: ct.nome_fantasia || null,
      cnpjCpf: ct.cnpj_cpf,
      email: ct.email || null,
      telefoneDdd: ct.telefone1_ddd || null,
      telefoneNumero: ct.telefone1_numero || null,
      cidade: ct.cidade,
      estado: ct.estado,
      inativo: ct.inativo === "S",
    }));

    const totalAtivos = clientes.filter((ct: any) => !ct.inativo).length;
    const totalInativos = clientes.filter((ct: any) => ct.inativo).length;

    return c.json({
      sucesso: true,
      pagina: data.pagina || 1,
      totalPaginas: data.total_de_paginas || 1,
      totalRegistros: data.total_de_registros || clientes.length,
      resumo: { totalAtivos, totalInativos },
      clientes,
    });
  } catch (error: any) {
    return c.json({ sucesso: false, error: error.message }, 500);
  }
});

// POST /api/omie/geral/categorias
omie.post("/api/omie/geral/categorias", async (c) => {
  try {
    const service = getOmie(c);
    const { nPagina = 1, nRegPorPagina = 500 } = await c.req.json();

    const data = await service.callApi(
      "geral/categorias/",
      "ListarCategorias",
      [{ pagina: nPagina, registros_por_pagina: nRegPorPagina }],
    );

    const categorias = (data.categoria_cadastro || []).map((ct: any) => ({
      codigo: ct.codigo,
      descricao: ct.descricao,
      tipo:
        ct.conta_receita === "S"
          ? "Receita"
          : ct.conta_despesa === "S"
            ? "Despesa"
            : "Outro",
      ativa: ct.conta_inativa !== "S",
    }));

    const totalReceitas = categorias.filter(
      (ct: any) => ct.tipo === "Receita",
    ).length;
    const totalDespesas = categorias.filter(
      (ct: any) => ct.tipo === "Despesa",
    ).length;
    const totalOutros = categorias.filter(
      (ct: any) => ct.tipo === "Outro",
    ).length;

    return c.json({
      sucesso: true,
      totalRegistros: data.total_de_registros || categorias.length,
      resumo: { totalReceitas, totalDespesas, totalOutros },
      categorias,
    });
  } catch (error: any) {
    return c.json({ sucesso: false, error: error.message }, 500);
  }
});

// GET /api/omie/geral/empresa
omie.get("/api/omie/geral/empresa", async (c) => {
  try {
    const service = getOmie(c);
    const data = await service.callApi("geral/empresas/", "ListarEmpresas", [
      { pagina: 1, registros_por_pagina: 1 },
    ]);

    const raw = data.empresas_cadastro?.[0] || null;
    if (!raw) {
      return c.json({ sucesso: true, empresa: null });
    }

    return c.json({
      sucesso: true,
      empresa: {
        codigoOmie: raw.codigo_empresa,
        razaoSocial: raw.razao_social,
        nomeFantasia: raw.nome_fantasia,
        cnpj: raw.cnpj,
        inscricaoEstadual: raw.inscricao_estadual,
        inscricaoMunicipal: raw.inscricao_municipal,
        regimeTributario: raw.regime_tributario,
        endereco: raw.endereco,
        enderecoNumero: raw.endereco_numero,
        complemento: raw.complemento,
        bairro: raw.bairro,
        cidade: raw.cidade,
        estado: raw.estado,
        cep: raw.cep,
        telefone: raw.telefone || raw.fax_numero,
        email: raw.email,
      },
    });
  } catch (error: any) {
    return c.json({ sucesso: false, error: error.message }, 500);
  }
});

// ============== ESTOQUE ==============

// GET /api/omie/estoque/posicao/:codigo
omie.get("/api/omie/estoque/posicao/:codigo", async (c) => {
  try {
    const service = getOmie(c);
    const codigo = c.req.param("codigo");

    const index = await getCachedPosEstoque(service);
    const entries =
      index.get(codigo.trim().toUpperCase()) ?? index.get(codigo.trim()) ?? [];

    const totalFisico = entries.reduce((s, e) => s + (e.fisico ?? 0), 0);
    const totalSaldo = entries.reduce((s, e) => s + (e.nSaldo ?? 0), 0);
    const totalReservado = entries.reduce(
      (s, e) => s + (e.reservado ?? 0),
      0,
    );

    return c.json({
      success: true,
      data: {
        codigo,
        descricao: entries[0]?.cDescricao ?? null,
        totalFisico,
        totalSaldo,
        totalReservado,
        locais: entries,
        fromCache: true,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export { omie };
