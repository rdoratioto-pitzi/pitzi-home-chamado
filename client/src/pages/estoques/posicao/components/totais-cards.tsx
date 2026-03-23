/**
 * Componente de Cards Totalizadores para Posição de Estoques
 * Exibe métricas resumidas: Quantidade Total, Valor Total e Custo Médio Unitário
 */
import { Package, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "../../utils";

interface TotaisCardsProps {
  qtdeTotal: number;
  valorTotal: number;
  custoMedioUnitario: number;
  isLoading: boolean;
}


export function TotaisCards({
  qtdeTotal,
  valorTotal,
  custoMedioUnitario,
  isLoading,
}: TotaisCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card 1 - Qtde Estoque Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2 - Valor Estoque Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3 - Custo Médio Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Card 1 - Qtde Estoque */}
      <Card className="bg-blue-500/10 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">
                Qtde Estoque
              </p>
              <p className="text-[28px] font-bold text-blue-700 dark:text-blue-300">
                {formatNumber(qtdeTotal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 - Valor Estoque */}
      <Card className="bg-green-500/10 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide">
                Valor Estoque
              </p>
              <p className="text-[28px] font-bold text-green-700 dark:text-green-300">
                {formatCurrency(valorTotal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 - Custo Médio Unitário */}
      <Card className="bg-gray-500/10 border-gray-200 dark:border-gray-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gray-500/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                Custo Médio Unitário
              </p>
              <p className="text-[28px] font-bold text-gray-700 dark:text-gray-300">
                {formatCurrency(custoMedioUnitario)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
