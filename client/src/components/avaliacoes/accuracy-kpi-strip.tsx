import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Bot, User, DollarSign, CheckSquare } from "lucide-react";
import type { MetricasResumo } from "@/hooks/use-avaliacoes";

interface AccuracyKpiStripProps {
  data: MetricasResumo | undefined;
  isLoading?: boolean;
}

function TrendArrow({ value }: { value: number }) {
  if (value === 0) return null;
  if (value > 0) return <ArrowUpRight className="h-3 w-3 text-green-500 inline" />;
  return <ArrowDownRight className="h-3 w-3 text-red-500 inline" />;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function KpiSkeleton() {
  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader className="pb-2">
        <div className="h-3 w-24 rounded" style={{ background: "var(--sep)" }} />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 rounded" style={{ background: "var(--sep)" }} />
        <div className="h-3 w-32 rounded mt-2" style={{ background: "var(--sep)" }} />
      </CardContent>
    </Card>
  );
}

export function AccuracyKpiStrip({ data, isLoading }: AccuracyKpiStripProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    );
  }

  const acuraciaIa = data?.acuraciaIa ?? 0;
  const acuraciaHumano = data?.acuraciaHumano ?? 0;
  const custoErroIa = data?.custoErroIa ?? 0;
  const totalCurados = data?.totalCurados ?? 0;
  const totalDisponiveis = data?.totalDisponiveis ?? 0;
  const trendIa = data?.trendAcuraciaIa ?? 0;
  const trendHumano = data?.trendAcuraciaHumano ?? 0;
  const cobertura = totalDisponiveis > 0 ? Math.round((totalCurados / totalDisponiveis) * 100) : 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Acurácia IA */}
      <Card style={{ background: "var(--vf)", border: "none" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FFFFFF" }}>
            Acurácia IA
          </CardTitle>
          <Bot className="h-4 w-4" style={{ color: "#FFFFFF" }} />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "#FFFFFF" }}>
            {acuraciaIa.toFixed(1)}%
          </div>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.8)" }}>
            <TrendArrow value={trendIa} />
            {trendIa !== 0 ? `${trendIa > 0 ? "+" : ""}${trendIa.toFixed(1)}% últimos 7 dias` : "sem variação recente"}
          </p>
        </CardContent>
      </Card>

      {/* Acurácia Humano */}
      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Acurácia Humano
          </CardTitle>
          <User className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
            {acuraciaHumano.toFixed(1)}%
          </div>
          <p className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
            <TrendArrow value={trendHumano} />
            {trendHumano !== 0 ? `${trendHumano > 0 ? "+" : ""}${trendHumano.toFixed(1)}% últimos 7 dias` : "sem variação recente"}
          </p>
        </CardContent>
      </Card>

      {/* Custo Erro IA */}
      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Custo Erro IA
          </CardTitle>
          <DollarSign className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
            {formatBRL(custoErroIa)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">variação financeira estimada</p>
        </CardContent>
      </Card>

      {/* Trade-ins Curados */}
      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Trade-ins Curados
          </CardTitle>
          <CheckSquare className="h-4 w-4 text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
            {totalCurados.toLocaleString("pt-BR")}
            {totalDisponiveis > 0 && (
              <span className="text-base font-normal ml-1" style={{ color: "var(--l3)" }}>
                /{totalDisponiveis.toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cobertura}% de cobertura
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
