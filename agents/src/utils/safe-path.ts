import path from 'path';
import fs from 'fs';

/**
 * Caminho absoluto de `relativo` dentro de `raiz`, ou null se ele escapar da raiz
 * (absoluto, com `..` ou via symlink de caminho). Caminhos vêm do plano gerado por IA.
 */
export function resolverDentroDoRepo(raiz: string, relativo: string): string | null {
  if (!relativo || path.isAbsolute(relativo) || relativo.includes('\0')) return null;
  const base = path.resolve(raiz);
  const alvo = path.resolve(base, relativo);
  if (!alvo.startsWith(base + path.sep)) return null;
  const partes = path.relative(base, alvo).split(path.sep);
  if (partes.some((parte) => parte.toLowerCase() === '.git')) return null;
  // Recusa symlinks em qualquer componente, inclusive links quebrados e diretórios.
  // Componentes ainda inexistentes são válidos para arquivos novos.
  let atual = base;
  for (const parte of partes) {
    atual = path.join(atual, parte);
    try {
      if (fs.lstatSync(atual).isSymbolicLink()) return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return null;
    }
  }
  return alvo;
}
