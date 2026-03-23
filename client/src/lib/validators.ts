/**
 * Funções de validação compartilhadas
 */

/**
 * Valida se o IMEI é válido
 * - Deve ter exatamente 15 dígitos
 * - Não pode ter todos os dígitos iguais (ex: 000000000000000)
 */
export function validarIMEI(imei: string): { valido: boolean; erro?: string } {
  if (imei.length !== 15) {
    return { valido: false, erro: "IMEI deve ter 15 dígitos" };
  }

  // Verifica se todos os dígitos são iguais
  const primeiroDigito = imei[0];
  const todosIguais = imei.split("").every((d) => d === primeiroDigito);

  if (todosIguais) {
    return { valido: false, erro: "IMEI inválido: sequência de dígitos repetidos não é permitida" };
  }

  return { valido: true };
}
