/**
 * Funções de validação compartilhadas
 */

/**
 * Valida se o IMEI é válido usando o algoritmo de Luhn
 * - Deve ter exatamente 15 dígitos
 * - Deve conter apenas dígitos numéricos
 * - Deve passar na validação do dígito verificador (Luhn)
 */
export function validarIMEI(imei: string): { valido: boolean; erro?: string } {
  if (!imei || imei.length !== 15) {
    return { valido: false, erro: "IMEI deve ter 15 dígitos" };
  }

  // Verifica se contém apenas dígitos
  if (!/^\d+$/.test(imei)) {
    return { valido: false, erro: "IMEI deve conter apenas dígitos numéricos" };
  }

  // Algoritmo de Luhn para validação do dígito verificador
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(imei[i], 10);

    if (i % 2 === 0) {
      sum += digit;
    } else {
      digit *= 2;
      sum += Math.floor(digit / 10) + (digit % 10);
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  const lastDigit = parseInt(imei[14], 10);

  if (checkDigit !== lastDigit) {
    return { valido: false, erro: "IMEI inválido: dígito verificador incorreto" };
  }

  return { valido: true };
}
