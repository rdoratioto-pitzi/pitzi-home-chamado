import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Package, DollarSign, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PontoEvolucao {
  data: string;
  valor: number;
}

interface PontoQtde {
  data: string;
  quantidade: number;
}

interface PontoProjecao {
  data: string;
  valor: number;
  projecao: boolean;
}

interface Sazonalidade {
  mes: string;
  variacao: string;
  tipo: 'pico' | 'baixa';
}

interface TendenciasDados {
  evolucaoEstoque: PontoEvolucao[];
  evolucaoQuantidade: PontoQtde[];
  previsaoDemanda: PontoProjecao[];
  sazonalidade: Sazonalidade[];
  valorAtual: number;
  qtdeAtual: number;
  variacaoTotal: number;
  projecao3Meses: number;
  periodo: string;
}

interface Props {
  dados: TendenciasDados | undefined;
  isLoading: boolean;
  periodo: string;
  onPeriodoChange: (p: string) => void;
}

const PERIODO_LABELS: Record<string, string> = {
  '6m': '6 meses', '12m': '12 meses', '24m': '24 meses',
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg p-2 text-xs shadow">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, idx: number) => (
        <p key={idx} style={{ color: p.color }}>
          {p.name}: {p.name === 'Valor (R$)' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export function Tendencias({ dados, isLoading, periodo, onPeriodoChange }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const variacaoTotal = dados?.variacaoTotal ?? 0;
  const crescendo = variacaoTotal >= 0;

  // Combinar histórico + projeção para o gráfico
  const evolucaoEstoque = dados?.evolucaoEstoque ?? [];
  const previsaoDemanda = dados?.previsaoDemanda ?? [];
  const evolucaoQuantidade = dados?.evolucaoQuantidade ?? [];

  // Merge valor histórico e projeção num único array para o gráfico principal
  const dadosGrafico = [
    ...evolucaoEstoque.map(p => ({ data: p.data, valor: p.valor, projecao: undefined })),
    ...previsaoDemanda.map(p => ({ data: p.data, valor: undefined, projecao: p.valor })),
  ];

  const sazonalidade = dados?.sazonalidade ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Tendências e Projeções
          </CardTitle>
          <Select value={periodo} onValueChange={onPeriodoChange}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODO_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cards de insight */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2.5">
            <p className="text-xs text-muted-foreground mb-1">Tendência</p>
            <div className="flex items-center gap-1">
              {crescendo
                ? <TrendingUp className="h-4 w-4 text-green-500" />
                : <TrendingDown className="h-4 w-4 text-red-500" />}
              <span className={`text-sm font-bold ${crescendo ? 'text-green-600' : 'text-red-600'}`}>
                {crescendo ? '+' : ''}{variacaoTotal.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">no período</p>
          </div>

          <div className="rounded-lg border p-2.5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />Projeção 3m
            </p>
            <p className="text-sm font-bold">{formatCurrency(dados?.projecao3Meses ?? 0)}</p>
            <p className="text-xs text-muted-foreground">valor estimado</p>
          </div>

          <div className="rounded-lg border p-2.5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Package className="h-3 w-3" />Qtde Atual
            </p>
            <p className="text-sm font-bold">{dados?.qtdeAtual?.toLocaleString('pt-BR') ?? 0}</p>
            <p className="text-xs text-muted-foreground">itens em estoque</p>
          </div>
        </div>

        {/* Gráfico de linha — Evolução do Valor */}
        {dadosGrafico.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Evolução do Valor do Estoque</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={dadosGrafico} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  name="Valor (R$)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projecao"
                  name="Projeção (R$)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico — Evolução de Quantidade */}
        {evolucaoQuantidade.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Evolução da Quantidade</p>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={evolucaoQuantidade} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [v, 'Quantidade']} />
                <Line type="monotone" dataKey="quantidade" name="Quantidade" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sazonalidade */}
        {sazonalidade.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />Sazonalidade Identificada
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {sazonalidade.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-xs">{s.mes}</span>
                  <Badge className={`text-xs ${s.tipo === 'pico' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}`}>
                    {s.variacao}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
