import { useQuery } from "@tanstack/react-query";

export interface MetaArea {
  id: string;
  name: string;
  color: string;
}

export function useMetaAreas() {
  return useQuery<MetaArea[]>({
    queryKey: ["meta-areas"],
    queryFn: async () => {
      const response = await fetch("/api/meta-areas");
      if (!response.ok) throw new Error("Erro ao carregar áreas");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
