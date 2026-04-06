import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";
import { useCustoErro } from "@/hooks/use-avaliacoes";

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

export function CostImpactCard({ filtros = {} }: CostImpactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useCustoErro(filtros);
  const result = data?.data;

  const custoIa = result?.custoTotalIa ?? 0;
  const custoHumano = result?.custoTotalHumano ?? 0;
  const breakdown = result?.breakdownPorTipoErro ?? [];
  const topModelos = result?.topModelosCustoErro ?? [];

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-400" />
          Impacto Financeiro dos Erros
        </CardTitle>
        <CardDescription>Variação de valor estimada por erros de classificação</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 rounded" style={{ background: "var(--sep)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Main numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "var(--bg3)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--l3)" }}>
                  Erro IA
                </p>
                <p className="text-xl font-bold" style={{ color: "var(--l1)" }}>
                  {formatBRL(custoIa)}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--bg3)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--l3)" }}>
                  Erro Humano
                </p>
                <p className="text-xl font-bold" style={{ color: "var(--l1)" }}>
                  {formatBRL(custoHumano)}
                </p>
              </div>
            </div>

            {/* Expand toggle */}
            {(breakdown.length > 0 || topModelos.length > 0) && (
              <button
                onClick={() => setExpanded((p) => !p)}
                className="w-full flex items-center justify-between text-xs py-1.5 px-2 rounded"
                style={{ color: "var(--l2)", background: "var(--bg3)" }}
              >
                <span>Ver detalhamento</span>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}

            {expanded && (
              <div className="space-y-4">
                {/* Breakdown por transição */}
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
                            <span style={{ color: "var(--l3)" }}>×{item.quantidade}</span>
                          </div>
                          <span className="font-mono font-medium" style={{ color: "var(--l1)" }}>
                            {formatBRL(item.custoTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top modelos */}
                {topModelos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--l3)" }}>
                      Top modelos por variação
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

            {breakdown.length === 0 && custoIa === 0 && custoHumano === 0 && (
              <p className="text-sm text-center py-2 text-muted-foreground">
                Nenhum dado de curadoria ainda.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
