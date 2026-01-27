import { useDashboardStats, useRequests } from "@/hooks/use-logistics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  DollarSign, 
  Clock, 
  TrendingUp,
  Loader2,
  Truck,
  Activity,
  ArrowUpRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  quoted: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
  collected: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  quoted: "Cotado",
  approved: "Aprovado",
  collected: "Coletado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function LogisticsDashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: requests, isLoading: requestsLoading } = useRequests();

  if (statsLoading || requestsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" data-testid="loader-dashboard" />
      </div>
    );
  }

  const dispositivosStatus = {
    aguardando: requests?.filter(r => r.status === "pending").length || 0,
    confirmado: requests?.filter(r => r.status === "quoted" || r.status === "approved").length || 0,
    emColeta: requests?.filter(r => r.status === "collected").length || 0,
  };
  const totalDispositivos = dispositivosStatus.aguardando + dispositivosStatus.confirmado + dispositivosStatus.emColeta;

  return (
    <div className="space-y-8" data-testid="page-logistics-dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-requests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Solicitações de Coleta</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-requests">{stats?.totalRequests || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+20.1%</span> vs mês anterior
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-total-value">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-value">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.totalValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+15%</span> crescimento
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-ontime-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Entregas no Prazo</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-ontime-rate">{stats?.onTimeRate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: 98%
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-savings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Economia Gerada</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-savings">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.savings || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Através da otimização de rotas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Status das Solicitações
            </CardTitle>
            <CardDescription>Visão geral do status atual das coletas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {totalDispositivos > 0 ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm font-medium">Aguardando</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold">{dispositivosStatus.aguardando}</span>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        {totalDispositivos > 0 ? ((dispositivosStatus.aguardando / totalDispositivos) * 100).toFixed(0) : 0}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={totalDispositivos > 0 ? (dispositivosStatus.aguardando / totalDispositivos) * 100 : 0} className="h-2" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium">Confirmado</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold">{dispositivosStatus.confirmado}</span>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {totalDispositivos > 0 ? ((dispositivosStatus.confirmado / totalDispositivos) * 100).toFixed(0) : 0}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={totalDispositivos > 0 ? (dispositivosStatus.confirmado / totalDispositivos) * 100 : 0} className="h-2" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">Em Coleta</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold">{dispositivosStatus.emColeta}</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {totalDispositivos > 0 ? ((dispositivosStatus.emColeta / totalDispositivos) * 100).toFixed(0) : 0}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={totalDispositivos > 0 ? (dispositivosStatus.emColeta / totalDispositivos) * 100 : 0} className="h-2" />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Total de Solicitações Ativas</span>
                    <span className="font-bold text-foreground">{totalDispositivos}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma solicitação ativa no momento.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Resumo por Status
            </CardTitle>
            <CardDescription>Distribuição das solicitações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Pendentes</p>
                    <p className="text-xs text-muted-foreground">Aguardando processamento</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{stats?.pendingRequests || 0}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Package className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Entregues</p>
                    <p className="text-xs text-muted-foreground">Finalizados com sucesso</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{stats?.deliveredRequests || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações Recentes</CardTitle>
          <CardDescription>Últimas movimentações registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests?.slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`request-item-${req.id}`}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {req.origem} → {req.destino}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.createdAt && format(new Date(req.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className={STATUS_COLORS[req.status] || "bg-slate-100"}>
                    {STATUS_LABELS[req.status] || req.status}
                  </Badge>
                  <div className="text-right text-sm">
                    <p className="font-medium">
                      {req.valorEstimado ? `R$ ${req.valorEstimado}` : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.peso} kg
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {(!requests || requests.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma solicitação encontrada.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
