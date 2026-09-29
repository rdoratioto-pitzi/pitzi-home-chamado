/** Versão exibível de um segredo: nunca devolver o valor real pela API. */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  return `••••••••${secret.slice(-4)}`;
}
