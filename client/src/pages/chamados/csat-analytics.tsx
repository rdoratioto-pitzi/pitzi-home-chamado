import { useQuery } from "@tanstack/react-query";
import { Star, ThumbsUp, ThumbsDown, TrendingUp, Clock, BarChart3, Users, MessageSquare, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";

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

const ratingColors: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#3b82f6",
  5: "#22c55e",
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#22c55e"];

export function CSATAnalytics() {
  const { data: analytics, isLoading, isError } = useQuery<CSATAnalytics>({
    queryKey: ["/api/tickets/csat/analytics"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Se erro (não autorizado - 403), mostrar mensagem
  if (isError || !analytics) {
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

  // Verificar se tem dados de avaliação (usar analytics?.overview diretamente)
  const hasEvaluations = (analytics?.overview?.totalEvaluations ?? 0) > 0;
  
  if (!hasEvaluations) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Star className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold">Nenhuma avaliação ainda</h3>
          <p className="text-muted-foreground text-center mt-2 max-w-md">
            As avaliações de satisfação aparecerão aqui após os usuários avaliarem os chamados fechados.
          </p>
          <div className="mt-6 flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>5 estrelas = Satisfeito</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>1-2 estrelas = Insatisfeito</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Usar valores padrão para evitar erros quando API retorna erro
  const overview = analytics?.overview || { totalTickets: 0, totalEvaluations: 0, evaluationRate: 0, averageRating: 0 };
  const ratingDistribution = analytics?.ratingDistribution || [];
  const topResponsibles = analytics?.topResponsibles || [];
  const negativeComments = analytics?.negativeComments || [];
  const trend = analytics?.trend || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview?.totalEvaluations ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              de {overview?.totalTickets ?? 0} tickets fechados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Avaliação</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {overview?.evaluationRate ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              dos tickets avaliados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200 dark:border-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nota Média</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-1">
              {overview?.averageRating ?? 0}
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground">
              de 5.0 possível
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliações Positivas</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {overview.totalEvaluations ? Math.round((ratingDistribution[3]?.count + ratingDistribution[4]?.count) / overview.totalEvaluations * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              notas 4 e 5 estrelas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
          <TabsTrigger value="responsibles">Responsáveis</TabsTrigger>
          <TabsTrigger value="negative">Comentários Negativos</TabsTrigger>
          <TabsTrigger value="trend">Tendência</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Avaliações</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ratingDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, overview?.totalEvaluations || 1]} />
                    <YAxis type="category" dataKey="rating" width={30} tickFormatter={(v) => `${v}⭐`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 8 }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} avaliações (${Math.round(props.payload.percentage)}%)`,
                        'Quantidade'
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Evaluations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Avaliações Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {negativeComments.length > 0 ? (
                    negativeComments.slice(0, 5).map((eval_, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {eval_.ticketCode}
                            </Badge>
                            <span className="text-sm truncate">{eval_.ticketTitle}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= eval_.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Nenhuma avaliação recente</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição Detalhada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const data = ratingDistribution.find(r => r.rating === rating);
                  const percentage = data?.percentage || 0;
                  const count = data?.count || 0;
                  
                  return (
                    <div key={rating} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-20">
                            {rating === 5 ? "⭐⭐⭐⭐⭐" : rating === 4 ? "⭐⭐⭐⭐" : rating === 3 ? "⭐⭐⭐" : rating === 2 ? "⭐⭐" : "⭐"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {rating === 5 ? "Muito Satisfeito" : 
                             rating === 4 ? "Satisfeito" : 
                             rating === 3 ? "Neutro" : 
                             rating === 2 ? "Insatisfeito" : "Muito Insatisfeito"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{count}</span>
                          <span className="text-xs text-muted-foreground">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: COLORS[rating - 1]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responsibles Tab */}
        <TabsContent value="responsibles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Responsáveis por Avaliação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topResponsibles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Avaliações</TableHead>
                      <TableHead>Média</TableHead>
                      <TableHead>Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topResponsibles.map((resp, index) => (
                      <TableRow key={resp.userId}>
                        <TableCell className="font-medium">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                        </TableCell>
                        <TableCell>{resp.userName}</TableCell>
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
                              <div 
                                key={i} 
                                className="w-6 h-6 flex items-center justify-center text-xs rounded"
                                style={{ backgroundColor: `${COLORS[i]}20`, color: COLORS[i] }}
                                title={`${count} notas ${i + 1}`}
                              >
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
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado de responsáveis disponível
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Negative Comments Tab */}
        <TabsContent value="negative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Comentários Negativos (Notas 1-2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {negativeComments.length > 0 ? (
                <div className="space-y-4">
                  {negativeComments.map((comment, index) => (
                    <div 
                      key={index} 
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {comment.ticketCode}
                          </Badge>
                          <span className="font-medium">{comment.ticketTitle}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= comment.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
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
                  <p className="font-medium text-green-600">Nenhum comentário negativo! 🎉</p>
                  <p className="text-muted-foreground text-sm">Todas as avaliações foram positivas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend Tab */}
        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tendência dos Últimos 30 Dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), "dd/MM")}
                    />
                    <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 8 }}
                      formatter={(value: number) => [`${value} ⭐`, 'Nota Média']}
                      labelFormatter={(value) => format(new Date(value), "dd 'de' MMMM", { locale: ptBR })}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="rating" 
                      stroke="#00A137" 
                      strokeWidth={2}
                      dot={{ fill: "#00A137", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Dados insuficientes para tendência
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CSATAnalytics;