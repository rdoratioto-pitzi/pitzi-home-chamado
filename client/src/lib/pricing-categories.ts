/**
 * Categorias centralizadas para o módulo de Pricing
 * 
 * Para adicionar uma nova categoria:
 * 1. Adicione o registro aqui
 * 2. A categoria estará automaticamente disponível em todos os componentes de pricing
 * 
 * IDs válidos conforme API externa:
 * - d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345 = iPhone (Apple)
 * - d686a25d-045d-4b8c-9d7c-35a21d29d31b = Android (todas as outras marcas)
 */

export interface PricingCategory {
  id: string;
  name: string;
  description?: string;
}

export const PRICING_CATEGORIES: PricingCategory[] = [
  { 
    id: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", 
    name: "iPhone",
    description: "Dispositivos iPhone"
  },
  { 
    id: "d686a25d-045d-4b8c-9d7c-35a21d29d31b", 
    name: "Android",
    description: "Dispositivos Android (Samsung, Xiaomi, Motorola, etc)"
  },
];

/**
 * Obtém uma categoria pelo ID
 */
export function getCategoryById(id: string): PricingCategory | undefined {
  return PRICING_CATEGORIES.find(cat => cat.id === id);
}

/**
 * Obtém o nome de uma categoria pelo ID
 */
export function getCategoryName(id: string): string {
  const category = getCategoryById(id);
  return category?.name ?? "Categoria Desconhecida";
}

/**
 * Obtém o ID de uma categoria pelo nome
 */
export function getCategoryIdByName(name: string): string | undefined {
  const category = PRICING_CATEGORIES.find(cat => 
    cat.name.toLowerCase() === name.toLowerCase()
  );
  return category?.id;
}