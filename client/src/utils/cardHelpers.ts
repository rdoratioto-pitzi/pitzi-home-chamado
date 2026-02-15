/**
 * Utilidades para manipulação de Cards (Tickets/Chamados)
 */

/**
 * Atualiza o título do card com base na descrição (primeira linha)
 * e no código (formato: XXXX).
 * 
 * @param {Object} card - O objeto do card contendo 'description' e 'code'.
 * @returns {Object} - O objeto do card com o título atualizado.
 */
export function atualizarTituloDoCard(card: any) {
  // Verifica se o card é válido
  if (!card) return card;

  // 1. Extrair a primeira linha da descrição
  let novaDescricaoTitulo = "";
  if (card.description) {
    // Divide o texto por quebras de linha e pega a primeira parte
    novaDescricaoTitulo = card.description.split('\n')[0].trim();
  }

  // 2. Extrair o código no formato XXXX
  let codigoFormatado = "";
  if (card.code) {
    // Divide o código pelo traço (assumindo formato PREFIX-XXXX) ou pega o final
    const partes = card.code.split('-');
    const sufixo = partes.length > 1 ? partes[partes.length - 1] : card.code;
    
    // Garante que pegamos apenas os últimos 4 caracteres (o XXXX)
    codigoFormatado = sufixo.slice(-4);
  }

  // 3. Atualizar o título do card
  // Prioridade: Descrição + Sufixo do código > Apenas Descrição > Apenas Código
  if (novaDescricaoTitulo && codigoFormatado) {
    card.title = `${novaDescricaoTitulo} - ${codigoFormatado}`;
  } else if (novaDescricaoTitulo) {
    card.title = novaDescricaoTitulo;
  } else if (codigoFormatado) {
    card.title = codigoFormatado;
  }

  // Opcional: Se você também precisar atualizar o campo 'code' para ter o formato XXXX
  // (ex: mudar CHA-37 para CHA-0037), descomente a linha abaixo:
  // if (card.code && codigoFormatado) {
  //    const prefixo = card.code.split('-')[0];
  //    card.code = `${prefixo}-${codigoFormatado}`;
  // }

  return card;
}