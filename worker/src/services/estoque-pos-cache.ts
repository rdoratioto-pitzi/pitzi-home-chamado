// worker/src/services/estoque-pos-cache.ts
// In-memory cache for Omie PosEstoque — works within a single Worker isolate lifetime
import type { OmieService } from "./omie.service";

export interface PosEstoqueEntry {
  cCodigo: string;
  cDescricao: string;
  cCodInt: string;
  nCodProd: number;
  codigo_local_estoque: number;
  fisico: number;
  reservado: number;
  nSaldo: number;
  nPendente: number;
  nCMC: number;
  nPrecoUnitario: number;
  estoque_minimo: number;
}

let cachedIndex: Map<string, PosEstoqueEntry[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export async function getCachedPosEstoque(
  omieService: OmieService,
): Promise<Map<string, PosEstoqueEntry[]>> {
  const now = Date.now();

  if (cachedIndex && now - cacheTimestamp < CACHE_TTL_MS) {
    console.log(`[PosEstoqueCache] Cache hit — ${cachedIndex.size} produtos`);
    return cachedIndex;
  }

  console.log(
    "[PosEstoqueCache] Carregando posição de estoques (todas as páginas)...",
  );

  const index = new Map<string, PosEstoqueEntry[]>();
  const today = new Date().toLocaleDateString("pt-BR");
  const PAGE_SIZE = 50;
  let page = 1;
  let totalPages = 1;

  try {
    do {
      const data = await omieService.callApi(
        "estoque/consulta/",
        "ListarPosEstoque",
        [
          {
            nPagina: page,
            nRegPorPagina: PAGE_SIZE,
            dDataPosicao: today,
            cExibeTodos: "N",
          },
        ],
      );

      if (data?.faultstring) {
        throw new Error(data.faultstring);
      }

      if (page === 1) {
        totalPages = data?.nTotPaginas ?? 1;
        console.log(
          `[PosEstoqueCache] Total: ${data?.nTotRegistros} registros, ${totalPages} páginas`,
        );
      }

      const produtos: any[] = data?.produtos ?? [];
      for (const p of produtos) {
        const codigo = p.cCodigo?.trim();
        if (!codigo) continue;
        if (!index.has(codigo)) index.set(codigo, []);
        index.get(codigo)!.push(p as PosEstoqueEntry);
      }

      page++;
    } while (page <= totalPages);

    cachedIndex = index;
    cacheTimestamp = now;
    console.log(
      `[PosEstoqueCache] Cache atualizado — ${index.size} produtos únicos`,
    );
  } catch (error: any) {
    console.error("[PosEstoqueCache] Erro ao carregar:", error.message);

    if (cachedIndex) {
      console.warn("[PosEstoqueCache] Usando cache expirado como fallback");
      return cachedIndex;
    }

    return new Map();
  }

  return cachedIndex;
}

export function invalidatePosEstoqueCache(): void {
  cachedIndex = null;
  cacheTimestamp = 0;
  console.log("[PosEstoqueCache] Cache invalidado");
}
