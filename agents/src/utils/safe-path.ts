import path from 'path';

/**
 * Caminho absoluto de `relativo` dentro de `raiz`, ou null se ele escapar da raiz
 * (absoluto, com `..` ou via symlink de caminho). Caminhos vêm do plano gerado por IA.
 */
export function resolverDentroDoRepo(raiz: string, relativo: string): string | null {
  if (!relativo || path.isAbsolute(relativo) || relativo.includes('\0')) return null;
  const base = path.resolve(raiz);
  const alvo = path.resolve(base, relativo);
  return alvo.startsWith(base + path.sep) ? alvo : null;
}
