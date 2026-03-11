import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface TendenciaPonto {
  semana: string;
  cicloTotal: number;
  preEstoque: number;
  agingEstoque: number;
  amostras: number;
}

interface Props {
  dados: TendenciaPonto[] | undefined;
  isLoading: boolean;
}

export function TendenciaChart({ dados, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground border rounded-xl">
        Dados insuficientes para exibir tendência.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}d`} />
        <Tooltip
          formatter={(value: number, name: string) => {
            const labels: Record<string, string> = {
              cicloTotal: "Ciclo Total",
              preEstoque: "Pré-Estoque",
              agingEstoque: "Aging Estoque",
            };
            return [`${value}d`, labels[name] ?? name];
          }}
        />
        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = {
              cicloTotal: "Ciclo Total",
              preEstoque: "Pré-Estoque",
              agingEstoque: "Aging Estoque",
            };
            return labels[value] ?? value;
          }}
        />
        <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Meta 30d", position: "right", fontSize: 10, fill: "#ef4444" }} />
        <Line type="monotone" dataKey="cicloTotal"    stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="preEstoque"   stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
        <Line type="monotone" dataKey="agingEstoque" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
