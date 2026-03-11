import { useQuery } from "@tanstack/react-query";

export interface DeveloperTokenUsage {
  developerName: string;
  totalTokens: number;
  totalRequests: number;
  totalSpend: number;
  keysCount: number;
  // Breakdown por provider
  openrouterTokens: number;
  openrouterSpend: number;
  openrouterKeysCount: number;
  anthropicTokens: number;
  anthropicSpend: number;
  anthropicKeysCount: number;
}

export function useDeveloperTokens(filters?: {
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ["git-analytics-developer-tokens", filters?.startDate, filters?.endDate],
    queryFn: async (): Promise<DeveloperTokenUsage[]> => {
      const params = new URLSearchParams();

      if (filters?.startDate) {
        params.append("startDate", filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        params.append("endDate", filters.endDate.toISOString());
      }

      const url = `/api/git-analytics/developer-tokens${params.toString() ? `?${params}` : ''}`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch developer tokens");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    refetchOnWindowFocus: false, // Não recarregar ao focar janela
  });
}
