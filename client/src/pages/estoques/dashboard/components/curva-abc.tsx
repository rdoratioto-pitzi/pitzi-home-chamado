import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Cell,
} from "recharts";
import { BarChart2, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ItemABC {
  codigoErp: string;
  descricao: string;
  categoria: string;
  marca: string;
  qtde: number;
  custo: number;
  valor: number;
  classe: 'A' | 'B' | 'C';
  pctAcumulado: number;
  pctItens: number;
}

interface ResumoClasse {
  qtde: number;
  valor: number;
  pctItens: number;
  pctValor: number;
}

interface CurvaABCDados {
  resumo: {
    classeA: ResumoClasse;
    classeB: ResumoClasse;
    classeC: ResumoClasse;
    valorTotal: number;
    totalItens: number;
  };
  itens: ItemABC[];
  grafico: { name: string; valor: number; pctAcumulado: number; classe: string }[];
}

interface Props {
  dados: CurvaABCDados | undefined;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const CLASSE_CONFIG = {
  A: { label: 'Classe A', bg: 'bg-green-100', text: 'text-green-800', fill: '#22c55e', hover: 'hover:bg-green-100' },
  B: { label: 'Classe B', bg: 'bg-yellow-100', text: 'text-yellow-800', fill: '#eab308', hover: 'hover:bg-yellow-100' },
  C: { label: 'Classe C', bg: 'bg-gray-100', text: 'text-gray-600', fill: '#9ca3af', hover: 'hover:bg-gray-100' },
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded-lg p-2 text-xs shadow">
      <p className="font-medium truncate max-w-32">{d.name}</p>
      <p>Valor: {formatCurrency(d.valor)}</p>
      <p>Acumulado: {d.pctAcumulado?.toFixed(1)}%</p>
      <Badge className={`${CLASSE_CONFIG[d.classe as 'A'|'B'|'C']?.bg} ${CLASSE_CONFIG[d.classe as 'A'|'B'|'C']?.text} text-xs`}>
        {d.classe}
      </Badge>
    </div>
  );
};

export function CurvaABC({ dados, isLoading, isError, onRetry }: Props) {
  const [filtroClasse, setFiltroClasse] = useState<'todos' | 'A' | 'B' | 'C'>('todos');

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-5 w-5 text-purple-500" />
            Curva ABC
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <p className="text-sm">Não foi possível carregar os dados.</p>
          {onRetry && (
            <button onClick={onRetry} className="text-xs underline hover:text-foreground">
              Tentar novamente
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  const resumo = dados?.resumo;
  const grafico = dados?.grafico ?? [];
  const itens = dados?.itens ?? [];
  const itensFiltrados = filtroClasse === 'todos' ? itens : itens.filter(i => i.classe === filtroClasse);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="h-5 w-5 text-purple-500" />
          Curva ABC
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cards das classes */}
        {resumo && (
          <div className="grid grid-cols-3 gap-2">
            {(['A', 'B', 'C'] as const).map((cls) => {
              const config = CLASSE_CONFIG[cls];
              const data = resumo[`classe${cls}` as 'classeA' | 'classeB' | 'classeC'];
              return (
                <div key={cls} className="rounded-lg border p-2.5">
                  <Badge className={`${config.bg} ${config.text} ${config.hover} mb-1.5`}>{config.label}</Badge>
                  <p className="text-xs text-muted-foreground">{data.qtde} itens ({data.pctItens}%)</p>
                  <p className="text-sm font-semibold">{formatCurrency(data.valor)}</p>
                  <p className="text-xs text-muted-foreground">{data.pctValor}% do valor</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Gráfico de Pareto */}
        {grafico.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Gráfico de Pareto (top 30)</p>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={grafico} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine yAxisId="right" y={80} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '80%', fontSize: 9, fill: '#22c55e' }} />
                <ReferenceLine yAxisId="right" y={95} stroke="#eab308" strokeDasharray="4 4" label={{ value: '95%', fontSize: 9, fill: '#eab308' }} />
                <Bar yAxisId="left" dataKey="valor" radius={[2, 2, 0, 0]}>
                  {grafico.map((entry, idx) => (
                    <Cell key={idx} fill={CLASSE_CONFIG[entry.classe as 'A' | 'B' | 'C']?.fill ?? '#9ca3af'} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="pctAcumulado" stroke="#6366f1" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela com filtro */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Itens</p>
            <div className="flex gap-1 ml-auto">
              {(['todos', 'A', 'B', 'C'] as const).map((cls) => (
                <Button
                  key={cls}
                  size="sm"
                  variant={filtroClasse === cls ? 'default' : 'outline'}
                  className="h-6 px-2 text-xs"
                  onClick={() => setFiltroClasse(cls)}
                >
                  {cls === 'todos' ? 'Todos' : cls}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-md border overflow-hidden max-h-36 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Descrição</TableHead>
                  <TableHead className="text-xs py-2 text-right">Valor</TableHead>
                  <TableHead className="text-xs py-2 text-right">Acum.</TableHead>
                  <TableHead className="text-xs py-2">Classe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.slice(0, 30).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs py-1.5 truncate max-w-24">{item.descricao || item.codigoErp}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{formatCurrency(item.valor)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{item.pctAcumulado}%</TableCell>
                    <TableCell className="text-xs py-1.5">
                      <Badge className={`${CLASSE_CONFIG[item.classe].bg} ${CLASSE_CONFIG[item.classe].text} ${CLASSE_CONFIG[item.classe].hover}`}>
                        {item.classe}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {itensFiltrados.length > 30 && (
            <p className="text-xs text-muted-foreground mt-1">
              Mostrando 30 de {itensFiltrados.length} itens
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
