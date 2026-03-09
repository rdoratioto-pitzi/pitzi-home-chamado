import { useQuery } from "@tanstack/react-query";

export interface PricingCategory {
  id: string;
  name: string;
}

// Lista de categorias disponíveis na API externa
// IMPORTANTE: A API externa usa UUIDs para categoryId, não nomes de fabricantes!
// UUIDs válidos conforme a pasta de teste (teste/renov-home/client/src/lib/pricing-categories.ts):
// - d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345 = iPhone (Apple)
// - d686a25d-045d-4b8c-9d7c-35a21d29d31b = Android (todas as outras marcas)
const DEFAULT_CATEGORIES = [
  { id: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", name: "iPhone (Apple)" },
  { id: "d686a25d-045d-4b8c-9d7c-35a21d29d31b", name: "Android" },
];

export function usePricingCategories() {
  return useQuery<PricingCategory[]>({
    queryKey: ["pricing-categories"],
    queryFn: async () => {
      // Verifica se a API externa está funcionando
      // Testa primeiro com a categoria iPhone
      const testResponse = await fetch(`/api/pricing/eligible-devices?categoryId=${DEFAULT_CATEGORIES[0].id}&pageSize=1`);
      
      if (testResponse.ok) {
        // API funcionando, retorna as categorias padrão (iPhone e Android)
        // Não extraímos mais fabricantes para evitar confusão com categoryIds
        return DEFAULT_CATEGORIES;
      }
      
      // Se a API falhar, retorna categorias padrão
      console.warn("[PRICING] API externa não respondeu, usando categorias padrão");
      return DEFAULT_CATEGORIES;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
