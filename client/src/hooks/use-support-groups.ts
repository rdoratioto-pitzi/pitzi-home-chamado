import { useQuery } from "@tanstack/react-query";

export interface SupportGroup {
  id: string;
  key: string;
  name: string;
  description: string | null;
  memberIds: string[];
}

/** Grupos de atendimento ativos; a chave do grupo é gravada no campo categoria do chamado. */
export function useSupportGroups() {
  const query = useQuery<SupportGroup[]>({
    queryKey: ["/api/v1/support-groups"],
    queryFn: async () => {
      const response = await fetch("/api/v1/support-groups");
      if (!response.ok) throw new Error("Erro ao carregar grupos de atendimento");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const groups = query.data ?? [];
  const groupName = (key: string | null | undefined) =>
    groups.find(g => g.key === key)?.name ?? key ?? "";
  return { ...query, groups, groupName };
}
