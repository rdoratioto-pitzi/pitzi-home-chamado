import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart2, TrendingUp, GitMerge, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface GraficosData {
  volumeTendencia:   Array<{ mes: string; processados: number; triados: number }>;
  leadTimeTendencia: Array<{ semana: string; cicloTotal: number; preEstoque: number; agingEstoque: number }>;
  distribuicaoEtapa: Array<{ etapa: string; quantidade: number; cor: string }>;
  agingEstoque:      Array<{ faixa: string; quantidade: number; percentual: number }>;
}

interface Props {
  dados?: GraficosData;
  isLoading: boolean;
}

const AGING_COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#7c3aed"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg p-2 text-xs shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-medium">{p.value?.toLocaleString("pt-BR")}</span>
        </p>
      ))}
    </div>
  );
};

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
      <CardContent><Skeleton className="h-44 w-full" /></CardContent>
    </Card>
  );
}

export function GraficosExecutivo({ dados, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <ChartSkeleton key={i} />)}
      </div>
    );
  }

  const volume    = dados?.volumeTendencia   ?? [];
  const leadTime  = dados?.leadTimeTendencia ?? [];
  const etapas    = dados?.distribuicaoEtapa ?? [];
  const agingData = dados?.agingEstoque      ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* 1. Volume Processado vs Triado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            Volume Processado vs Triado (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {volume.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={volume} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="processados" name="Processados" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="triados"     name="Triados"     fill="#22c55e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de volume disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Lead Time Tendência */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            Lead Time — Tendência (12 semanas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leadTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={leadTime} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} unit="d" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="cicloTotal"   name="Ciclo Total"   stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="preEstoque"   name="Pré-Estoque"   stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="agingEstoque" name="Aging Estoque" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de lead time disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Distribuição por Etapa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-green-500" />
            Distribuição por Etapa (Pipeline)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etapas.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                layout="vertical"
                data={etapas}
                margin={{ top: 4, right: 40, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis type="category" dataKey="etapa" tick={{ fontSize: 9 }} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quantidade" name="Dispositivos" radius={[0, 3, 3, 0]}>
                  {etapas.map((e, i) => (
                    <Cell key={i} fill={e.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de pipeline disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Aging de Estoque (donut) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Aging de Estoque (faixas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agingData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={agingData}
                    dataKey="quantidade"
                    nameKey="faixa"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                  >
                    {agingData.map((_, i) => (
                      <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {agingData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: AGING_COLORS[i % AGING_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{d.faixa}</span>
                    </div>
                    <span className="font-medium">{d.percentual}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de aging disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
