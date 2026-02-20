import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Verifica se uma string HTML está efetivamente vazia (sem conteúdo textual)
 * Remove tags HTML e verifica se o texto restante é apenas whitespace
 */
export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

/**
 * Remove tags HTML de uma string, retornando apenas o texto
 * Seguro para uso no cliente (browser) e no servidor (Node)
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  // Se estiver no navegador, usa DOM parsing para melhor precisão
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  // Fallback para ambiente sem document (Node)
  return html.replace(/<[^>]*>/g, '').trim();
}
