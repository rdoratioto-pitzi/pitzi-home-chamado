import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, Minus, Clock, BarChart3, Users, MessageSquare, AlertTriangle, Download, Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, AreaChart, Area } from "recharts";
import * as XLSX from "xlsx";

interface CSATAnalytics {
  overview: {
    totalTickets: number;
    totalEvaluations: number;
    evaluationRate: number;
    averageRating: number;
  };
  ratingDistribution: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  topResponsibles: Array<{
    userId: string;
    userName: string;
    totalEvaluations: number;
    averageRating: number;
    ratings: number[];
  }>;
  negativeComments: Array<{
    ticketId: string;
    ticketCode: string;
    ticketTitle: string;
    rating: number;
    comment: string;
    createdAt: string | null;
    assigneeId: string | null;
  }>;
  trend: Array<{
    date: string;
    rating: number;
    count: number;
  }>;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#22c55e"];

type PeriodFilter = "7d" | "30d" | "90d" | "this_month" | "last_month";

export function CSATAnalytics() {
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const { data: analytics, isLoading, isError } = useQuery<CSATAnalytics>({
    queryKey: ["/api/tickets/csat/analytics"],
    retry: false,
  });

  // Filtrar dados por período
  const filteredData = useMemo(() => {
    if (!analytics) return null;

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = subDays(now, 7);
        break;
      case "30d":
        startDate = subDays(now, 30);
        break;
      case "90d":
        startDate = subDays(now, 90);
        break;
      case "this_month":
        startDate = startOfMonth(now);
        break;
      case "last_month":
        startDate = startOfMonth(subMonths(now, 1));
        break;
      default:
        startDate = subDays(now, 30);
    }

    // Filtrar trend por período
    const filteredTrend = analytics.trend.filter(t => new Date(t.date) >= startDate);
    
    // Filtrar comentários negativos por período
    const filteredNegativeComments = analytics.negativeComments.filter(t => 
      t.createdAt && new Date(t.createdAt) >= startDate
    );

    // Recalcular estatísticas para o período
    const totalInPeriod = filteredTrend.reduce((sum, t) => sum + t.count, 0);
    const avgInPeriod = totalInPeriod > 0 
      ? filteredTrend.reduce((sum, t) => sum + (t.rating * t.count), 0) / totalInPeriod 
      : 0;

    // Calcular tendência
    const midPoint = Math.floor(filteredTrend.length / 2);
    const firstHalf = filteredTrend.slice(0, midPoint);
    const secondHalf = filteredTrend.slice(midPoint);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, t) => s + t.rating, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, t) => s + t.rating, 0) / secondHalf.length : 0;
    const trendDirection = secondAvg > firstAvg + 0.2 ? "up" : secondAvg < firstAvg - 0.2 ? "down" : "stable";
    const trendDiff = Math.round((secondAvg - firstAvg) * 10) / 10;

    return {
      ...analytics,
      trend: filteredTrend,
      negativeComments: filteredNegativeComments,
      periodStats: {
        total: totalInPeriod,
        average: Math.round(avgInPeriod * 10) / 10,
        trend: trendDirection,
        trendDiff
      }
    };
  }, [analytics, period]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Error state
  if (isError || !filteredData) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="h-16 w-16 text-orange-500 mb-4" />
          <h3 className="text-xl font-semibold">Acesso restrito</h3>
          <p className="text-muted-foreground text-center mt-2 max-w-md">
            Apenas administradores podem acessar o CSAT Analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { overview, ratingDistribution, topResponsibles, negativeComments, trend, periodStats } = filteredData;
  const hasEvaluations = overview.totalEvaluations > 0;

  // Função para exportar Excel
  const handleExport = () => {
    if (!analytics) return;

    const wsData = [
      ["Relatório CSAT - Pitzi Home"],
      ["Gerado em:", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Período:", period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : period === "90d" ? "Últimos 90 dias" : period === "this_month" ? "Este mês" : "Mês passado"],
      [],
      ["Estatísticas Gerais"],
      ["Total de Avaliações", overview.totalEvaluations],
      ["Nota Média", overview.averageRating],
      ["Taxa de Avaliação", evaluationRate + "%"],
      [],
      ["Distribuição de Notas"],
      ["Nota", "Quantidade", "Porcentagem"],
      ...ratingDistribution.map(r => [r.rating + "⭐", r.count, r.percentage + "%"]),
      [],
      ["Comentários Negativos"],
      ["Ticket", "Título", "Nota", "Comentário", "Data"],
      ...negativeComments.map(c => [c.ticketCode, c.ticketTitle, c.rating + "⭐", c.comment || "-", c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy") : "-"])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CSAT Report");
    XLSX.writeFile(wb, `CSAT_RenovHome_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const evaluationRate = overview.evaluationRate || 0;

  if (!hasEvaluations) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Star className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold">Nenhuma avaliação ainda</h3>
          <p className="text-muted-foreground text-center mt-2 max-w-md">
            As avaliações de satisfação aparecerão aqui após os usuários avaliarem os chamados fechados.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calcular tendência para exibição
  const getTrendIcon = () => {
    if (!periodStats) return <Minus className="h-5 w-5 text-gray-400" />;
    if (periodStats.trend === "up") return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (periodStats.trend === "down") return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-gray-400" />;
  };

  const getTrendText = () => {
    if (!periodStats) return "Estável";
    if (periodStats.trend === "up") return `↗️ Subindo (+${periodStats.trendDiff})`;
    if (periodStats.trend === "down") return `↘️ Caindo (${periodStats.trendDiff})`;
    return "→ Estável";
  };

  return (
    <div className="space-y-6">
      {/* Header com filtros e export */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* KPI Cards - Agora com 5 cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.totalEvaluations}</div>
            <p className="text-xs text-muted-foreground">de {overview.totalTickets} tickets</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{evaluationRate}%</div>
            <p className="text-xs text-muted-foreground">avaliados / resolvidos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nota Média</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-1">
              {overview.averageRating}
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendência</CardTitle>
            {getTrendIcon()}
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{getTrendText()}</div>
            <p className="text-xs text-muted-foreground">vs período anterior</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">avaliações</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
          <TabsTrigger value="responsibles">Responsáveis</TabsTrigger>
          <TabsTrigger value="negative">Negativos</TabsTrigger>
          <TabsTrigger value="trend">Tendência</TabsTrigger>
        </TabsList>

        {/* ABA 1: VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Distribuição de Avaliações</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ratingDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, overview.totalEvaluations]} />
                    <YAxis type="category" dataKey="rating" width={40} tickFormatter={(v) => `${v}⭐`} />
                    <Tooltip formatter={(value: number, name: string, props: any) => [`${value} (${Math.round(props.payload.percentage)}%)`, 'Quantidade']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Avaliações Recentes</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {negativeComments.slice(0, 5).map((eval_, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">{eval_.ticketCode}</Badge>
                          <span className="text-sm truncate">{eval_.ticketTitle}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`h-3 w-3 ${star <= eval_.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {negativeComments.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">Nenhuma avaliação recente</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ABA 2: DISTRIBUIÇÃO DETALHADA */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Distribuição Detalhada por Nota</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const data = ratingDistribution.find(r => r.rating === rating);
                  const percentage = data?.percentage || 0;
                  const count = data?.count || 0;
                  const labels = ["Muito Satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito Insatisfeito"];
                  
                  return (
                    <div key={rating} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-24">
                            {rating === 5 ? "⭐⭐⭐⭐⭐" : rating === 4 ? "⭐⭐⭐⭐" : rating === 3 ? "⭐⭐⭐" : rating === 2 ? "⭐⭐" : "⭐"}
                          </span>
                          <span className="text-sm text-muted-foreground">{labels[5 - rating]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{count}</span>
                          <span className="text-xs text-muted-foreground">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: COLORS[rating - 1] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: RESPONSÁVEIS */}
        <TabsContent value="responsibles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Responsáveis por Avaliação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topResponsibles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Avaliações</TableHead>
                      <TableHead>Média</TableHead>
                      <TableHead>Distribuição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topResponsibles.map((resp, index) => (
                      <TableRow key={resp.userId} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {resp.userName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            {resp.userName}
                          </div>
                        </TableCell>
                        <TableCell>{resp.totalEvaluations}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-bold">{resp.averageRating}</span>
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {resp.ratings.map((count, i) => (
                              <div key={i} className="w-7 h-7 flex items-center justify-center text-xs rounded font-medium" style={{ backgroundColor: `${COLORS[i]}20`, color: COLORS[i] }} title={`${count} notas ${i + 1}`}>
                                {count}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum dado de responsáveis disponível</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 4: COMENTÁRIOS NEGATIVOS */}
        <TabsContent value="negative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Comentários Negativos (Nota ≤ 2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {negativeComments.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {negativeComments.slice(0, 20).map((comment, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${comment.rating === 1 ? 'bg-red-50 border-red-200 dark:bg-red-950/20' : 'bg-orange-50 border-orange-200 dark:bg-orange-950/20'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">{comment.ticketCode}</Badge>
                          {comment.rating === 1 && <Badge variant="destructive">Ação Necessária</Badge>}
                          <span className="font-medium">{comment.ticketTitle}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-4 w-4 ${star <= comment.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm italic text-muted-foreground">"{comment.comment}"</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {comment.createdAt && format(new Date(comment.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ThumbsUp className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-medium text-green-600">🎉 Parabéns!</p>
                  <p className="text-muted-foreground text-sm">Nenhuma avaliação negativa no período selecionado!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 5: TENDÊNCIA */}
        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Evolução do CSAT - Últimos 30 Dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "dd/MM")} />
                      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                      <Tooltip 
                        formatter={(value: number) => [`${value} ⭐`, 'Nota Média']}
                        labelFormatter={(value) => format(new Date(value), "dd 'de' MMMM", { locale: ptBR })}
                      />
                      <Area type="monotone" dataKey="rating" stroke="#00A137" fill="#00A137" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  
                  {/* Stats da tendência */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{periodStats?.total || 0}</div>
                      <div className="text-xs text-muted-foreground">Avaliações no período</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{periodStats?.average || 0}</div>
                      <div className="text-xs text-muted-foreground">Média do período</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold flex items-center justify-center gap-1">
                        {getTrendIcon()}
                        {getTrendText()}
                      </div>
                      <div className="text-xs text-muted-foreground">Tendência</div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">Dados insuficientes para tendência</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CSATAnalytics;