import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight, ArrowDownRight, Minus, Users, Bot } from "lucide-react";
import type { RankingAvaliadorCompleto, AvaliacoesFilters } from "@/hooks/use-avaliacoes";
import { useRankingAvaliadorCompleto } from "@/hooks/use-avaliacoes";

interface EvaluatorRankingProps {
  filtros?: AvaliacoesFilters;
}

function AssertividadeBadge({ value }: { value: number }) {
  if (value >= 80) {
    return (
      <Badge style={{ background: "rgba(0,161,55,0.12)", color: "#00A137", border: "none" }}>
        {value.toFixed(1)}%
      </Badge>
    );
  }
  if (value >= 60) {
    return (
      <Badge style={{ background: "rgba(192,122,0,0.12)", color: "#C07A00", border: "none" }}>
        {value.toFixed(1)}%
      </Badge>
    );
  }
  return (
    <Badge style={{ background: "rgba(197,48,48,0.12)", color: "#C53030", border: "none" }}>
      {value.toFixed(1)}%
    </Badge>
  );
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500 inline" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-400 inline" />;
  return <Minus className="h-4 w-4 text-muted-foreground inline" />;
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 rounded" style={{ background: "var(--sep)", width: i === 1 ? "120px" : "60px" }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function EvaluatorRanking({ filtros = {} }: EvaluatorRankingProps) {
  const { data, isLoading } = useRankingAvaliadorCompleto(filtros);
  const ranking: RankingAvaliadorCompleto[] = data?.data ?? [];

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Ranking de Avaliadores
        </CardTitle>
        <CardDescription>Assertividade por avaliador humano no periodo (grade humano vs curador)</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "var(--sep)" }}>
                <TableHead className="w-10 text-center" style={{ color: "var(--l3)", fontSize: 10 }}>#</TableHead>
                <TableHead style={{ color: "var(--l3)", fontSize: 10 }}>AVALIADOR</TableHead>
                <TableHead className="text-right" style={{ color: "var(--l3)", fontSize: 10 }}>DISPOS.</TableHead>
                <TableHead className="text-right" style={{ color: "var(--l3)", fontSize: 10 }}>ACERTOS</TableHead>
                <TableHead className="text-right" style={{ color: "var(--l3)", fontSize: 10 }}>ERROS</TableHead>
                <TableHead className="text-center" style={{ color: "var(--l3)", fontSize: 10 }}>ASSERTIV.</TableHead>
                <TableHead className="text-center" style={{ color: "var(--l3)", fontSize: 10 }}>TREND</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : ranking.length > 0 ? (
                ranking.map((av, idx) => (
                  <TableRow
                    key={av.avaliadorNome}
                    style={{ borderColor: "var(--sep)" }}
                    className={av.isAutomatica ? "opacity-60" : ""}
                  >
                    <TableCell className="text-center font-mono text-sm" style={{ color: "var(--l3)" }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate max-w-[140px]" style={{ color: "var(--l1)" }}>
                          {av.avaliadorNome}
                        </span>
                        {av.isAutomatica && (
                          <Badge
                            className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0"
                            style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1", border: "none" }}
                          >
                            <Bot className="h-2.5 w-2.5 mr-0.5" />
                            Auto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm" style={{ color: "var(--l2)" }}>
                      {av.totalDispositivos.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-400">
                      {av.acertos.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-400">
                      {av.erros.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center">
                      <AssertividadeBadge value={av.assertividade} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className="flex items-center justify-center gap-1 text-xs"
                        style={{ color: av.trend > 0 ? "#00A137" : av.trend < 0 ? "#C53030" : "var(--l3)" }}
                      >
                        <TrendIcon value={av.trend} />
                        {av.trend !== 0 ? `${av.trend > 0 ? "+" : ""}${av.trend.toFixed(1)}%` : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    Inicie a curadoria para ver o ranking.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
