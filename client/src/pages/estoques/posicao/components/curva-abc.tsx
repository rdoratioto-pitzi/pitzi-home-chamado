import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CurvaABCData {
  resumo: {
    classeA: { qtde: number; valor: number; pctItens: number; pctValor: number };
    classeB: { qtde: number; valor: number; pctItens: number; pctValor: number };
    classeC: { qtde: number; valor: number; pctItens: number; pctValor: number };
    valorTotal: number;
    totalItens: number;
  };
  itens: Array<{
    codigoErp: string;
    descricao: string;
    categoria: string;
    marca: string;
    qtde: number;
    custo: number;
    valor: number;
    classe: "A" | "B" | "C";
    pctAcumulado: number;
    pctItens: number;
  }>;
  grafico: Array<{
    name: string;
    valor: number;
    pctAcumulado: number;
    classe: string;
  }>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const BADGE_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-amber-100 text-amber-800 border-amber-300",
  C: "bg-slate-100 text-slate-700 border-slate-300",
};

const CARD_BORDER: Record<string, string> = {
  A: "border-l-emerald-500",
  B: "border-l-amber-500",
  C: "border-l-slate-400",
};

function ClasseCard({ classe, dados }: { classe: "A" | "B" | "C"; dados: { qtde: number; valor: number; pctItens: number; pctValor: number } }) {
  return (
    <Card className={`border-l-4 ${CARD_BORDER[classe]}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Classe {classe}</CardTitle>
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${BADGE_COLORS[classe]}`}>
            {classe}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Itens:</span>
          <span className="font-medium">{dados.qtde} ({dados.pctItens}%)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor:</span>
          <span className="font-medium">{formatCurrency(dados.valor)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">% do Total:</span>
          <span className="text-lg font-bold">{dados.pctValor}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

async function fetchCurvaABC(): Promise<CurvaABCData> {
  const res = await fetch("/api/estoques/dashboard/curva-abc");
  if (!res.ok) throw new Error("Erro ao buscar Curva ABC");
  const json = await res.json();
  return json.data;
}

type FiltroClasse = "A" | "B" | "C" | "todas";

export function CurvaABC() {
  const [filtroClasse, setFiltroClasse] = useState<FiltroClasse>("todas");

  const { data, isLoading, error } = useQuery({
    queryKey: ["estoqueCurvaABC"],
    queryFn: fetchCurvaABC,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Erro ao carregar dados da Curva ABC.
      </div>
    );
  }

  const itensFiltrados =
    filtroClasse === "todas" ? data.itens : data.itens.filter((i) => i.classe === filtroClasse);

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ClasseCard classe="A" dados={data.resumo.classeA} />
        <ClasseCard classe="B" dados={data.resumo.classeB} />
        <ClasseCard classe="C" dados={data.resumo.classeC} />
      </div>

      {/* Gráfico de Pareto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gráfico de Pareto — Top 30 Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data.grafico} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={10}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                fontSize={11}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                fontSize={11}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "Valor (R$)") return [formatCurrency(value), name];
                  return [`${value}%`, name];
                }}
              />
              <Legend verticalAlign="top" />
              <ReferenceLine
                yAxisId="right"
                y={80}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{ value: "80%", position: "right", fontSize: 10, fill: "#f59e0b" }}
              />
              <ReferenceLine
                yAxisId="right"
                y={95}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: "95%", position: "right", fontSize: 10, fill: "#ef4444" }}
              />
              <Bar yAxisId="left" dataKey="valor" fill="#3b82f6" name="Valor (R$)" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pctAcumulado"
                stroke="#ef4444"
                name="% Acumulado"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filtro + Tabela */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Itens por Classificação ({itensFiltrados.length} itens)
            </CardTitle>
            <div className="flex gap-2">
              {(["todas", "A", "B", "C"] as const).map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={filtroClasse === c ? "default" : "outline"}
                  onClick={() => setFiltroClasse(c)}
                >
                  {c === "todas" ? "Todas" : `Classe ${c}`}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Código ERP</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Qtde</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">% Item</TableHead>
                  <TableHead className="text-right">% Acumulado</TableHead>
                  <TableHead className="text-center">Classe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.map((item, idx) => (
                  <TableRow key={item.codigoErp || idx}>
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{item.codigoErp}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{item.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.categoria}</TableCell>
                    <TableCell className="text-right text-sm">{item.qtde}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(item.valor)}</TableCell>
                    <TableCell className="text-right text-sm">{item.pctItens}%</TableCell>
                    <TableCell className="text-right text-sm">{item.pctAcumulado}%</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`${BADGE_COLORS[item.classe]} border text-xs`}
                        variant="outline"
                      >
                        {item.classe}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {itensFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Nenhum item encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
