import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, AlertCircle, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";
import { useImpactoFinanceiro, useCustoErro } from "@/hooks/use-avaliacoes";

interface CostImpactCardProps {
  filtros?: AvaliacoesFilters;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    A: { bg: "rgba(0,161,55,0.12)", text: "#00A137" },
    B: { bg: "rgba(192,122,0,0.12)", text: "#C07A00" },
    C: { bg: "rgba(197,48,48,0.12)", text: "#C53030" },
  };
  const c = colors[grade] ?? { bg: "var(--sep)", text: "var(--l2)" };
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: c.bg, color: c.text }}>
      {grade}
    </span>
  );
}

function TransicaoLabel({ transicao }: { transicao: string }) {
  const [from, to] = transicao.split("→");
  return (
    <span className="flex items-center gap-1">
      <GradeBadge grade={from} />
      <span style={{ color: "var(--l3)", fontSize: 10 }}>→</span>
      <GradeBadge grade={to} />
    </span>
  );
}

function ImpactoSection({ titulo, over, under, liquido }: {
  titulo: string;
  over: number;
  under: number;
  liquido: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
        {titulo}
      </p>
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <ArrowUpRight className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Over-grading</span>
            <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {formatBRL(over)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Grade melhor que a correta — Renov paga mais
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ArrowDownRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Under-grading</span>
            <span className="text-xs font-bold tabular-nums text-blue-700 dark:text-blue-400">
              {formatBRL(under)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Grade pior que a correta — cliente recebe menos
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded" style={{ background: "var(--bg3)" }}>
        <span className="text-xs font-medium" style={{ color: "var(--l2)" }}>Impacto liquido</span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: liquido >= 0 ? "#00A137" : "#C53030" }}
        >
          {liquido >= 0 ? "+" : ""}{formatBRL(liquido)}
        </span>
      </div>
    </div>
  );
}

export function CostImpactCard({ filtros = {} }: CostImpactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: impactoData, isLoading: impactoLoading } = useImpactoFinanceiro(filtros);
  const { data: custoData, isLoading: custoLoading } = useCustoErro(filtros);

  const impacto = impactoData?.data;
  const custoResult = custoData?.data;
  const breakdown = custoResult?.breakdownPorTipoErro ?? [];
  const topModelos = custoResult?.topModelosCustoErro ?? [];
  const isLoading = impactoLoading || custoLoading;

  const hasData = impacto && impacto.totalCuradorias > 0;

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-400" />
          Impacto Financeiro dos Erros
        </CardTitle>
        <CardDescription>
          Variacao de valor por erros de classificacao (voucher real via API)
          {impacto?.usouEstimativa && (
            <span className="inline-flex items-center gap-1 ml-1 text-amber-500">
              <Info className="h-3 w-3" />
              <span className="text-[10px]">(parcialmente estimado)</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : hasData ? (
          <>
            <ImpactoSection
              titulo="Erro IA"
              over={impacto.erroIa.overGrading}
              under={impacto.erroIa.underGrading}
              liquido={impacto.erroIa.liquidoImpacto}
            />

            <div className="border-t" style={{ borderColor: "var(--sep)" }} />

            <ImpactoSection
              titulo="Erro Humano"
              over={impacto.erroHumano.overGrading}
              under={impacto.erroHumano.underGrading}
              liquido={impacto.erroHumano.liquidoImpacto}
            />

            {/* Expand toggle for breakdown details */}
            {(breakdown.length > 0 || topModelos.length > 0) && (
              <>
                <button
                  onClick={() => setExpanded((p) => !p)}
                  className="w-full flex items-center justify-between text-xs py-1.5 px-2 rounded"
                  style={{ color: "var(--l2)", background: "var(--bg3)" }}
                >
                  <span>Ver detalhamento por transicao</span>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {expanded && (
                  <div className="space-y-4">
                    {breakdown.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--l3)" }}>
                          Por tipo de erro
                        </p>
                        <div className="space-y-1.5">
                          {breakdown.map((item) => (
                            <div key={item.transicao} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <TransicaoLabel transicao={item.transicao} />
                                <span style={{ color: "var(--l3)" }}>x{item.quantidade}</span>
                              </div>
                              <span className="font-mono font-medium" style={{ color: "var(--l1)" }}>
                                {formatBRL(item.custoTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {topModelos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--l3)" }}>
                          Top modelos por variacao
                        </p>
                        <div className="space-y-1.5">
                          {topModelos.map((item) => (
                            <div key={item.modelo} className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[140px]" style={{ color: "var(--l2)" }}>{item.modelo}</span>
                              <span className="font-mono font-medium" style={{ color: "var(--l1)" }}>
                                {formatBRL(item.custoTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-center py-4 text-muted-foreground">
            Inicie a curadoria para ver impacto financeiro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
