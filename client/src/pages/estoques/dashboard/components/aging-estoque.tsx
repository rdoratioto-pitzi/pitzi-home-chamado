import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { Package, Timer, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface FaixaData {
  faixa: string;
  quantidade: number;
  valor: number;
  percentual: number;
}

interface ItemAntigo {
  imei: string;
  modelo: string;
  diasEstoque: number;
  valor: number;
}

interface AgingEstoqueData {
  faixas:     FaixaData[];
  mediaGeral: number;
  mediaMes:   Array<{ mes: string; media: number }>;
  topAntigos: ItemAntigo[];
  totais:     { quantidade: number; valor: number };
}

interface Props {
  dados?: AgingEstoqueData;
  isLoading: boolean;
}

const FAIXA_COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#7c3aed"];

function corFaixa(dias: number): string {
  if (dias <= 15) return "bg-green-100 text-green-800";
  if (dias <= 30) return "bg-yellow-100 text-yellow-800";
  if (dias <= 45) return "bg-orange-100 text-orange-800";
  if (dias <= 60) return "bg-red-100 text-red-800";
  return "bg-purple-100 text-purple-800";
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg p-2 text-xs shadow">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export function AgingEstoque({ dados, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const faixas     = dados?.faixas     ?? [];
  const mediaMes   = dados?.mediaMes   ?? [];
  const topAntigos = dados?.topAntigos ?? [];
  const totais     = dados?.totais     ?? { quantidade: 0, valor: 0 };
  const mediaGeral = dados?.mediaGeral ?? 0;
  const criticos   = faixas.filter(f => f.faixa === "60+d").reduce((a, f) => a + f.quantidade, 0);

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Estoque Total</p>
            </div>
            <p className="text-xl font-bold">{totais.quantidade.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(totais.valor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Aging Médio</p>
            </div>
            <p className="text-xl font-bold">{mediaGeral}d</p>
            <p className="text-xs text-muted-foreground">desde triagem</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Críticos &gt;60d</p>
            </div>
            <p className="text-xl font-bold text-red-600">{criticos}</p>
            <p className="text-xs text-muted-foreground">itens em risco</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras por faixa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Distribuição por Faixa de Aging</CardTitle>
        </CardHeader>
        <CardContent>
          {faixas.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                layout="vertical"
                data={faixas}
                margin={{ top: 4, right: 50, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis type="category" dataKey="faixa" tick={{ fontSize: 10 }} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quantidade" name="Dispositivos" radius={[0, 3, 3, 0]}>
                  {faixas.map((_, i) => <Cell key={i} fill={FAIXA_COLORS[i % FAIXA_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de aging disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tendência aging médio — últimos 6 meses */}
      {mediaMes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aging Médio — Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={mediaMes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} unit="d" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="media" name="Aging médio (d)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top 10 itens mais antigos */}
      {topAntigos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Top 10 Itens Mais Antigos no Estoque</CardTitle>
              <Link href="/estoques/rastreabilidade">
                <a className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  Ver Rastreabilidade <ExternalLink className="h-3 w-3" />
                </a>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">IMEI</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs text-right">Dias</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topAntigos.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono py-1.5">
                      {item.imei ? `${item.imei.slice(0, 8)}...` : "N/D"}
                    </TableCell>
                    <TableCell className="text-xs py-1.5">
                      {item.modelo || "N/D"}
                    </TableCell>
                    <TableCell className="text-right py-1.5">
                      <Badge className={`text-xs ${corFaixa(item.diasEstoque)}`}>
                        {item.diasEstoque}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5">
                      {formatCurrency(item.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
