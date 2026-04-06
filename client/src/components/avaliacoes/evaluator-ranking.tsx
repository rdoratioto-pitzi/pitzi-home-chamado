import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight, ArrowDownRight, Minus, Users } from "lucide-react";
import type { RankingAvaliador, AvaliacoesFilters } from "@/hooks/use-avaliacoes";
import { useRankingAvaliadores } from "@/hooks/use-avaliacoes";

interface EvaluatorRankingProps {
  filtros?: AvaliacoesFilters;
}

function AccuracyBadge({ value }: { value: number }) {
  if (value >= 90) {
    return (
      <Badge style={{ background: "rgba(0,161,55,0.12)", color: "#00A137", border: "none" }}>
        {value.toFixed(1)}%
      </Badge>
    );
  }
  if (value >= 70) {
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
  const { data, isLoading } = useRankingAvaliadores(filtros);
  const ranking: RankingAvaliador[] = data?.data ?? [];

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Ranking de Avaliadores
        </CardTitle>
        <CardDescription>Acurácia por avaliador humano no período</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--sep)" }}>
              <TableHead className="w-10 text-center" style={{ color: "var(--l3)", fontSize: 10 }}>#</TableHead>
              <TableHead style={{ color: "var(--l3)", fontSize: 10 }}>NOME</TableHead>
              <TableHead className="text-right" style={{ color: "var(--l3)", fontSize: 10 }}>TOTAL</TableHead>
              <TableHead className="text-center" style={{ color: "var(--l3)", fontSize: 10 }}>DISPLAY</TableHead>
              <TableHead className="text-center" style={{ color: "var(--l3)", fontSize: 10 }}>CARCAÇA</TableHead>
              <TableHead className="text-center" style={{ color: "var(--l3)", fontSize: 10 }}>GERAL</TableHead>
              <TableHead className="text-center" style={{ color: "var(--l3)", fontSize: 10 }}>TREND</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : ranking.length > 0 ? (
              ranking.map((av, idx) => (
                <TableRow key={av.avaliadorId} style={{ borderColor: "var(--sep)" }}>
                  <TableCell className="text-center font-mono text-sm" style={{ color: "var(--l3)" }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm" style={{ color: "var(--l1)" }}>
                      {av.avaliadorNome}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm" style={{ color: "var(--l2)" }}>
                    {av.totalAvaliacoes.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-center">
                    <AccuracyBadge value={av.acuraciaDisplay} />
                  </TableCell>
                  <TableCell className="text-center">
                    <AccuracyBadge value={av.acuraciaCarcaca} />
                  </TableCell>
                  <TableCell className="text-center">
                    <AccuracyBadge value={av.acuraciaGeral} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-xs" style={{ color: av.trend > 0 ? "#00A137" : av.trend < 0 ? "#C53030" : "var(--l3)" }}>
                      <TrendIcon value={av.trend} />
                      {av.trend !== 0 ? `${av.trend > 0 ? "+" : ""}${av.trend.toFixed(1)}%` : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum dado de curadoria ainda. Inicie a curadoria para ver o ranking.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
