/**
 * Utilitários compartilhados do módulo Estoques
 */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export const STATUS_CONTAGEM_MAP: Record<string, { label: string; className: string }> = {
  em_andamento: { label: "Em Andamento", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  finalizada: { label: "Finalizada", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  em_analise: { label: "Em Análise", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  aprovada: { label: "Aprovada", className: "bg-green-100 text-green-800 hover:bg-green-100" },
};
