import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

interface WorkspaceCounts {
  todos: number;
  chamados: number;
  projetos: number;
}

export function useWorkspaceCounts() {
  return useQuery<WorkspaceCounts>({
    queryKey: ["workspace-counts"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/workspace/counts");
      if (!res.ok) throw new Error("Erro ao carregar contagens");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
