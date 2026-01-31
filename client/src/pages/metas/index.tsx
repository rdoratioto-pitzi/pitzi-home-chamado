import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import {
  Target,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Users,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { Meta, MetaArea, User } from "@shared/schema";

const statusColors: Record<string, string> = {
  on_track: "bg-green-500/10 text-green-600 dark:text-green-400",
  at_risk: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
  completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const statusLabels: Record<string, string> = {
  on_track: "No Prazo",
  at_risk: "Em Risco",
  overdue: "Atrasado",
  completed: "Concluído",
};

const pieColors = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6"];

function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) return JSON.parse(userStr);
  } catch (e) {}
  return null;
}

export default function MetasVisaoGeralPage() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const currentMonthLabel = format(new Date(), "MMMM yyyy", { locale: ptBR });
  const currentUser = getCurrentUser();

  const { data: metas = [], isLoading: metasLoading } = useQuery<Meta[]>({
    queryKey: ["/api/metas", { month: currentMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/metas?month=${currentMonth}`);
      return res.json();
    },
  });

  const { data: areas = [] } = useQuery<MetaArea[]>({
    queryKey: ["/api/meta-areas"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getProgress = (meta: Meta): number => {
    const current = parseFloat(meta.currentValue || "0");
    const target = parseFloat(meta.targetValue || "100");
    if (target === 0) return 0;
    if (meta.measurementType === "binary") {
      return current > 0 ? 100 : 0;
    }
    return Math.min(100, Math.max(0, (current / target) * 100));
  };

  const getAreaById = (id: string) => areas.find(a => a.id === id);
  const getUserById = (id: string) => users.find(u => u.id === id);

  const stats = useMemo(() => {
    const total = metas.length;
    const completed = metas.filter(m => m.status === "completed").length;
    const onTrack = metas.filter(m => m.status === "on_track").length;
    const atRisk = metas.filter(m => m.status === "at_risk").length;
    const overdue = metas.filter(m => m.status === "overdue").length;
    const avgProgress = total > 0 
      ? metas.reduce((sum, m) => sum + getProgress(m), 0) / total 
      : 0;
    return { total, completed, onTrack, atRisk, overdue, avgProgress };
  }, [metas]);

  const myMetas = useMemo(() => {
    if (!currentUser) return [];
    return metas.filter(m => m.responsibleId === currentUser.id);
  }, [metas, currentUser]);

  const pieData = useMemo(() => [
    { name: "No Prazo", value: stats.onTrack, color: "#22c55e" },
    { name: "Em Risco", value: stats.atRisk, color: "#f59e0b" },
    { name: "Atrasado", value: stats.overdue, color: "#ef4444" },
    { name: "Concluído", value: stats.completed, color: "#3b82f6" },
  ].filter(d => d.value > 0), [stats]);

  const areaProgressData = useMemo(() => {
    const grouped: Record<string, { total: number; progress: number; name: string; color: string }> = {};
    
    metas.forEach(meta => {
      const area = getAreaById(meta.areaId);
      if (!area) return;
      
      if (!grouped[meta.areaId]) {
        grouped[meta.areaId] = { total: 0, progress: 0, name: area.name, color: area.color };
      }
      grouped[meta.areaId].total++;
      grouped[meta.areaId].progress += getProgress(meta);
    });

    return Object.values(grouped).map(g => ({
      name: g.name,
      progresso: Math.round(g.progress / g.total),
      fill: g.color,
    }));
  }, [metas, areas]);

  const topPerformers = useMemo(() => {
    const byUser: Record<string, { userId: string; totalProgress: number; count: number }> = {};
    
    metas.forEach(meta => {
      if (!byUser[meta.responsibleId]) {
        byUser[meta.responsibleId] = { userId: meta.responsibleId, totalProgress: 0, count: 0 };
      }
      byUser[meta.responsibleId].totalProgress += getProgress(meta);
      byUser[meta.responsibleId].count++;
    });

    return Object.values(byUser)
      .map(u => ({
        user: getUserById(u.userId),
        avgProgress: u.count > 0 ? u.totalProgress / u.count : 0,
        metasCount: u.count,
      }))
      .filter(u => u.user)
      .sort((a, b) => b.avgProgress - a.avgProgress)
      .slice(0, 5);
  }, [metas, users]);

  const recentMetas = useMemo(() => {
    return [...metas]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [metas]);

  if (metasLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <PageHeader title="Metas" breadcrumbs={[{ label: "Metas" }, { label: "Visão Geral" }]} />
        <main className="flex-1 p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Metas"
        breadcrumbs={[{ label: "Metas" }, { label: "Visão Geral" }]}
        actions={
          <Link href="/metas/gestao">
            <Button data-testid="button-ir-gestao">
              Gerenciar Metas
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold capitalize">{currentMonthLabel}</h2>
            <p className="text-sm text-muted-foreground">Acompanhamento das metas do mês</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Metas</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-progress">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Progresso Médio</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{stats.avgProgress.toFixed(0)}%</p>
                    <Progress value={stats.avgProgress} className="flex-1 h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-completed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                  <p className="text-2xl font-bold">
                    {stats.completed}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      / {stats.total}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-attention">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Precisam Atenção</p>
                  <p className="text-2xl font-bold">{stats.atRisk + stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium">Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhuma meta cadastrada
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium">Progresso por Área</CardTitle>
            </CardHeader>
            <CardContent>
              {areaProgressData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhuma área com metas
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaProgressData} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(value) => [`${value}%`, "Progresso"]} />
                      <Bar dataKey="progresso" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {currentUser && myMetas.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base font-medium">Minhas Metas</CardTitle>
                <Link href="/metas/gestao">
                  <Button variant="ghost" size="sm">Ver Todas</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {myMetas.slice(0, 4).map(meta => {
                  const area = getAreaById(meta.areaId);
                  const progress = getProgress(meta);
                  
                  return (
                    <div key={meta.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{meta.title}</p>
                          {area && (
                            <Badge 
                              variant="outline" 
                              className="text-xs shrink-0"
                              style={{ borderColor: area.color, color: area.color }}
                            >
                              {area.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={progress} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <Badge className={statusColors[meta.status]} data-testid={`my-meta-status-${meta.id}`}>
                        {statusLabels[meta.status]}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPerformers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                topPerformers.map((item, index) => (
                  <div key={item.user?.id} className="flex items-center gap-3">
                    <div className="w-6 text-center font-bold text-muted-foreground">
                      {index + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {item.user?.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{item.metasCount} metas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{item.avgProgress.toFixed(0)}%</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Metas Recentes</CardTitle>
            <Link href="/metas/gestao">
              <Button variant="ghost" size="sm">Ver Todas</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentMetas.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma meta cadastrada para este mês</p>
                <Link href="/metas/gestao">
                  <Button className="mt-4" variant="outline">Criar Primeira Meta</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {recentMetas.map(meta => {
                  const area = getAreaById(meta.areaId);
                  const user = getUserById(meta.responsibleId);
                  const progress = getProgress(meta);

                  return (
                    <div 
                      key={meta.id} 
                      className="p-3 border rounded-lg hover:border-primary/50 transition-colors"
                      data-testid={`recent-meta-${meta.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-medium line-clamp-2">{meta.title}</h4>
                        <Badge className={`${statusColors[meta.status]} shrink-0`}>
                          {statusLabels[meta.status]}
                        </Badge>
                      </div>
                      {area && (
                        <Badge 
                          variant="outline" 
                          className="text-xs mb-2"
                          style={{ borderColor: area.color, color: area.color }}
                        >
                          {area.name}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1.5 mb-2">
                        {user && (
                          <>
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px]">
                                {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground truncate">{user.name}</span>
                          </>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Progress value={progress} className="h-1.5" />
                        <p className="text-xs text-right text-muted-foreground">{progress.toFixed(0)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
