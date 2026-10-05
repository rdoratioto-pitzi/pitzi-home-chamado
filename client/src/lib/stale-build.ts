// Depois de um deploy, quem está com o sistema aberto ainda tem a versão antiga, que
// procura arquivos (chunks) que não existem mais: "error loading dynamically imported
// module". Nesse caso recarregamos a página uma vez para pegar a versão nova.

import { isStaleChunkError } from "@shared/stale-build";

export { isStaleChunkError };

const RELOAD_KEY = "pitzi-recarregou-versao-nova";
const RELOAD_WINDOW_MS = 30_000;


/** Recarrega a página, no máximo uma vez a cada 30 s (evita laço se o erro for outro). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponível: recarrega mesmo assim.
  }
  window.location.reload();
  return true;
}
