// Erro de arquivo (chunk) da versão antiga que não existe mais depois de um deploy.
// Usado pelo site (client/src/lib/stale-build.ts) para recarregar a página.
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(message);
}
