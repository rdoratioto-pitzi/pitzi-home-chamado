import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CheckCircle, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Faixa {
  qtde: number;
  valor: number;
  label: string;
  cor: string;
}

interface ItemCritico {
  codigoErp: string;
  descricao: string;
  categoria: string;
  marca: string;
  qtde: number;
  valor: number;
  diasEstimados: number;
  ultimaMovimentacao: string;
}

interface AgingDados {
  resumo: {
    faixa1: Faixa;
    faixa2: Faixa;
    faixa3: Faixa;
    faixa4: Faixa;
  };
  itensCriticos: ItemCritico[];
  grafico: { name: string; value: number; valor: number; fill: string }[];
  limite: number;
}

interface Props {
  dados: AgingDados | undefined;
  isLoading: boolean;
}

const FAIXAS = [
  { key: 'faixa1', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800' },
  { key: 'faixa2', icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' },
  { key: 'faixa3', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-800' },
  { key: 'faixa4', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800' },
];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded-lg p-2 text-xs shadow">
      <p className="font-medium">{d.name}</p>
      <p>{d.value} itens</p>
      <p>{formatCurrency(d.valor)}</p>
    </div>
  );
};

export function AgingReport({ dados, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const resumo = dados?.resumo;
  const grafico = dados?.grafico ?? [];
  const itensCriticos = dados?.itensCriticos ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Aging Report (Tempo em Estoque)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 4 Cards de faixa */}
        {resumo && (
          <div className="grid grid-cols-2 gap-2">
            {FAIXAS.map(({ key, icon: Icon, color, bg }) => {
              const faixa = resumo[key as keyof typeof resumo];
              return (
                <div key={key} className={`rounded-lg border p-2.5 ${bg}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-xs font-medium">{faixa.label}</span>
                  </div>
                  <p className="text-lg font-bold">{faixa.qtde} itens</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(faixa.valor)}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Gráfico de Pizza */}
        {grafico.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição por Faixa</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={grafico}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  dataKey="value"
                  labelLine={false}
                  label={<CustomLabel />}
                >
                  {grafico.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela de itens críticos */}
        {itensCriticos.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Itens Críticos (90+ dias) — {itensCriticos.length} item{itensCriticos.length !== 1 ? 's' : ''}
            </p>
            <div className="rounded-md border overflow-hidden max-h-36 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">Modelo</TableHead>
                    <TableHead className="text-xs py-2 text-right">Dias</TableHead>
                    <TableHead className="text-xs py-2 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensCriticos.slice(0, 20).map((item, idx) => (
                    <TableRow key={idx} className="bg-red-50/50">
                      <TableCell className="text-xs py-1.5 truncate max-w-28">
                        {item.descricao || item.codigoErp}
                      </TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-medium text-red-600">
                        {item.diasEstimados}d
                      </TableCell>
                      <TableCell className="text-xs py-1.5 text-right">
                        {formatCurrency(item.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {itensCriticos.length === 0 && !isLoading && (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum item crítico (90+ dias)</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
