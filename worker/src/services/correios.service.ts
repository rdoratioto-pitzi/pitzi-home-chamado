// worker/src/services/correios.service.ts
// Factory pattern — replaces Express singleton correios-service.ts
// Uses native fetch instead of axios, env bindings instead of process.env

// URLs do Web Service SOAP de Logística Reversa
const CORREIOS_LR_HOMOLOGACAO_URL =
  "https://apphom.correios.com.br/logisticaReversaWS/logisticaReversaService/logisticaReversaWS";
const CORREIOS_LR_PRODUCAO_URL =
  "https://apps.correios.com.br/logisticaReversaWS/logisticaReversaService/logisticaReversaWS";

// URLs da API CWS (Correios Web Services) - REST
const CWS_PRODUCTION_URL = "https://api.correios.com.br";
const CWS_TOKEN_URL =
  "https://api.correios.com.br/token/v1/autentica/cartaopostagem";

// Credenciais de homologação (para testes)
const HOMOLOGACAO_CREDENTIALS = {
  usuario: "empresacws",
  senha: "123456",
  codAdministrativo: "17000190",
  contrato: "9992157880",
  cartaoPostagem: "0011111111",
  codigoServico: "04677",
};

// API 250 = Logística Reversa
const API_LOGISTICA_REVERSA = 250;

// ============== Interfaces ==============

interface CorreiosEnv {
  CORREIOS_USUARIO: string;
  CORREIOS_SENHA: string;
  CORREIOS_CARTAO_POSTAGEM: string;
  CORREIOS_COD_ADMINISTRATIVO: string;
  CORREIOS_TOKEN: string;
  CORREIOS_HOMOLOGACAO: string;
}

interface CorreiosCredentials {
  usuario: string;
  senha: string;
  cartaoPostagem: string;
  codAdministrativo: string;
  token: string;
}

export interface Destinatario {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  referencia?: string;
  cidade: string;
  uf: string;
  cep: string;
  ddd?: string;
  telefone?: string;
  celular?: string;
  ddd_celular?: string;
  email?: string;
  identificacao?: string;
  ciencia_conteudo_proibido: string;
}

export interface Remetente {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  referencia?: string;
  ddd: string;
  telefone: string;
  email: string;
  celular?: string;
  ddd_celular?: string;
  sms?: string;
  identificacao?: string;
  documento_estrangeiro?: string;
  restricao_anac: string;
}

export interface ObjetoColeta {
  item: number;
  id?: string;
  desc?: string;
  entrega?: string;
  num?: string;
}

export interface ProdutoEmbalagem {
  codigo: string;
  tipo: string;
  qtd: number;
}

export interface ColetaSolicitada {
  tipo: "A" | "C" | "CA";
  numero?: string;
  id_cliente?: string;
  ag?: string;
  cartao?: string;
  valor_declarado?: number;
  servico_adicional?: string;
  descricao?: string;
  ar?: number;
  cklist?: string;
  documento?: string[];
  remetente: Remetente;
  obj_col?: ObjetoColeta[];
  produto?: ProdutoEmbalagem;
}

export interface SolicitarPostagemReversaParams {
  codigo_servico: string;
  destinatario: Destinatario;
  coletas_solicitadas: ColetaSolicitada[];
  produto?: ProdutoEmbalagem;
}

export interface SolicitarPostagemReversaResponse {
  status_processamento: string;
  data_processamento: string;
  hora_processamento: string;
  cod_erro: string;
  msg_erro: string;
  resultado_solicitacao: Array<{
    tipo: string;
    id_cliente: string;
    numero_coleta: string;
    numero_etiqueta: string;
    id_obj: string;
    status_objeto: string;
    prazo: string;
    data_solicitacao: string;
    hora_solicitacao: string;
    codigo_erro: string;
    descricao_erro: string;
  }>;
}

export interface CancelarPedidoParams {
  numeroPedido: string;
  tipo: "A" | "C";
}

export interface CancelarPedidoResponse {
  codigo_administrativo: string;
  objeto_postal: {
    numero_pedido: string;
    status_pedido: string;
    datahora_cancelamento: string;
  };
}

export interface AcompanharPedidoParams {
  tipoBusca: "T" | "P" | "U";
  tipoSolicitacao: "A" | "C";
  numeroPedido: string;
}

export interface HistoricoEvento {
  status: string;
  descricao_status: string;
  data_atualizacao: string;
  hora_atualizacao: string;
  observacao: string;
}

export interface ObjetoRastreio {
  numero_etiqueta: string;
  controle_objeto_cliente: string;
  ultimo_status: string;
  descricao_status: string;
  data_ultima_atualizacao: string;
  hora_ultima_atualizacao: string;
}

export interface AcompanharPedidoResponse {
  codigo_administrativo: string;
  tipo_solicitacao: string;
  coleta: {
    numero_pedido: string;
    controle_cliente: string;
    historico: HistoricoEvento[];
    objeto: ObjetoRastreio[];
  };
}

export interface AcompanharPedidoPorDataParams {
  tipoSolicitacao: "A" | "C";
  data: string; // Format: DD/MM/YYYY
}

export interface ColetaData {
  numero_pedido: string;
  controle_cliente: string;
  historico: HistoricoEvento[];
  objeto: ObjetoRastreio[];
}

export interface AcompanharPedidoPorDataResponse {
  codigo_administrativo: string;
  tipo_solicitacao: string;
  coletas: ColetaData[];
}

export interface RevalidarPrazoParams {
  numeroPedido: string;
  qtdeDias: number;
}

export interface RevalidarPrazoResponse {
  numero_pedido?: string;
  prazo?: string;
  cod_erro?: string;
  msg_erro?: string;
}

export interface SolicitarRangeParams {
  tipo: "AP";
  servico?: "LE" | "LS" | "LV";
  quantidade: number;
}

export interface SolicitarRangeResponse {
  data: string;
  hora: string;
  cod_erro: string;
  faixa_inicial: string;
  faixa_final: string;
}

export interface CalcularDigitoVerificadorParams {
  numero: string;
}

export interface CalcularDigitoVerificadorResponse {
  data: string;
  hora: string;
  cod_erro: string;
  digito: string;
  numero: string;
}

export interface ColetaSimultanea {
  tipo: "C";
  id_cliente?: string;
  valor_declarado?: number;
  descricao?: string;
  cklist?: string;
  documento?: string[];
  remetente: Remetente;
  obj: string;
}

export interface SolicitarPostagemSimultaneaParams {
  codigo_servico: string;
  destinatario: Destinatario;
  coletas_solicitadas: ColetaSimultanea[];
}

export interface SolicitarPostagemSimultaneaResponse {
  status_processamento: string;
  data_processamento: string;
  hora_processamento: string;
  cod_erro: string;
  msg_erro: string;
  resultado_solicitacao: Array<{
    tipo: string;
    id_cliente: string;
    numero_coleta: string;
    numero_etiqueta: string;
    status_objeto: string;
    prazo: string;
    data_solicitacao: string;
    hora_solicitacao: string;
    codigo_erro: string;
    descricao_erro: string;
  }>;
}

export interface CorreiosService {
  getConfig(): {
    configured: boolean;
    cartaoPostagem: string;
    codAdministrativo: string;
    usuario: string;
  };
  checkApi250Status(): Promise<{
    authenticated: boolean;
    api250Enabled: boolean;
    availableApis: number[];
    message: string;
  }>;
  solicitarPostagemReversa(
    params: SolicitarPostagemReversaParams,
  ): Promise<SolicitarPostagemReversaResponse>;
  cancelarPedido(
    params: CancelarPedidoParams,
  ): Promise<CancelarPedidoResponse>;
  acompanharPedido(
    params: AcompanharPedidoParams,
  ): Promise<AcompanharPedidoResponse>;
  acompanharPedidoPorData(
    params: AcompanharPedidoPorDataParams,
  ): Promise<AcompanharPedidoPorDataResponse>;
  revalidarPrazoAutorizacaoPostagem(
    params: RevalidarPrazoParams,
  ): Promise<RevalidarPrazoResponse>;
  solicitarRange(
    params: SolicitarRangeParams,
  ): Promise<SolicitarRangeResponse>;
  calcularDigitoVerificador(
    params: CalcularDigitoVerificadorParams,
  ): Promise<CalcularDigitoVerificadorResponse>;
  solicitarPostagemSimultanea(
    params: SolicitarPostagemSimultaneaParams,
  ): Promise<SolicitarPostagemSimultaneaResponse>;
}

// ============== Error codes & status maps ==============

export const CORREIOS_ERROR_CODES: Record<string, string> = {
  "0": "Sucesso",
  "00": "Sucesso",
  "-1": "Falha no sistema. Tente novamente mais tarde.",
  "-2": "Erro de comunicação com o servidor dos Correios.",
  "-3": "Usuário ou senha inválidos.",
  "-4": "Código administrativo inválido ou não autorizado.",
  "-5": "CEP de origem ou destino inválido.",
  "-6": "CEP fora da área de cobertura para coleta domiciliar.",
  "-7": "Serviço não disponível para o CEP informado.",
  "-8": "Prazo de postagem expirado.",
  "-9": "Pedido já cancelado anteriormente.",
  "-10": "Número do pedido não encontrado.",
  "-11": "Não é possível cancelar pedido já coletado.",
  "-12": "Objeto já possui etiqueta vinculada.",
  "-13": "Limite máximo de objetos por solicitação excedido (máx. 50).",
  "-14": "Dados do remetente incompletos ou inválidos.",
  "-15": "Dados do destinatário incompletos ou inválidos.",
  "-16": "Tipo de solicitação inválido. Use 'A' (Autorização) ou 'C' (Coleta).",
  "-17": "Código de serviço inválido.",
  "-18": "Valor declarado acima do limite permitido.",
  "-19": "Objeto com peso ou dimensões acima do permitido.",
  "-20": "Range de etiquetas esgotado.",
  "111": "Coleta domiciliar não disponível para esta localidade. Utilize Autorização de Postagem.",
  "112": "CEP não atendido pelo serviço selecionado.",
  "113": "Dados obrigatórios não preenchidos.",
  "114": "Formato de dados inválido.",
  "999": "Erro interno nos Correios. Tente novamente mais tarde.",
};

function getCorreiosErrorMessage(code: string): string {
  return CORREIOS_ERROR_CODES[code] || `Erro desconhecido (código: ${code})`;
}

// ============== XML helpers (no xml2js dependency) ==============

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function optionalTag(tag: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  return `<${tag}>${escapeXml(value)}</${tag}>`;
}

function requiredTag(tag: string, value: string): string {
  return `<${tag}>${escapeXml(value)}</${tag}>`;
}

/** Minimal XML text-content extractor — finds the text between the first matching open/close tags */
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/** Extract all occurrences of a tag block */
function extractAllBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(
    `<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
    "gi",
  );
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

// ============== Factory ==============

export function getCorreiosService(env: CorreiosEnv): CorreiosService {
  const useHomologacao = env.CORREIOS_HOMOLOGACAO === "true";

  // Token cache (per-request lifetime in Workers, but helps within a single invocation)
  let cachedToken: {
    token: string;
    expiration: Date;
    apis: number[];
  } | null = null;

  function getLogisticaReversaUrl(): string {
    return useHomologacao
      ? CORREIOS_LR_HOMOLOGACAO_URL
      : CORREIOS_LR_PRODUCAO_URL;
  }

  function getCredentials(): CorreiosCredentials {
    return {
      usuario: env.CORREIOS_USUARIO || "",
      senha: env.CORREIOS_SENHA || "",
      cartaoPostagem: env.CORREIOS_CARTAO_POSTAGEM || "",
      codAdministrativo: env.CORREIOS_COD_ADMINISTRATIVO || "",
      token: env.CORREIOS_TOKEN || "",
    };
  }

  function getAccessCode(credentials: CorreiosCredentials): string {
    const { senha, token } = credentials;
    if (senha && senha.length === 40) return senha;
    if (token && token.length === 40) return token;
    return senha || "";
  }

  function maskValue(value: string): string {
    if (!value || value.length < 4) return value ? "****" : "";
    return value.slice(0, 2) + "****" + value.slice(-2);
  }

  // ---------- REST auth ----------

  async function getAuthToken(): Promise<string> {
    if (
      cachedToken &&
      cachedToken.expiration > new Date(Date.now() + 5 * 60 * 1000)
    ) {
      return cachedToken.token;
    }

    const credentials = getCredentials();
    const accessCode = getAccessCode(credentials);
    const authString = btoa(`${credentials.usuario}:${accessCode}`);

    const response = await fetch(CWS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify({ numero: credentials.cartaoPostagem }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Credenciais inválidas. Verifique CORREIOS_USUARIO (CNPJ) e CORREIOS_SENHA (código de acesso de 40 caracteres).",
        );
      }
      if (response.status === 403) {
        throw new Error(
          "Acesso negado. Verifique se seu contrato possui acesso às APIs.",
        );
      }
      throw new Error(
        `Erro de autenticação: ${response.status} - ${responseText}`,
      );
    }

    const data = JSON.parse(responseText);
    const expirationTime = data.expiraEm
      ? new Date(data.expiraEm)
      : new Date(Date.now() + 60 * 60 * 1000);
    const apisDisponiveis: number[] = data.cartaoPostagem?.api || [];

    cachedToken = {
      token: data.token,
      expiration: expirationTime,
      apis: apisDisponiveis,
    };

    return data.token;
  }

  // ---------- SOAP helper ----------

  async function makeSOAPRequest(
    soapBody: string,
    _soapAction: string,
  ): Promise<string> {
    const soapUrl = getLogisticaReversaUrl();

    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ser="http://service.logisticareversa.correios.com.br/">
  <soapenv:Header/>
  <soapenv:Body>
    ${soapBody}
  </soapenv:Body>
</soapenv:Envelope>`;

    const creds = useHomologacao
      ? {
          usuario: HOMOLOGACAO_CREDENTIALS.usuario,
          senha: HOMOLOGACAO_CREDENTIALS.senha,
        }
      : (() => {
          const c = getCredentials();
          return { usuario: c.usuario, senha: getAccessCode(c) };
        })();

    const authString = btoa(`${creds.usuario}:${creds.senha}`);

    const response = await fetch(soapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
        Authorization: `Basic ${authString}`,
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();

    if (!response.ok) {
      const soapFaultMatch = responseText.match(
        /<faultstring>([^<]+)<\/faultstring>/,
      );
      if (response.status === 401) {
        throw new Error("Credenciais inválidas.");
      }
      if (soapFaultMatch) {
        throw new Error(`Correios: ${soapFaultMatch[1]}`);
      }
      throw new Error(
        `Erro HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return responseText;
  }

  // ---------- XML builders for common structures ----------

  function buildRemetenteXml(rem: Remetente): string {
    return `<remetente>
  ${requiredTag("nome", rem.nome)}
  ${requiredTag("logradouro", rem.logradouro)}
  ${requiredTag("numero", rem.numero)}
  ${optionalTag("complemento", rem.complemento)}
  ${requiredTag("bairro", rem.bairro)}
  ${requiredTag("cidade", rem.cidade)}
  ${requiredTag("uf", rem.uf)}
  ${requiredTag("cep", rem.cep)}
  ${optionalTag("referencia", rem.referencia)}
  ${requiredTag("ddd", rem.ddd)}
  ${requiredTag("telefone", rem.telefone)}
  ${requiredTag("email", rem.email)}
  ${optionalTag("celular", rem.celular)}
  ${optionalTag("ddd_celular", rem.ddd_celular)}
  ${optionalTag("sms", rem.sms)}
  ${optionalTag("identificacao", rem.identificacao)}
  ${optionalTag("documento_estrangeiro", rem.documento_estrangeiro)}
  ${requiredTag("restricao_anac", rem.restricao_anac)}
</remetente>`;
  }

  function buildDestinatarioXml(dest: Destinatario): string {
    return `<destinatario>
  ${requiredTag("nome", dest.nome)}
  ${requiredTag("logradouro", dest.logradouro)}
  ${requiredTag("numero", dest.numero)}
  ${optionalTag("complemento", dest.complemento)}
  ${requiredTag("bairro", dest.bairro)}
  ${optionalTag("referencia", dest.referencia)}
  ${requiredTag("cidade", dest.cidade)}
  ${requiredTag("uf", dest.uf)}
  ${requiredTag("cep", dest.cep)}
  ${optionalTag("ddd", dest.ddd)}
  ${optionalTag("telefone", dest.telefone)}
  ${optionalTag("celular", dest.celular)}
  ${optionalTag("ddd_celular", dest.ddd_celular)}
  ${optionalTag("email", dest.email)}
  ${optionalTag("identificacao", dest.identificacao)}
  ${requiredTag("ciencia_conteudo_proibido", dest.ciencia_conteudo_proibido)}
</destinatario>`;
  }

  // ============== Public methods ==============

  function getConfig() {
    const credentials = getCredentials();
    return {
      configured: !!(
        credentials.usuario &&
        credentials.senha &&
        credentials.cartaoPostagem &&
        credentials.codAdministrativo
      ),
      cartaoPostagem: maskValue(credentials.cartaoPostagem),
      codAdministrativo: maskValue(credentials.codAdministrativo),
      usuario: maskValue(credentials.usuario),
    };
  }

  async function checkApi250Status() {
    try {
      cachedToken = null;
      await getAuthToken();
      const api250Enabled =
        cachedToken?.apis?.includes(API_LOGISTICA_REVERSA) ?? false;
      const availableApis = cachedToken?.apis ?? [];

      return {
        authenticated: true,
        api250Enabled,
        availableApis,
        message: api250Enabled
          ? "API de Logística Reversa (250) está HABILITADA!"
          : `API de Logística Reversa (250) NÃO está habilitada. APIs disponíveis: ${availableApis.join(", ")}`,
      };
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Erro desconhecido";
      return {
        authenticated: false,
        api250Enabled: false,
        availableApis: [] as number[],
        message: `Erro na autenticação: ${msg}`,
      };
    }
  }

  async function solicitarPostagemReversa(
    params: SolicitarPostagemReversaParams,
  ): Promise<SolicitarPostagemReversaResponse> {
    const creds = useHomologacao
      ? {
          cartaoPostagem: HOMOLOGACAO_CREDENTIALS.cartaoPostagem,
          codAdministrativo: HOMOLOGACAO_CREDENTIALS.codAdministrativo,
        }
      : {
          cartaoPostagem: getCredentials().cartaoPostagem,
          codAdministrativo: getCredentials().codAdministrativo,
        };

    const codigoServico = useHomologacao
      ? HOMOLOGACAO_CREDENTIALS.codigoServico
      : params.codigo_servico;

    const coletasXML = params.coletas_solicitadas
      .map((coleta) => {
        const objColXML =
          coleta.obj_col
            ?.map(
              (obj) => `<obj_col>
          ${requiredTag("item", String(obj.item).padStart(2, "0"))}
          ${optionalTag("id", obj.id)}
          ${optionalTag("desc", obj.desc)}
          ${optionalTag("entrega", obj.entrega)}
          ${optionalTag("num", obj.num)}
        </obj_col>`,
            )
            .join("") || "";

        return `<coletas_solicitadas>
      ${requiredTag("tipo", coleta.tipo)}
      <numero>${coleta.numero ? escapeXml(coleta.numero) : ""}</numero>
      ${optionalTag("id_cliente", coleta.id_cliente)}
      ${optionalTag("ag", coleta.ag)}
      ${optionalTag("cartao", coleta.cartao)}
      ${coleta.valor_declarado !== undefined ? `<valor_declarado>${coleta.valor_declarado.toFixed(2)}</valor_declarado>` : ""}
      ${optionalTag("descricao", coleta.descricao)}
      ${coleta.ar !== undefined ? `<ar>${coleta.ar}</ar>` : ""}
      ${optionalTag("cklist", coleta.cklist)}
      ${coleta.documento?.map((d) => `<documento>${escapeXml(d)}</documento>`).join("") || ""}
      ${buildRemetenteXml(coleta.remetente)}
      ${objColXML}
    </coletas_solicitadas>`;
      })
      .join("");

    const produtoXml = params.produto
      ? `<produto>
        ${requiredTag("codigo", params.produto.codigo)}
        ${requiredTag("tipo", params.produto.tipo)}
        <qtd>${params.produto.qtd}</qtd>
      </produto>`
      : "";

    const soapBody = `
    <ser:solicitarPostagemReversa>
      ${requiredTag("codAdministrativo", creds.codAdministrativo)}
      ${requiredTag("codigo_servico", codigoServico)}
      ${requiredTag("cartao", creds.cartaoPostagem)}
      ${buildDestinatarioXml(params.destinatario)}
      ${produtoXml}
      ${coletasXML}
    </ser:solicitarPostagemReversa>`;

    const responseXml = await makeSOAPRequest(
      soapBody,
      "solicitarPostagemReversa",
    );

    // Extract response from SOAP body
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const solicitarContent =
      extractTag(bodyContent, "solicitarPostagemReversa");

    if (!solicitarContent) {
      throw new Error("Invalid response from Correios API");
    }

    const resultadoBlocks = extractAllBlocks(
      solicitarContent,
      "resultado_solicitacao",
    );

    const resultados = resultadoBlocks.map((block) => ({
      tipo: extractTag(block, "tipo"),
      id_cliente: extractTag(block, "id_cliente"),
      numero_coleta: extractTag(block, "numero_coleta"),
      numero_etiqueta: extractTag(block, "numero_etiqueta"),
      id_obj: extractTag(block, "id_obj"),
      status_objeto: extractTag(block, "status_objeto"),
      prazo: extractTag(block, "prazo"),
      data_solicitacao: extractTag(block, "data_solicitacao"),
      hora_solicitacao: extractTag(block, "hora_solicitacao"),
      codigo_erro: extractTag(block, "codigo_erro"),
      descricao_erro: extractTag(block, "codigo_erro")
        ? getCorreiosErrorMessage(extractTag(block, "codigo_erro"))
        : extractTag(block, "descricao_erro"),
    }));

    return {
      status_processamento:
        extractTag(solicitarContent, "status_processamento"),
      data_processamento: extractTag(solicitarContent, "data_processamento"),
      hora_processamento: extractTag(solicitarContent, "hora_processamento"),
      cod_erro: extractTag(solicitarContent, "cod_erro"),
      msg_erro: extractTag(solicitarContent, "msg_erro"),
      resultado_solicitacao: resultados,
    };
  }

  async function cancelarPedido(
    params: CancelarPedidoParams,
  ): Promise<CancelarPedidoResponse> {
    const codAdmin = useHomologacao
      ? HOMOLOGACAO_CREDENTIALS.codAdministrativo
      : getCredentials().codAdministrativo;

    const soapBody = `
    <ser:cancelarPedido>
      ${requiredTag("codAdministrativo", codAdmin)}
      ${requiredTag("numeroPedido", params.numeroPedido)}
      ${requiredTag("tipo", params.tipo)}
    </ser:cancelarPedido>`;

    const responseXml = await makeSOAPRequest(soapBody, "cancelarPedido");
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const cancelarContent = extractTag(bodyContent, "cancelarPedido");

    if (!cancelarContent) {
      throw new Error("Invalid response from Correios API");
    }

    const objetoPostal = extractTag(cancelarContent, "objeto_postal");

    return {
      codigo_administrativo: extractTag(
        cancelarContent,
        "codigo_administrativo",
      ),
      objeto_postal: {
        numero_pedido: extractTag(objetoPostal, "numero_pedido"),
        status_pedido: extractTag(objetoPostal, "status_pedido"),
        datahora_cancelamento: extractTag(
          objetoPostal,
          "datahora_cancelamento",
        ),
      },
    };
  }

  async function acompanharPedido(
    params: AcompanharPedidoParams,
  ): Promise<AcompanharPedidoResponse> {
    const codAdmin = useHomologacao
      ? HOMOLOGACAO_CREDENTIALS.codAdministrativo
      : getCredentials().codAdministrativo;

    const soapBody = `
    <ser:acompanharPedido>
      ${requiredTag("codAdministrativo", codAdmin)}
      ${requiredTag("tipoBusca", params.tipoBusca)}
      ${requiredTag("tipoSolicitacao", params.tipoSolicitacao)}
      ${requiredTag("numeroPedido", params.numeroPedido)}
    </ser:acompanharPedido>`;

    const responseXml = await makeSOAPRequest(soapBody, "acompanharPedido");
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const acompanharContent = extractTag(bodyContent, "acompanharPedido");

    if (!acompanharContent) {
      throw new Error("Invalid response from Correios API");
    }

    const coletaContent = extractTag(acompanharContent, "coleta");
    const historicoBlocks = extractAllBlocks(coletaContent, "historico");
    const objetoBlocks = extractAllBlocks(coletaContent, "objeto");

    return {
      codigo_administrativo: extractTag(
        acompanharContent,
        "codigo_administrativo",
      ),
      tipo_solicitacao: extractTag(acompanharContent, "tipo_solicitacao"),
      coleta: {
        numero_pedido: extractTag(coletaContent, "numero_pedido"),
        controle_cliente: extractTag(coletaContent, "controle_cliente"),
        historico: historicoBlocks.map((h) => ({
          status: extractTag(h, "status"),
          descricao_status: extractTag(h, "descricao_status"),
          data_atualizacao: extractTag(h, "data_atualizacao"),
          hora_atualizacao: extractTag(h, "hora_atualizacao"),
          observacao: extractTag(h, "observacao"),
        })),
        objeto: objetoBlocks.map((o) => ({
          numero_etiqueta: extractTag(o, "numero_etiqueta"),
          controle_objeto_cliente: extractTag(o, "controle_objeto_cliente"),
          ultimo_status: extractTag(o, "ultimo_status"),
          descricao_status: extractTag(o, "descricao_status"),
          data_ultima_atualizacao: extractTag(o, "data_ultima_atualizacao"),
          hora_ultima_atualizacao: extractTag(o, "hora_ultima_atualizacao"),
        })),
      },
    };
  }

  async function acompanharPedidoPorData(
    params: AcompanharPedidoPorDataParams,
  ): Promise<AcompanharPedidoPorDataResponse> {
    const codAdmin = useHomologacao
      ? HOMOLOGACAO_CREDENTIALS.codAdministrativo
      : getCredentials().codAdministrativo;

    const soapBody = `
    <ser:acompanharPedidoPorData>
      ${requiredTag("codAdministrativo", codAdmin)}
      ${requiredTag("tipoSolicitacao", params.tipoSolicitacao)}
      ${requiredTag("data", params.data)}
    </ser:acompanharPedidoPorData>`;

    const responseXml = await makeSOAPRequest(
      soapBody,
      "acompanharPedidoPorData",
    );
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const acompanharContent = extractTag(
      bodyContent,
      "acompanharPedidoPorData",
    );

    if (!acompanharContent) {
      throw new Error("Invalid response from Correios API");
    }

    const coletaBlocks = extractAllBlocks(acompanharContent, "coleta");

    return {
      codigo_administrativo: extractTag(
        acompanharContent,
        "codigo_administrativo",
      ),
      tipo_solicitacao: extractTag(acompanharContent, "tipo_solicitacao"),
      coletas: coletaBlocks.map((c) => ({
        numero_pedido: extractTag(c, "numero_pedido"),
        controle_cliente: extractTag(c, "controle_cliente"),
        historico: extractAllBlocks(c, "historico").map((h) => ({
          status: extractTag(h, "status"),
          descricao_status: extractTag(h, "descricao_status"),
          data_atualizacao: extractTag(h, "data_atualizacao"),
          hora_atualizacao: extractTag(h, "hora_atualizacao"),
          observacao: extractTag(h, "observacao"),
        })),
        objeto: extractAllBlocks(c, "objeto").map((o) => ({
          numero_etiqueta: extractTag(o, "numero_etiqueta"),
          controle_objeto_cliente: extractTag(o, "controle_objeto_cliente"),
          ultimo_status: extractTag(o, "ultimo_status"),
          descricao_status: extractTag(o, "descricao_status"),
          data_ultima_atualizacao: extractTag(o, "data_ultima_atualizacao"),
          hora_ultima_atualizacao: extractTag(o, "hora_ultima_atualizacao"),
        })),
      })),
    };
  }

  async function revalidarPrazoAutorizacaoPostagem(
    params: RevalidarPrazoParams,
  ): Promise<RevalidarPrazoResponse> {
    const credentials = getCredentials();
    const senhaAPI = getAccessCode(credentials);

    const soapBody = `
    <ser:revalidarPrazoAutorizacaoPostagem>
      ${requiredTag("usuario", credentials.usuario)}
      ${requiredTag("senha", senhaAPI)}
      ${requiredTag("codAdministrativo", credentials.codAdministrativo)}
      ${requiredTag("numeroPedido", params.numeroPedido)}
      <qtdeDias>${params.qtdeDias}</qtdeDias>
    </ser:revalidarPrazoAutorizacaoPostagem>`;

    const responseXml = await makeSOAPRequest(
      soapBody,
      "revalidarPrazoAutorizacaoPostagem",
    );
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const revalidarContent = extractTag(
      bodyContent,
      "revalidarPrazoAutorizacaoPostagem",
    );

    if (!revalidarContent) {
      throw new Error("Invalid response from Correios API");
    }

    return {
      numero_pedido: extractTag(revalidarContent, "numero_pedido") || undefined,
      prazo: extractTag(revalidarContent, "prazo") || undefined,
      cod_erro: extractTag(revalidarContent, "cod_erro") || undefined,
      msg_erro: extractTag(revalidarContent, "msg_erro") || undefined,
    };
  }

  async function solicitarRange(
    params: SolicitarRangeParams,
  ): Promise<SolicitarRangeResponse> {
    const credentials = getCredentials();
    const senhaAPI = getAccessCode(credentials);

    const soapBody = `
    <ser:solicitarRange>
      ${requiredTag("usuario", credentials.usuario)}
      ${requiredTag("senha", senhaAPI)}
      ${requiredTag("codAdministrativo", credentials.codAdministrativo)}
      ${requiredTag("tipo", params.tipo)}
      <servico>${params.servico ? escapeXml(params.servico) : ""}</servico>
      <quantidade>${params.quantidade}</quantidade>
    </ser:solicitarRange>`;

    const responseXml = await makeSOAPRequest(soapBody, "solicitarRange");
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const rangeContent = extractTag(bodyContent, "solicitarRange");

    if (!rangeContent) {
      throw new Error("Invalid response from Correios API");
    }

    return {
      data: extractTag(rangeContent, "data"),
      hora: extractTag(rangeContent, "hora"),
      cod_erro: extractTag(rangeContent, "cod_erro"),
      faixa_inicial: extractTag(rangeContent, "faixa_inicial"),
      faixa_final: extractTag(rangeContent, "faixa_final"),
    };
  }

  async function calcularDigitoVerificador(
    params: CalcularDigitoVerificadorParams,
  ): Promise<CalcularDigitoVerificadorResponse> {
    const soapBody = `
    <ser:calcularDigitoVerificador>
      ${requiredTag("numero", params.numero)}
    </ser:calcularDigitoVerificador>`;

    const responseXml = await makeSOAPRequest(
      soapBody,
      "calcularDigitoVerificador",
    );
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const digitoContent = extractTag(
      bodyContent,
      "calcularDigitoVerificador",
    );

    if (!digitoContent) {
      throw new Error("Invalid response from Correios API");
    }

    return {
      data: extractTag(digitoContent, "data"),
      hora: extractTag(digitoContent, "hora"),
      cod_erro: extractTag(digitoContent, "cod_erro"),
      digito: extractTag(digitoContent, "digito"),
      numero: extractTag(digitoContent, "numero"),
    };
  }

  async function solicitarPostagemSimultanea(
    params: SolicitarPostagemSimultaneaParams,
  ): Promise<SolicitarPostagemSimultaneaResponse> {
    const credentials = getCredentials();
    const senhaAPI = getAccessCode(credentials);

    const coletasXML = params.coletas_solicitadas
      .map(
        (coleta) => `<coletas_solicitadas>
      ${requiredTag("tipo", coleta.tipo)}
      ${optionalTag("id_cliente", coleta.id_cliente)}
      ${coleta.valor_declarado !== undefined ? `<valor_declarado>${coleta.valor_declarado.toFixed(2)}</valor_declarado>` : ""}
      ${optionalTag("descricao", coleta.descricao)}
      ${optionalTag("cklist", coleta.cklist)}
      ${coleta.documento?.map((d) => `<documento>${escapeXml(d)}</documento>`).join("") || ""}
      <remetente>
        ${requiredTag("nome", coleta.remetente.nome)}
        ${requiredTag("logradouro", coleta.remetente.logradouro)}
        ${requiredTag("numero", coleta.remetente.numero)}
        ${optionalTag("complemento", coleta.remetente.complemento)}
        ${requiredTag("bairro", coleta.remetente.bairro)}
        ${requiredTag("cidade", coleta.remetente.cidade)}
        ${requiredTag("uf", coleta.remetente.uf)}
        ${requiredTag("cep", coleta.remetente.cep)}
        ${optionalTag("referencia", coleta.remetente.referencia)}
        ${requiredTag("ddd", coleta.remetente.ddd)}
        ${requiredTag("telefone", coleta.remetente.telefone)}
        ${requiredTag("email", coleta.remetente.email)}
        ${optionalTag("identificacao", coleta.remetente.identificacao)}
      </remetente>
      ${requiredTag("obj", coleta.obj)}
    </coletas_solicitadas>`,
      )
      .join("");

    const soapBody = `
    <ser:solicitarPostagemSimultanea>
      ${requiredTag("usuario", credentials.usuario)}
      ${requiredTag("senha", senhaAPI)}
      ${requiredTag("codAdministrativo", credentials.codAdministrativo)}
      ${requiredTag("codigo_servico", params.codigo_servico)}
      ${requiredTag("cartao", credentials.cartaoPostagem)}
      ${buildDestinatarioXml(params.destinatario)}
      ${coletasXML}
    </ser:solicitarPostagemSimultanea>`;

    const responseXml = await makeSOAPRequest(
      soapBody,
      "solicitarPostagemSimultanea",
    );
    const bodyContent = extractTag(responseXml, "Body") || extractTag(responseXml, "soap:Body") || extractTag(responseXml, "S:Body");
    const simultaneaContent = extractTag(
      bodyContent,
      "solicitarPostagemSimultanea",
    );

    if (!simultaneaContent) {
      throw new Error("Invalid response from Correios API");
    }

    const resultadoBlocks = extractAllBlocks(
      simultaneaContent,
      "resultado_solicitacao",
    );

    return {
      status_processamento: extractTag(
        simultaneaContent,
        "status_processamento",
      ),
      data_processamento: extractTag(
        simultaneaContent,
        "data_processamento",
      ),
      hora_processamento: extractTag(
        simultaneaContent,
        "hora_processamento",
      ),
      cod_erro: extractTag(simultaneaContent, "cod_erro"),
      msg_erro: extractTag(simultaneaContent, "msg_erro"),
      resultado_solicitacao: resultadoBlocks.map((block) => ({
        tipo: extractTag(block, "tipo"),
        id_cliente: extractTag(block, "id_cliente"),
        numero_coleta: extractTag(block, "numero_coleta"),
        numero_etiqueta: extractTag(block, "numero_etiqueta"),
        status_objeto: extractTag(block, "status_objeto"),
        prazo: extractTag(block, "prazo"),
        data_solicitacao: extractTag(block, "data_solicitacao"),
        hora_solicitacao: extractTag(block, "hora_solicitacao"),
        codigo_erro: extractTag(block, "codigo_erro"),
        descricao_erro: extractTag(block, "descricao_erro"),
      })),
    };
  }

  return {
    getConfig,
    checkApi250Status,
    solicitarPostagemReversa,
    cancelarPedido,
    acompanharPedido,
    acompanharPedidoPorData,
    revalidarPrazoAutorizacaoPostagem,
    solicitarRange,
    calcularDigitoVerificador,
    solicitarPostagemSimultanea,
  };
}
