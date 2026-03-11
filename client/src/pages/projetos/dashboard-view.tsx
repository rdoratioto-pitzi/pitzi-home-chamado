import React from "react";
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
import {
  LayoutGrid,
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  Circle,
  Clock,
} from "lucide-react";
import type { KanbanCard, KanbanColumn, User } from "@shared/schema";

interface DashboardViewProps {
  projectId: string;
  cards: KanbanCard[];
  columns: KanbanColumn[];
  users: User[];
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

const STATUS_CONFIG = [
  { key: "todo",  label: "A Fazer",      color: "#94a3b8", Icon: Circle,       iconClass: "text-slate-500"  },
  { key: "doing", label: "Em Andamento", color: "#3b82f6", Icon: Clock,        iconClass: "text-blue-500"   },
  { key: "done",  label: "Concluído",    color: "#22c55e", Icon: CheckCircle2, iconClass: "text-green-500"  },
] as const;

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

export function DashboardView({ cards, columns, users }: DashboardViewProps) {
  // --- Métricas por status ---
  const todoCards  = cards.filter(c => (c.status || "todo") === "todo");
  const doingCards = cards.filter(c => (c.status || "todo") === "doing");
  const doneCards  = cards.filter(c => (c.status || "todo") === "done");

  const totalCards = cards.length;

  // Atrasados: dueDate no passado e não concluído
  const overdue = cards.filter(c => {
    if (!c.dueDate || (c.status || "todo") === "done") return false;
    return new Date(c.dueDate) < new Date();
  }).length;

  // Taxa de conclusão baseada em status=done
  const completionRate = totalCards > 0
    ? Math.round((doneCards.length / totalCards) * 100)
    : 0;

  // Progresso médio
  const cardsWithProgress = cards.filter(c => (c.progress ?? 0) > 0);
  const avgProgress = cardsWithProgress.length > 0
    ? Math.round(cardsWithProgress.reduce((acc, c) => acc + (c.progress ?? 0), 0) / cardsWithProgress.length)
    : 0;

  // --- Dados para gráficos ---
  const barDataStatus = STATUS_CONFIG.map(s => ({
    name: s.label,
    cards: cards.filter(c => (c.status || "todo") === s.key).length,
    fill: s.color,
  }));

  const pieData = Object.entries(PRIORITY_LABELS)
    .map(([priority, label]) => ({
      name: label,
      value: cards.filter(c => c.priority === priority).length,
      priority,
    }))
    .filter(d => d.value > 0);

  // Cards por coluna (mantido para referência)
  const cardsByColumn = columns.map((col, idx) => ({
    columnName: col.name,
    count: cards.filter(c => c.columnId === col.id).length,
    idx,
  })).filter(c => c.count > 0);

  // Carga por responsável
  const cardsByAssignee = users
    .map(u => ({
      userId: u.id,
      userName: u.name.split(" ")[0],
      fullName: u.name,
      count: cards.filter(c => c.assigneeId === u.id).length,
      todo:  cards.filter(c => c.assigneeId === u.id && (c.status || "todo") === "todo").length,
      doing: cards.filter(c => c.assigneeId === u.id && (c.status || "todo") === "doing").length,
      done:  cards.filter(c => c.assigneeId === u.id && (c.status || "todo") === "done").length,
    }))
    .filter(a => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6 pb-8">
      {/* Row 1 — Stats gerais */}
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
          description="Cards com status Concluído"
        />
        <StatCard
          title="Progresso Médio"
          value={`${avgProgress}%`}
          icon={TrendingUp}
          description={`De ${cardsWithProgress.length} cards com progresso`}
        />
      </div>

      {/* Row 2 — KPIs por status */}
      <div className="grid grid-cols-3 gap-4">
        {STATUS_CONFIG.map(({ key, label, Icon, iconClass, color }) => {
          const count = cards.filter(c => (c.status || "todo") === key).length;
          const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
          return (
            <Card key={key} className="border-t-2" style={{ borderTopColor: color }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Progress value={pct} className="h-1 flex-1" style={{ "--progress-color": color } as React.CSSProperties} />
                  <span className="text-[10px] text-muted-foreground w-7">{pct}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Row 3 — Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cards por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Cards por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barDataStatus} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
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
                  {barDataStatus.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Prioridade */}
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
                    {pieData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={PRIORITY_COLORS[entry.priority] ?? "#6366f1"}
                      />
                    ))}
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

      {/* Row 4 — Tabela Responsável × Status */}
      {cardsByAssignee.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Tarefas por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Responsável</th>
                    {STATUS_CONFIG.map(s => (
                      <th key={s.key} className="text-center text-xs font-medium text-muted-foreground pb-2 px-2">
                        <span style={{ color: s.color }}>{s.label}</span>
                      </th>
                    ))}
                    <th className="text-center text-xs font-medium text-muted-foreground pb-2 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cardsByAssignee.map((item) => (
                    <tr key={item.userId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-xs font-medium truncate max-w-[100px]" title={item.fullName}>
                            {item.userName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 min-w-[28px] justify-center bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          {item.todo}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 min-w-[28px] justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {item.doing}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 min-w-[28px] justify-center bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          {item.done}
                        </Badge>
                      </td>
                      <td className="py-2 pl-2 text-center">
                        <span className="text-xs font-semibold">{item.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 5 — Progresso por Coluna Kanban */}
      {cardsByColumn.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Distribuição por Coluna Kanban
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {cardsByColumn.map((col) => {
                const pct = totalCards > 0 ? Math.round((col.count / totalCards) * 100) : 0;
                return (
                  <div key={col.columnName} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-muted-foreground truncate flex-shrink-0" title={col.columnName}>
                      {col.columnName}
                    </div>
                    <Progress value={pct} className="flex-1 h-2" />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="secondary" className="text-[10px] h-5 w-8 justify-center">
                        {col.count}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground w-7">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
