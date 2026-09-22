export { hashPassword, verifyPassword } from "../../../shared/password";

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SHA-256 hash for refresh token storage.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bufferToHex(hash);
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Compara um segredo recebido com o configurado; falha fechado se qualquer um estiver vazio. */
export function secretMatches(provided: string | undefined | null, expected: string | undefined | null): boolean {
  if (!provided || !expected) return false;
  return timingSafeEqualStr(provided, expected);
}
