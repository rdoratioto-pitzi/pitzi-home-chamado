import { useQuery } from "@tanstack/react-query";

export interface PricingCategory {
  id: string;
  name: string;
}

export function usePricingCategories() {
  return useQuery<PricingCategory[]>({
    queryKey: ["pricing-categories"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/devices?isActive=true");
      if (!response.ok) throw new Error("Erro ao carregar categorias");
      const devices = await response.json();
      // Extract unique manufacturers as categories
      const manufacturers = Array.from(
        new Set(devices.map((d: any) => d.manufacturerName as string))
      ) as string[];
      return manufacturers.map((name: string) => ({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name: name,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
