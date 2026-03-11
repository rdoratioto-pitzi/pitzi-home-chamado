/**
 * Serviço de cache para produtos Omie (Estoques)
 *
 * Cache compartilhado entre as rotas de estoque e o job de warm-up horário.
 * TTL de 60 minutos — alinhado com o job de recorrência que roda de hora em hora.
 * Isso garante que o cache nunca expire durante o uso normal, sem que nenhum
 * usuário fique esperando pela chamada à API externa.
 */
import { omieService } from "./omie.service";

let cachedProdutos: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutos

/**
 * Retorna a lista de produtos do Omie, usando cache quando disponível.
 * Em caso de falha na API, retorna o cache expirado se existir (fallback).
 */
export async function getCachedProdutos(): Promise<any[]> {
  const now = Date.now();

  if (cachedProdutos && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log(`[EstoqueCache] Cache hit — ${cachedProdutos.length} produtos`);
    return cachedProdutos;
  }

  console.log("[EstoqueCache] Buscando produtos na API Omie...");

  try {
    const params = [{ pagina: 1, registros_por_pagina: 500 }];
    const data = await omieService.callApi("geral/produtos", "ListarProdutos", params);

    let parsedData = data;
    if (typeof data === "string") {
      try { parsedData = JSON.parse(data); } catch { /* ignore */ }
    }

    let produtos: any[] | null = null;
    if (parsedData?.produto_servico_cadastro) {
      produtos = parsedData.produto_servico_cadastro;
    } else if (parsedData?.produtos?.produto_servico_cadastro) {
      produtos = parsedData.produtos.produto_servico_cadastro;
    } else if (Array.isArray(parsedData)) {
      produtos = parsedData;
    } else if (parsedData) {
      produtos = [parsedData];
    }

    cachedProdutos = (Array.isArray(produtos) ? produtos : (produtos ? [produtos] : []))
      .filter((p: any) => p.codigo_produto || p.codigo);

    cacheTimestamp = now;
    console.log(`[EstoqueCache] Cache atualizado — ${cachedProdutos.length} produtos`);
  } catch (error: any) {
    console.error("[EstoqueCache] Erro ao buscar Omie:", error.message);

    // Fallback: retorna cache expirado se disponível para não quebrar as rotas
    if (cachedProdutos) {
      console.warn("[EstoqueCache] Usando cache expirado como fallback");
      return cachedProdutos;
    }

    cachedProdutos = [];
  }

  return cachedProdutos;
}

/** Invalida o cache manualmente (útil para testes ou forçar refresh). */
export function invalidateEstoqueCache(): void {
  cachedProdutos = null;
  cacheTimestamp = 0;
  console.log("[EstoqueCache] Cache invalidado manualmente");
}
