import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import { RefreshCw, Calendar } from "lucide-react";

interface GiroCategoria {
  categoria: string;
  giro: number;
  dias: number;
  qtde: number;
  valor: number;
}

interface ComparativoMensal {
  mes: string;
  giro: number;
  dias: number;
}

interface GiroEstoqueData {
  giroGeral: number;
  diasEmEstoque: number;
  porCategoria: GiroCategoria[];
  comparativoMensal: ComparativoMensal[];
  periodo: string;
}

async function fetchGiroEstoque(periodo: string): Promise<GiroEstoqueData> {
  const res = await fetchWithAuth(`/api/estoques/dashboard/giro?periodo=${periodo}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (!json.data) {
    throw new Error("Resposta inválida do servidor");
  }
  return json.data;
}

function getStatus(giro: number): "bom" | "regular" | "baixo" {
  if (giro >= 1.5) return "bom";
  if (giro >= 1.0) return "regular";
  return "baixo";
}

const META = 1.5;

const StatusBadge = ({ status }: { status: "bom" | "regular" | "baixo" }) => {
  if (status === "bom") return <Badge className="bg-green-500 text-white">Bom</Badge>;
  if (status === "regular") return <Badge variant="secondary">Regular</Badge>;
  return <Badge variant="destructive">Baixo</Badge>;
};

const MetricaCard = ({
  titulo,
  valor,
  meta,
  abaixoDaMeta,
  icone,
  descricao,
}: {
  titulo: string;
  valor: string;
  meta: string;
  abaixoDaMeta: boolean;
  icone: React.ReactNode;
  descricao: string;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-3xl font-bold mt-1">{valor}</p>
          <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
        </div>
        <div
          className={`p-3 rounded-full ${
            abaixoDaMeta
              ? "bg-red-100 text-red-600"
              : "bg-green-100 text-green-600"
          }`}
        >
          {icone}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <span className="text-sm text-muted-foreground">{meta}</span>
        {abaixoDaMeta ? (
          <Badge variant="destructive">Abaixo da meta</Badge>
        ) : (
          <Badge className="bg-green-500 text-white">Acima da meta</Badge>
        )}
      </div>
    </CardContent>
  </Card>
);

const GiroEstoqueSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
    <Skeleton className="h-80" />
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-60" />
      <Skeleton className="h-60" />
    </div>
  </div>
);

export function GiroEstoque() {
  const [periodo, setPeriodo] = useState("90d");

  const { data, isLoading, error } = useQuery<GiroEstoqueData>({
    queryKey: ["estoques", "giro", periodo],
    queryFn: () => fetchGiroEstoque(periodo),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <GiroEstoqueSkeleton />;

  if (error || !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Erro ao carregar dados de giro de estoque.
      </div>
    );
  }

  const metaDias = META > 0 ? Math.round(365 / META) : 0;

  return (
    <div className="space-y-6">
      {/* Header com seletor de período */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Análise de Giro de Estoque</h2>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="60d">Últimos 60 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricaCard
          titulo="Giro Geral"
          valor={`${data.giroGeral}x`}
          meta={`Meta: ${META}x`}
          abaixoDaMeta={data.giroGeral < META}
          icone={<RefreshCw className="h-5 w-5" />}
          descricao="Vezes que o estoque é renovado no período"
        />
        <MetricaCard
          titulo="Dias em Estoque"
          valor={`${data.diasEmEstoque} dias`}
          meta={`Meta: ${metaDias} dias`}
          abaixoDaMeta={data.diasEmEstoque > metaDias}
          icone={<Calendar className="h-5 w-5" />}
          descricao="Tempo médio que um item permanece em estoque"
        />
      </div>

      {/* Gráfico de barras por categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Giro por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.porCategoria} layout="vertical" margin={{ right: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, "dataMax + 0.5"]} />
              <YAxis dataKey="categoria" type="category" width={110} />
              <Tooltip formatter={(value: number) => [`${value}x`, "Giro"]} />
              <ReferenceLine x={META} stroke="#f59e0b" strokeDasharray="5 5" label="Meta" />
              <Bar
                dataKey="giro"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                label={{ position: "right", formatter: (v: number) => `${v}x` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Grid: Tendência + Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de tendência mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Tendência do Giro</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.comparativoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis domain={[0, "dataMax + 0.5"]} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(2)}x`, "Giro"]} />
                <ReferenceLine y={META} stroke="#22c55e" strokeDasharray="5 5" label="Meta" />
                <Line
                  type="monotone"
                  dataKey="giro"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabela detalhada */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Giro</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.porCategoria.map((cat) => (
                  <TableRow key={cat.categoria}>
                    <TableCell className="font-medium">{cat.categoria}</TableCell>
                    <TableCell className="text-right">{cat.giro}x</TableCell>
                    <TableCell className="text-right">{cat.dias}d</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={getStatus(cat.giro)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
