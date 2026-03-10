import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutGrid,
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";
import type { KanbanCard, KanbanColumn, User } from "@shared/schema";

interface DashboardViewProps {
  projectId: string;
  cards: KanbanCard[];
  columns: KanbanColumn[];
  users: User[];
}

interface ProjectMetrics {
  totalCards: number;
  cardsByColumn: { columnId: string; columnName: string; count: number }[];
  cardsByPriority: { priority: string; count: number }[];
  cardsByAssignee: { userId: string; userName: string; count: number }[];
  overdue: number;
  completionRate: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  muito_urgente: "#ef4444",
  urgente: "#f97316",
  normal: "#3b82f6",
};

const PRIORITY_LABELS: Record<string, string> = {
  muito_urgente: "Muito Urgente",
  urgente: "Urgente",
  normal: "Normal",
};

const COLUMN_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
];

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  colorClass = "text-foreground",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView({ projectId, cards, columns, users }: DashboardViewProps) {
  const { data: metrics, isLoading } = useQuery<ProjectMetrics>({
    queryKey: ["/api/projects", projectId, "metrics"],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  // Fallback: calcular métricas localmente se o backend não retornar
  const totalCards = metrics?.totalCards ?? cards.length;
  const overdue = metrics?.overdue ?? cards.filter(c => {
    if (!c.dueDate) return false;
    return new Date(c.dueDate) < new Date();
  }).length;

  const completionRate = metrics?.completionRate ?? (() => {
    const lastColumn = columns[columns.length - 1];
    if (!lastColumn || cards.length === 0) return 0;
    const done = cards.filter(c => c.columnId === lastColumn.id).length;
    return Math.round((done / cards.length) * 100);
  })();

  // Cards por coluna
  const cardsByColumn = metrics?.cardsByColumn ?? columns.map(col => ({
    columnId: col.id,
    columnName: col.name,
    count: cards.filter(c => c.columnId === col.id).length,
  }));

  // Cards por prioridade
  const cardsByPriority = metrics?.cardsByPriority ?? Object.entries(PRIORITY_LABELS).map(([priority, label]) => ({
    priority: label,
    count: cards.filter(c => c.priority === priority).length,
  }));

  // Cards por responsável
  const cardsByAssignee = metrics?.cardsByAssignee ?? users
    .map(u => ({
      userId: u.id,
      userName: u.name.split(" ")[0],
      count: cards.filter(c => c.assigneeId === u.id).length,
    }))
    .filter(a => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Progresso médio
  const cardsWithProgress = cards.filter(c => (c.progress ?? 0) > 0);
  const avgProgress = cardsWithProgress.length > 0
    ? Math.round(cardsWithProgress.reduce((acc, c) => acc + (c.progress ?? 0), 0) / cardsWithProgress.length)
    : 0;

  const pieData = cardsByPriority.map(item => ({
    name: PRIORITY_LABELS[item.priority] ?? item.priority,
    value: item.count,
  })).filter(d => d.value > 0);

  const barData = cardsByColumn.map((item, idx) => ({
    name: item.columnName,
    cards: item.count,
    fill: COLUMN_COLORS[idx % COLUMN_COLORS.length],
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total de Cards"
          value={totalCards}
          icon={LayoutGrid}
          description={`Em ${columns.length} colunas`}
        />
        <StatCard
          title="Atrasados"
          value={overdue}
          icon={AlertTriangle}
          colorClass={overdue > 0 ? "text-red-500" : "text-muted-foreground"}
          description={overdue > 0 ? "Precisam de atenção" : "Nenhum atrasado"}
        />
        <StatCard
          title="Taxa de Conclusão"
          value={`${completionRate}%`}
          icon={CheckCircle2}
          colorClass={completionRate >= 70 ? "text-green-500" : completionRate >= 40 ? "text-orange-500" : "text-muted-foreground"}
          description="Cards na coluna final"
        />
        <StatCard
          title="Progresso Médio"
          value={`${avgProgress}%`}
          icon={TrendingUp}
          description={`De ${cardsWithProgress.length} cards com progresso`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cards por Coluna */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Cards por Coluna</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${value} cards`, "Quantidade"]}
                />
                <Bar dataKey="cards" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cards por Prioridade */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => {
                      const priorityKey = Object.entries(PRIORITY_LABELS).find(([, v]) => v === entry.name)?.[0];
                      return (
                        <Cell
                          key={index}
                          fill={priorityKey ? PRIORITY_COLORS[priorityKey] : "#6366f1"}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => [`${value} cards`, name]}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Nenhum card encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carga por Responsável */}
      {cardsByAssignee.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Carga por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cardsByAssignee.map((item) => {
                const pct = totalCards > 0 ? Math.round((item.count / totalCards) * 100) : 0;
                return (
                  <div key={item.userId} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-muted-foreground truncate">{item.userName}</div>
                    <Progress value={pct} className="flex-1 h-2" />
                    <Badge variant="secondary" className="text-[10px] h-5 w-10 justify-center flex-shrink-0">
                      {item.count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coluna a Coluna — progresso do pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Progresso do Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 overflow-x-auto pb-2">
            {cardsByColumn.map((col, idx) => {
              const pct = totalCards > 0 ? Math.round((col.count / totalCards) * 100) : 0;
              const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
              return (
                <div key={col.columnId} className="flex flex-col items-center gap-1 min-w-[80px]">
                  <span className="text-sm font-semibold">{col.count}</span>
                  <div
                    className="w-12 rounded-t-md transition-all"
                    style={{
                      height: `${Math.max(pct * 1.2, col.count > 0 ? 8 : 4)}px`,
                      backgroundColor: color,
                      opacity: col.count === 0 ? 0.3 : 1,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[80px] truncate">{col.columnName}</span>
                  <span className="text-[10px] text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
