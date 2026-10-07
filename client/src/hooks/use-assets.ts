import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";
import type { Asset } from "@shared/schema";

export interface AssetPerson {
  id: string;
  name: string;
  email: string;
}

/** Datas chegam como texto pela API. */
export type AssetItem = Omit<Asset, "lastInventoryAt" | "syncedAt" | "createdAt"> & {
  lastInventoryAt: string | null;
  syncedAt: string;
  createdAt: string;
  person: AssetPerson | null;
};

export interface AssetTicketItem {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: string | null;
  requesterName: string | null;
}

export type AssetSheet = AssetItem & { tickets: AssetTicketItem[] };

/** Equipamentos do inventário (só técnicos; para os demais a consulta fica desligada). */
export function useAssets(enabled = true) {
  const query = useQuery<AssetItem[]>({
    queryKey: ["/api/v1/assets"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/v1/assets");
      if (!res.ok) throw new Error("Erro ao carregar equipamentos");
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, assets: query.data ?? [] };
}

export function useAssetSheet(id: string | null) {
  return useQuery<AssetSheet>({
    queryKey: ["/api/v1/assets", id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/v1/assets/${id}`);
      if (!res.ok) throw new Error("Erro ao carregar o equipamento");
      return res.json();
    },
    enabled: !!id,
  });
}
