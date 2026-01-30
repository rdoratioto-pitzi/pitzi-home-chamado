import { parseStringPromise, Builder } from 'xml2js';

// URL corrigida do Web Service de Logística Reversa dos Correios (Produção)
const CORREIOS_PRODUCTION_URL = 'https://cws.correios.com.br/logisticaReversaWS/logisticaReversaService/logisticaReversaWS';

interface CorreiosCredentials {
  usuario: string;
  senha: string;
  cartaoPostagem: string;
  codAdministrativo: string;
  token: string;
}

function getCredentials(): CorreiosCredentials {
  return {
    usuario: process.env.CORREIOS_USUARIO || '',
    senha: process.env.CORREIOS_SENHA || '',
    cartaoPostagem: process.env.CORREIOS_CARTAO_POSTAGEM || '',
    codAdministrativo: process.env.CORREIOS_COD_ADMINISTRATIVO || '',
    token: process.env.CORREIOS_TOKEN || '',
  };
}

async function makeSOAPRequest(soapBody: string, soapAction: string): Promise<any> {
  // O Web Service SOAP de Logística Reversa NÃO usa autenticação no header HTTP
  // As credenciais são passadas dentro do corpo XML da requisição SOAP
  
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:ser="http://service.logisticareversa.correios.com.br/">
  <soapenv:Header/>
  <soapenv:Body>
    ${soapBody}
  </soapenv:Body>
</soapenv:Envelope>`;

  console.log('Enviando requisição SOAP para Correios Logística Reversa...');

  try {
    const response = await fetch(CORREIOS_PRODUCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('SOAP HTTP Error:', response.status, responseText);
      
      // Mensagens de erro mais claras para o usuário
      if (response.status === 401) {
        throw new Error('Credenciais dos Correios inválidas. Verifique CORREIOS_USUARIO (seu CNPJ ou usuário CWS) e CORREIOS_TOKEN (código de acesso de 40 caracteres gerado no portal CWS).');
      } else if (response.status === 403) {
        throw new Error('Acesso negado pelo serviço dos Correios. Verifique se o contrato está ativo.');
      } else if (response.status === 404) {
        throw new Error('Serviço dos Correios não encontrado. O endpoint pode ter sido alterado.');
      } else if (response.status === 500) {
        throw new Error('Erro interno no servidor dos Correios. Tente novamente mais tarde.');
      } else if (response.status === 503) {
        throw new Error('Serviço dos Correios temporariamente indisponível. Tente novamente mais tarde.');
      }
      
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await parseStringPromise(responseText, { explicitArray: false, ignoreAttrs: true });
    
    const soapFault = result['soap:Envelope']?.['soap:Body']?.['soap:Fault'];
    if (soapFault) {
      const faultString = soapFault.faultstring || soapFault['faultstring'] || 'Unknown SOAP Fault';
      throw new Error(`SOAP Fault: ${faultString}`);
    }
    
    return result;
  } catch (error) {
    console.error('SOAP Request Error:', error);
    throw error;
  }
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

export interface ColetaSolicitada {
  tipo: 'A' | 'C' | 'CA'; // A=Autorização, C=Coleta, CA=Coleta com fallback
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
}

export interface SolicitarPostagemReversaParams {
  codigo_servico: string;
  destinatario: Destinatario;
  coletas_solicitadas: ColetaSolicitada[];
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

export async function solicitarPostagemReversa(params: SolicitarPostagemReversaParams): Promise<SolicitarPostagemReversaResponse> {
  const credentials = getCredentials();
  
  const coletasXML = params.coletas_solicitadas.map(coleta => {
    const objColXML = coleta.obj_col?.map(obj => `
      <obj_col>
        <item>${String(obj.item).padStart(2, '0')}</item>
        ${obj.id ? `<id>${obj.id}</id>` : ''}
        ${obj.desc ? `<desc>${obj.desc}</desc>` : ''}
        ${obj.entrega ? `<entrega>${obj.entrega}</entrega>` : ''}
        ${obj.num ? `<num>${obj.num}</num>` : ''}
      </obj_col>
    `).join('') || '';

    return `
    <coletas_solicitadas>
      <tipo>${coleta.tipo}</tipo>
      ${coleta.numero ? `<numero>${coleta.numero}</numero>` : '<numero></numero>'}
      ${coleta.id_cliente ? `<id_cliente>${coleta.id_cliente}</id_cliente>` : ''}
      ${coleta.ag ? `<ag>${coleta.ag}</ag>` : ''}
      ${coleta.cartao ? `<cartao>${coleta.cartao}</cartao>` : ''}
      ${coleta.valor_declarado ? `<valor_declarado>${coleta.valor_declarado.toFixed(2)}</valor_declarado>` : ''}
      ${coleta.descricao ? `<descricao>${coleta.descricao}</descricao>` : ''}
      ${coleta.ar !== undefined ? `<ar>${coleta.ar}</ar>` : ''}
      ${coleta.cklist ? `<cklist>${coleta.cklist}</cklist>` : ''}
      ${coleta.documento?.map(d => `<documento>${d}</documento>`).join('') || ''}
      <remetente>
        <nome>${coleta.remetente.nome}</nome>
        <logradouro>${coleta.remetente.logradouro}</logradouro>
        <numero>${coleta.remetente.numero}</numero>
        ${coleta.remetente.complemento ? `<complemento>${coleta.remetente.complemento}</complemento>` : ''}
        <bairro>${coleta.remetente.bairro}</bairro>
        <cidade>${coleta.remetente.cidade}</cidade>
        <uf>${coleta.remetente.uf}</uf>
        <cep>${coleta.remetente.cep}</cep>
        ${coleta.remetente.referencia ? `<referencia>${coleta.remetente.referencia}</referencia>` : ''}
        <ddd>${coleta.remetente.ddd}</ddd>
        <telefone>${coleta.remetente.telefone}</telefone>
        <email>${coleta.remetente.email}</email>
        ${coleta.remetente.celular ? `<celular>${coleta.remetente.celular}</celular>` : ''}
        ${coleta.remetente.ddd_celular ? `<ddd_celular>${coleta.remetente.ddd_celular}</ddd_celular>` : ''}
        ${coleta.remetente.sms ? `<sms>${coleta.remetente.sms}</sms>` : ''}
        ${coleta.remetente.identificacao ? `<identificacao>${coleta.remetente.identificacao}</identificacao>` : ''}
        ${coleta.remetente.documento_estrangeiro ? `<documento_estrangeiro>${coleta.remetente.documento_estrangeiro}</documento_estrangeiro>` : ''}
        <restricao_anac>${coleta.remetente.restricao_anac}</restricao_anac>
      </remetente>
      ${objColXML}
    </coletas_solicitadas>
    `;
  }).join('');

  // Determina a senha: prioriza o token JWT (código de acesso de 40 chars) se disponível
  const senhaAPI = credentials.token || credentials.senha;
  
  const soapBody = `
    <ser:solicitarPostagemReversa>
      <usuario>${credentials.usuario}</usuario>
      <senha>${senhaAPI}</senha>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <codigo_servico>${params.codigo_servico}</codigo_servico>
      <cartao>${credentials.cartaoPostagem}</cartao>
      <destinatario>
        <nome>${params.destinatario.nome}</nome>
        <logradouro>${params.destinatario.logradouro}</logradouro>
        <numero>${params.destinatario.numero}</numero>
        ${params.destinatario.complemento ? `<complemento>${params.destinatario.complemento}</complemento>` : ''}
        <bairro>${params.destinatario.bairro}</bairro>
        ${params.destinatario.referencia ? `<referencia>${params.destinatario.referencia}</referencia>` : ''}
        <cidade>${params.destinatario.cidade}</cidade>
        <uf>${params.destinatario.uf}</uf>
        <cep>${params.destinatario.cep}</cep>
        ${params.destinatario.ddd ? `<ddd>${params.destinatario.ddd}</ddd>` : ''}
        ${params.destinatario.telefone ? `<telefone>${params.destinatario.telefone}</telefone>` : ''}
        ${params.destinatario.celular ? `<celular>${params.destinatario.celular}</celular>` : ''}
        ${params.destinatario.ddd_celular ? `<ddd_celular>${params.destinatario.ddd_celular}</ddd_celular>` : ''}
        ${params.destinatario.email ? `<email>${params.destinatario.email}</email>` : ''}
        ${params.destinatario.identificacao ? `<identificacao>${params.destinatario.identificacao}</identificacao>` : ''}
        <ciencia_conteudo_proibido>${params.destinatario.ciencia_conteudo_proibido}</ciencia_conteudo_proibido>
      </destinatario>
      ${coletasXML}
    </ser:solicitarPostagemReversa>
  `;

  const result = await makeSOAPRequest(soapBody, 'solicitarPostagemReversa');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:solicitarPostagemReversaResponse']?.solicitarPostagemReversa;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  const resultados = Array.isArray(response.resultado_solicitacao) 
    ? response.resultado_solicitacao 
    : response.resultado_solicitacao ? [response.resultado_solicitacao] : [];

  return {
    status_processamento: response.status_processamento || '',
    data_processamento: response.data_processamento || '',
    hora_processamento: response.hora_processamento || '',
    cod_erro: response.cod_erro || '',
    msg_erro: response.msg_erro || '',
    resultado_solicitacao: resultados,
  };
}

export interface CancelarPedidoParams {
  numeroPedido: string;
  tipo: 'A' | 'C'; // A=Autorização, C=Coleta
}

export interface CancelarPedidoResponse {
  codigo_administrativo: string;
  objeto_postal: {
    numero_pedido: string;
    status_pedido: string;
    datahora_cancelamento: string;
  };
}

export async function cancelarPedido(params: CancelarPedidoParams): Promise<CancelarPedidoResponse> {
  const credentials = getCredentials();
  const senhaAPI = credentials.token || credentials.senha;
  
  const soapBody = `
    <ser:cancelarPedido>
      <usuario>${credentials.usuario}</usuario>
      <senha>${senhaAPI}</senha>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <numeroPedido>${params.numeroPedido}</numeroPedido>
      <tipo>${params.tipo}</tipo>
    </ser:cancelarPedido>
  `;

  const result = await makeSOAPRequest(soapBody, 'cancelarPedido');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:cancelarPedidoResponse']?.cancelarPedido;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  return {
    codigo_administrativo: response.codigo_administrativo || '',
    objeto_postal: {
      numero_pedido: response.objeto_postal?.numero_pedido || '',
      status_pedido: response.objeto_postal?.status_pedido || '',
      datahora_cancelamento: response.objeto_postal?.datahora_cancelamento || '',
    },
  };
}

export interface AcompanharPedidoParams {
  tipoBusca: 'T' | 'P' | 'U'; // T=Todos eventos, P=Primeiro, U=Último
  tipoSolicitacao: 'A' | 'C'; // A=Autorização, C=Coleta
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

export async function acompanharPedido(params: AcompanharPedidoParams): Promise<AcompanharPedidoResponse> {
  const credentials = getCredentials();
  const senhaAPI = credentials.token || credentials.senha;
  
  const soapBody = `
    <ser:acompanharPedido>
      <usuario>${credentials.usuario}</usuario>
      <senha>${senhaAPI}</senha>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <tipoBusca>${params.tipoBusca}</tipoBusca>
      <tipoSolicitacao>${params.tipoSolicitacao}</tipoSolicitacao>
      <numeroPedido>${params.numeroPedido}</numeroPedido>
    </ser:acompanharPedido>
  `;

  const result = await makeSOAPRequest(soapBody, 'acompanharPedido');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:acompanharPedidoResponse']?.acompanharPedido;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  const coleta = response.coleta || {};
  const historico = Array.isArray(coleta.historico) ? coleta.historico : coleta.historico ? [coleta.historico] : [];
  const objeto = Array.isArray(coleta.objeto) ? coleta.objeto : coleta.objeto ? [coleta.objeto] : [];

  return {
    codigo_administrativo: response.codigo_administrativo || '',
    tipo_solicitacao: response.tipo_solicitacao || '',
    coleta: {
      numero_pedido: coleta.numero_pedido || '',
      controle_cliente: coleta.controle_cliente || '',
      historico,
      objeto,
    },
  };
}

export interface AcompanharPedidoPorDataParams {
  tipoSolicitacao: 'A' | 'C';
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

export async function acompanharPedidoPorData(params: AcompanharPedidoPorDataParams): Promise<AcompanharPedidoPorDataResponse> {
  const credentials = getCredentials();
  const senhaAPI = credentials.token || credentials.senha;
  
  const soapBody = `
    <ser:acompanharPedidoPorData>
      <usuario>${credentials.usuario}</usuario>
      <senha>${senhaAPI}</senha>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <tipoSolicitacao>${params.tipoSolicitacao}</tipoSolicitacao>
      <data>${params.data}</data>
    </ser:acompanharPedidoPorData>
  `;

  const result = await makeSOAPRequest(soapBody, 'acompanharPedidoPorData');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:acompanharPedidoPorDataResponse']?.acompanharPedidoPorData;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  const coletas = Array.isArray(response.coleta) ? response.coleta : response.coleta ? [response.coleta] : [];

  return {
    codigo_administrativo: response.codigo_administrativo || '',
    tipo_solicitacao: response.tipo_solicitacao || '',
    coletas: coletas.map((c: any) => ({
      numero_pedido: c.numero_pedido || '',
      controle_cliente: c.controle_cliente || '',
      historico: Array.isArray(c.historico) ? c.historico : c.historico ? [c.historico] : [],
      objeto: Array.isArray(c.objeto) ? c.objeto : c.objeto ? [c.objeto] : [],
    })),
  };
}

export interface RevalidarPrazoParams {
  numeroPedido: string;
  qtdeDias: number; // 5 a 30 dias
}

export interface RevalidarPrazoResponse {
  numero_pedido?: string;
  prazo?: string;
  cod_erro?: string;
  msg_erro?: string;
}

export async function revalidarPrazoAutorizacaoPostagem(params: RevalidarPrazoParams): Promise<RevalidarPrazoResponse> {
  const credentials = getCredentials();
  const senhaAPI = credentials.token || credentials.senha;
  
  const soapBody = `
    <ser:revalidarPrazoAutorizacaoPostagem>
      <usuario>${credentials.usuario}</usuario>
      <senha>${senhaAPI}</senha>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <numeroPedido>${params.numeroPedido}</numeroPedido>
      <qtdeDias>${params.qtdeDias}</qtdeDias>
    </ser:revalidarPrazoAutorizacaoPostagem>
  `;

  const result = await makeSOAPRequest(soapBody, 'revalidarPrazoAutorizacaoPostagem');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:revalidarPrazoAutorizacaoPostagemResponse']?.revalidarPrazoAutorizacaoPostagem;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  return {
    numero_pedido: response.numero_pedido,
    prazo: response.prazo,
    cod_erro: response.cod_erro,
    msg_erro: response.msg_erro,
  };
}

export interface SolicitarRangeParams {
  tipo: 'AP'; // AP=Autorização de Postagem
  servico?: 'LE' | 'LS' | 'LV'; // LE=PAC, LS=SEDEX, LV=e-SEDEX
  quantidade: number; // Max 50000
}

export interface SolicitarRangeResponse {
  data: string;
  hora: string;
  cod_erro: string;
  faixa_inicial: string;
  faixa_final: string;
}

export async function solicitarRange(params: SolicitarRangeParams): Promise<SolicitarRangeResponse> {
  const credentials = getCredentials();
  const senhaAPI = credentials.token || credentials.senha;
  
  const soapBody = `
    <ser:solicitarRange>
      <usuario>${credentials.usuario}</usuario>
      <senha>${senhaAPI}</senha>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <tipo>${params.tipo}</tipo>
      ${params.servico ? `<servico>${params.servico}</servico>` : '<servico></servico>'}
      <quantidade>${params.quantidade}</quantidade>
    </ser:solicitarRange>
  `;

  const result = await makeSOAPRequest(soapBody, 'solicitarRange');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:solicitarRangeResponse']?.solicitarRange;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  return {
    data: response.data || '',
    hora: response.hora || '',
    cod_erro: response.cod_erro || '',
    faixa_inicial: response.faixa_inicial || '',
    faixa_final: response.faixa_final || '',
  };
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

export async function calcularDigitoVerificador(params: CalcularDigitoVerificadorParams): Promise<CalcularDigitoVerificadorResponse> {
  const soapBody = `
    <ser:calcularDigitoVerificador>
      <numero>${params.numero}</numero>
    </ser:calcularDigitoVerificador>
  `;

  const result = await makeSOAPRequest(soapBody, 'calcularDigitoVerificador');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:calcularDigitoVerificadorResponse']?.calcularDigitoVerificador;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  return {
    data: response.data || '',
    hora: response.hora || '',
    cod_erro: response.cod_erro || '',
    digito: response.digito || '',
    numero: response.numero || '',
  };
}

export interface ColetaSimultanea {
  tipo: 'C';
  id_cliente?: string;
  valor_declarado?: number;
  descricao?: string;
  cklist?: string;
  documento?: string[];
  remetente: Remetente;
  obj: string; // Número da etiqueta da encomenda substituta
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

export async function solicitarPostagemSimultanea(params: SolicitarPostagemSimultaneaParams): Promise<SolicitarPostagemSimultaneaResponse> {
  const credentials = getCredentials();
  
  const coletasXML = params.coletas_solicitadas.map(coleta => `
    <coletas_solicitadas>
      <tipo>${coleta.tipo}</tipo>
      ${coleta.id_cliente ? `<id_cliente>${coleta.id_cliente}</id_cliente>` : ''}
      ${coleta.valor_declarado ? `<valor_declarado>${coleta.valor_declarado.toFixed(2)}</valor_declarado>` : ''}
      ${coleta.descricao ? `<descricao>${coleta.descricao}</descricao>` : ''}
      ${coleta.cklist ? `<cklist>${coleta.cklist}</cklist>` : ''}
      ${coleta.documento?.map(d => `<documento>${d}</documento>`).join('') || ''}
      <remetente>
        <nome>${coleta.remetente.nome}</nome>
        <logradouro>${coleta.remetente.logradouro}</logradouro>
        <numero>${coleta.remetente.numero}</numero>
        ${coleta.remetente.complemento ? `<complemento>${coleta.remetente.complemento}</complemento>` : ''}
        <bairro>${coleta.remetente.bairro}</bairro>
        <cidade>${coleta.remetente.cidade}</cidade>
        <uf>${coleta.remetente.uf}</uf>
        <cep>${coleta.remetente.cep}</cep>
        ${coleta.remetente.referencia ? `<referencia>${coleta.remetente.referencia}</referencia>` : ''}
        <ddd>${coleta.remetente.ddd}</ddd>
        <telefone>${coleta.remetente.telefone}</telefone>
        <email>${coleta.remetente.email}</email>
        ${coleta.remetente.identificacao ? `<identificacao>${coleta.remetente.identificacao}</identificacao>` : ''}
      </remetente>
      <obj>${coleta.obj}</obj>
    </coletas_solicitadas>
  `).join('');

  const soapBody = `
    <ser:solicitarPostagemSimultanea>
      <codAdministrativo>${credentials.codAdministrativo}</codAdministrativo>
      <codigo_servico>${params.codigo_servico}</codigo_servico>
      <cartao>${credentials.cartaoPostagem}</cartao>
      <destinatario>
        <nome>${params.destinatario.nome}</nome>
        <logradouro>${params.destinatario.logradouro}</logradouro>
        <numero>${params.destinatario.numero}</numero>
        ${params.destinatario.complemento ? `<complemento>${params.destinatario.complemento}</complemento>` : ''}
        <bairro>${params.destinatario.bairro}</bairro>
        ${params.destinatario.referencia ? `<referencia>${params.destinatario.referencia}</referencia>` : ''}
        <cidade>${params.destinatario.cidade}</cidade>
        <uf>${params.destinatario.uf}</uf>
        <cep>${params.destinatario.cep}</cep>
        ${params.destinatario.ddd ? `<ddd>${params.destinatario.ddd}</ddd>` : ''}
        ${params.destinatario.telefone ? `<telefone>${params.destinatario.telefone}</telefone>` : ''}
        ${params.destinatario.email ? `<email>${params.destinatario.email}</email>` : ''}
        <ciencia_conteudo_proibido>${params.destinatario.ciencia_conteudo_proibido}</ciencia_conteudo_proibido>
      </destinatario>
      ${coletasXML}
    </ser:solicitarPostagemSimultanea>
  `;

  const result = await makeSOAPRequest(soapBody, 'solicitarPostagemSimultanea');
  const response = result['soap:Envelope']?.['soap:Body']?.['ns2:solicitarPostagemSimultaneaResponse']?.solicitarPostagemSimultanea;
  
  if (!response) {
    throw new Error('Invalid response from Correios API');
  }

  const resultados = Array.isArray(response.resultado_solicitacao) 
    ? response.resultado_solicitacao 
    : response.resultado_solicitacao ? [response.resultado_solicitacao] : [];

  return {
    status_processamento: response.status_processamento || '',
    data_processamento: response.data_processamento || '',
    hora_processamento: response.hora_processamento || '',
    cod_erro: response.cod_erro || '',
    msg_erro: response.msg_erro || '',
    resultado_solicitacao: resultados,
  };
}

function maskValue(value: string): string {
  if (!value || value.length < 4) return value ? '****' : '';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

export function getCorreiosConfig() {
  const credentials = getCredentials();
  return {
    configured: !!(credentials.usuario && credentials.senha && credentials.cartaoPostagem && credentials.codAdministrativo),
    cartaoPostagem: maskValue(credentials.cartaoPostagem),
    codAdministrativo: maskValue(credentials.codAdministrativo),
    usuario: maskValue(credentials.usuario),
  };
}
