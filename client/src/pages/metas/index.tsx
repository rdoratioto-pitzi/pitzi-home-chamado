import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextarea } from "@/components/rich-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, addMonths, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  CheckCircle2,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Building2,
  CalendarClock,
  Loader2,
} from "lucide-react";
import type { Meta, MetaArea, User, MetaCheckin } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

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

const measurementLabels: Record<string, string> = {
  percentage: "%",
  absolute: "Absoluto",
  monetary: "R$",
  binary: "Sim/Não",
};

const measurementUnits: Record<string, string> = {
  percentage: "%",
  absolute: "Pontos",
  monetary: "R$",
  binary: "",
};

// Componente separado para evitar erro de hooks no map
function MetaCard({
  meta,
  users,
  onCheckin,
  area
}: {
  meta: any;
  users: User[];
  onCheckin: (meta: any) => void;
  area: any;
}) {
  const { data: checkins = [] } = useQuery<any[]>({
    queryKey: ["/api/metas", meta.id, "checkins"],
    queryFn: async () => {
      const res = await fetch(`/api/metas/${meta.id}/checkins`);
      return res.json();
    },
  });

  const getUserById = (id: string) => users.find(u => u.id === id);
  const user = getUserById(meta.responsibleId);
  
  const current = parseFloat(meta.currentValue || "0");
  const target = parseFloat(meta.targetValue || "100");
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  const formatValue = (value: string | number) => {
    const num = Number(value);
    if (meta.measurementType === 'monetary') {
      return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    if (meta.measurementType === 'percentage') {
      return `${num}%`;
    }
    return `${num} ${meta.unit || ''}`;
  };

  return (
    <Card
      className="p-4 shadow-none border-border/40 bg-background hover-elevate cursor-pointer"
      onClick={() => onCheckin(meta)}
    >
      {/* Título + Badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-bold text-foreground leading-snug">{meta.title}</p>
          <Badge variant="secondary" className="text-[10px] uppercase font-bold">
            {measurementLabels[meta.measurementType] || meta.measurementType}
          </Badge>
          <Badge variant="outline" className={`text-[10px] uppercase font-bold ${statusColors[meta.status]}`}>
            <CalendarClock className="h-3 w-3 mr-1" />
            {statusLabels[meta.status]}
          </Badge>
        </div>
        <div className="text-[28px] font-bold" style={{ color: area?.color }}>{Math.round(progress)}%</div>
      </div>

      {/* Barra de progresso + Valor */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: area?.color }}
          />
        </div>
        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
          {meta.measurementType === "binary"
            ? (current > 0 ? "1 / 1" : "0 / 1")
            : `${formatValue(current)} / ${formatValue(target)} ${meta.unit || (meta.measurementType === "monetary" ? "" : measurementUnits[meta.measurementType])}`
          }
        </span>
      </div>

      {/* Responsável + Data + Botão */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
            {user?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || 'U'}
          </div>
          <span>{user?.name || 'Usuário'}</span>
          <span>•</span>
          <span>{meta.updatedAt ? format(parseISO(meta.updatedAt.toString()), "dd 'de' MMM yyyy", { locale: ptBR }) : format(parseISO(`${meta.month}-01`), "MMM yyyy", { locale: ptBR })}</span>
        </div>
        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={(e) => { e.stopPropagation(); onCheckin(meta); }}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Check-in
        </Button>
      </div>

      {/* Histórico de Check-ins */}
      {checkins.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
          {checkins
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((c: any) => {
              const cUser = getUserById(c.userId);
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{cUser?.name?.split(' ')[0] || 'Usuário'}</span>
                  <span>•</span>
                  <span>{new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                  <span>•</span>
                  <span className="font-mono text-primary">{formatValue(c.newValue)}</span>
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}

export default function MetasVisaoGeralPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const currentMonthLabel = format(parseISO(`${selectedMonth}-01`), "MMMM yyyy", { locale: ptBR });

  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [checkinMeta, setCheckinMeta] = useState<Meta | null>(null);

  const [checkinForm, setCheckinForm] = useState({
    newValue: "",
    comment: "",
  });

  const { data: metas = [], isLoading: metasLoading } = useQuery<Meta[]>({
    queryKey: ["/api/metas", { month: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/metas?month=${selectedMonth}`);
      return res.json();
    },
  });

  const { data: areas = [] } = useQuery<MetaArea[]>({
    queryKey: ["/api/meta-areas"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filtrar apenas usuários ativos para o campo responsável
  const activeUsers = users.filter((user) => user.status === "active");

  const { data: checkins = [], isLoading: checkinsLoading } = useQuery<MetaCheckin[]>({
    queryKey: ["/api/metas", checkinMeta?.id, "checkins"],
    queryFn: async () => {
      if (!checkinMeta) return [];
      const res = await fetch(`/api/metas/${checkinMeta.id}/checkins`);
      return res.json();
    },
    enabled: !!checkinMeta,
  });

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const numberValue = parseInt(digits) / 100;
    if (isNaN(numberValue)) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numberValue);
  };

  const parseCurrencyValue = (formattedValue: string) => {
    const digits = formattedValue.replace(/\D/g, "");
    return (parseInt(digits) / 100).toString();
  };

  const handlePrevMonth = () => {
    const prev = subMonths(parseISO(`${selectedMonth}-01`), 1);
    setSelectedMonth(format(prev, "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const next = addMonths(parseISO(`${selectedMonth}-01`), 1);
    setSelectedMonth(format(next, "yyyy-MM"));
  };

  const createCheckinMutation = useMutation({
    mutationFn: async ({ metaId, data }: { metaId: string; data: any }) =>
      apiRequest("POST", `/api/metas/${metaId}/checkins`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metas"] });
      toast({ title: "Check-in registrado com sucesso!" });
      setIsCheckinDialogOpen(false);
      setCheckinMeta(null);
      setCheckinForm({ newValue: "", comment: "" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao registrar check-in", description: error.message, variant: "destructive" });
    },
  });

  const openCheckin = (meta: Meta) => {
    setCheckinMeta(meta);
    setCheckinForm({ newValue: meta.currentValue || "0", comment: "" });
    setIsCheckinDialogOpen(true);
  };

  const handleCheckin = () => {
    if (!checkinMeta) return;
    createCheckinMutation.mutate({
      metaId: checkinMeta.id,
      data: {
        userId: currentUser?.id || "",
        newValue: parseFloat(checkinForm.newValue) || 0,
        comment: checkinForm.comment || null,
      },
    });
  };

  const formatValue = (value: string | number, type: string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return value.toString();
    
    if (type === "monetary") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(num);
    }
    
    return new Intl.NumberFormat("pt-BR").format(num);
  };

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

  const activeAreas = useMemo(() => {
    return areas.filter(a => !a.archived);
  }, [areas]);

  const metasByArea = useMemo(() => {
    const grouped: Record<string, Meta[]> = {};
    activeAreas.forEach(area => {
      grouped[area.id] = metas.filter(m => m.areaId === area.id);
    });
    return grouped;
  }, [metas, activeAreas]);

  const stats = useMemo(() => {
    const total = metas.length;
    const completed = metas.filter(m => m.status === "completed" || getProgress(m) >= 100).length;
    const avgProgress = total > 0 
      ? metas.reduce((sum, m) => sum + getProgress(m), 0) / total 
      : 0;

    const byArea: Record<string, { total: number; completed: number; avgProgress: number; name: string }> = {};
    activeAreas.forEach(area => {
      const areaMetas = metas.filter(m => m.areaId === area.id);
      const areaCompleted = areaMetas.filter(m => m.status === "completed" || getProgress(m) >= 100).length;
      const areaAvgProgress = areaMetas.length > 0 
        ? areaMetas.reduce((sum, m) => sum + getProgress(m), 0) / areaMetas.length 
        : 0;
      byArea[area.id] = {
        total: areaMetas.length,
        completed: areaCompleted,
        avgProgress: areaAvgProgress,
        name: area.name,
      };
    });

    return { total, completed, avgProgress, byArea };
  }, [metas, activeAreas]);

  if (metasLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <PageHeader title="Metas" breadcrumbs={[{ label: "Metas" }]} />
        <main className="flex-1 p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Metas"
        breadcrumbs={[{ label: "Metas" }]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Metas Mensais</h2>
            <p className="text-[14px] text-muted-foreground mt-1">
              Acompanhe o progresso das metas por área de negócio
            </p>
          </div>
          <Card className="shadow-sm border-border/60 p-1 flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handlePrevMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 min-w-[140px] text-center flex items-center justify-center" data-testid="text-current-month">
              <span className="text-sm font-bold capitalize">{currentMonthLabel}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total" style={{ background: 'var(--vf)', border: 'none' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Target className="h-5 w-5" style={{ color: '#FFFFFF' }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#FFFFFF' }}>Total de Metas</p>
                  <p className="text-[28px] font-bold" style={{ color: '#FFFFFF' }}>{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-by-area" className="border" style={{ background: 'var(--bg2)', borderColor: 'var(--sep)' }}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--l3)' }}>Total por Área</p>
                  <div className="space-y-0.5 max-h-20 overflow-auto">
                    {Object.entries(stats.byArea)
                      .filter(([_, data]) => data.total > 0)
                      .map(([areaId, data]) => (
                        <div key={areaId} className="flex items-center justify-between text-xs" data-testid={`text-area-count-${areaId}`}>
                          <span className="truncate text-muted-foreground">{data.name}</span>
                          <span className="font-bold ml-2">{data.total}</span>
                        </div>
                      ))}
                    {Object.values(stats.byArea).every(d => d.total === 0) && (
                      <span className="text-xs text-muted-foreground">Nenhuma meta</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-progress" className="border" style={{ background: 'var(--bg2)', borderColor: 'var(--sep)' }}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--l3)' }}>Progresso Médio</p>
                  <p className="text-[28px] font-bold" data-testid="text-avg-progress">{stats.avgProgress.toFixed(0)}%</p>
                  <div className="space-y-0.5 mt-1 max-h-16 overflow-auto">
                    {Object.entries(stats.byArea)
                      .filter(([_, data]) => data.total > 0)
                      .map(([areaId, data]) => (
                        <div key={areaId} className="flex items-center justify-between text-xs" data-testid={`text-area-progress-${areaId}`}>
                          <span className="truncate text-muted-foreground">{data.name}</span>
                          <span className="font-medium ml-2">{data.avgProgress.toFixed(0)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-completed" className="border" style={{ background: 'var(--bg2)', borderColor: 'var(--sep)' }}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--l3)' }}>Metas Atingidas</p>
                  <p className="text-[28px] font-bold" data-testid="text-completed-count">
                    {stats.completed}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </p>
                  <div className="space-y-0.5 mt-1 max-h-16 overflow-auto">
                    {Object.entries(stats.byArea)
                      .filter(([_, data]) => data.total > 0)
                      .map(([areaId, data]) => (
                        <div key={areaId} className="flex items-center justify-between text-xs" data-testid={`text-area-completed-${areaId}`}>
                          <span className="truncate text-muted-foreground">{data.name}</span>
                          <span className="font-medium ml-2">
                            {data.completed} ({data.total > 0 ? ((data.completed / data.total) * 100).toFixed(0) : 0}%)
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeAreas.length === 0 ? (
          <Card className="shadow-sm border-border/60 text-center py-16">
            <CardContent>
              <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-[18px] font-bold">Nenhuma área de negócio cadastrada</h3>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-xs mx-auto">
                Acesse a gestão de metas para criar áreas de negócio e começar a cadastrar metas
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-4" defaultValue={activeAreas.map(a => a.id)}>
            {activeAreas.map((area) => {
              const areaMetas = metasByArea[area.id] || [];
              const areaStats = stats.byArea[area.id];

              return (
                <AccordionItem 
                  key={area.id} 
                  value={area.id}
                  className="border-0"
                  data-testid={`accordion-area-${area.id}`}
                >
                  <Card className="shadow-sm border-border/60 overflow-hidden hover:border-primary/20 transition-all duration-200">
                    <AccordionTrigger className="px-6 py-5 hover:no-underline" data-testid={`trigger-area-${area.id}`}>
                      <div className="flex items-start gap-5 flex-1 text-left">
                        <div 
                          className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${area.color}20`, color: area.color }}
                        >
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-[16px] font-bold text-foreground leading-tight truncate" data-testid={`text-area-name-${area.id}`}>{area.name}</h3>
                            <Badge 
                              variant="secondary" 
                              className="font-bold text-[10px] uppercase tracking-wider"
                              style={{ backgroundColor: `${area.color}15`, color: area.color }}
                              data-testid={`badge-area-metas-${area.id}`}
                            >
                              {areaMetas.length} {areaMetas.length === 1 ? 'Meta' : 'Metas'}
                            </Badge>
                          </div>
                          {areaMetas.length > 0 && (
                            <div className="mt-4 flex items-center gap-4">
                              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden" data-testid={`progress-area-${area.id}`}>
                                <div 
                                  className="h-full transition-all duration-500 rounded-full" 
                                  style={{ width: `${areaStats?.avgProgress || 0}%`, backgroundColor: area.color }} 
                                />
                              </div>
                              <span className="text-[13px] font-bold min-w-[35px]" style={{ color: area.color }} data-testid={`text-area-avg-${area.id}`}>
                                {(areaStats?.avgProgress || 0).toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-6 pb-6 pt-2 space-y-4 border-t border-border/40 bg-muted/5">
                        <div className="mb-2">
                          <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
                            Metas ({areaMetas.length})
                          </h4>
                        </div>
                        
                        {areaMetas.length === 0 ? (
                          <div className="text-center py-8 rounded-lg border border-dashed border-border/60">
                            <p className="text-[13px] text-muted-foreground">
                              Nenhuma meta cadastrada para esta área neste mês.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {areaMetas.map((meta) => (
                              <MetaCard
                                key={meta.id}
                                meta={meta}
                                users={users}
                                onCheckin={openCheckin}
                                area={area}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </main>

      <Dialog open={isCheckinDialogOpen} onOpenChange={setIsCheckinDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Check-in de Progresso</DialogTitle>
          </DialogHeader>
          {checkinMeta && (
            <div className="flex-1 overflow-y-auto space-y-6 py-4">
              <div className="p-4 bg-muted/30 rounded-lg" data-testid="card-checkin-info">
                <h4 className="font-bold text-sm mb-1" data-testid="text-checkin-meta-title">{checkinMeta.title}</h4>
                <p className="text-xs text-muted-foreground" data-testid="text-checkin-area">
                  {getAreaById(checkinMeta.areaId)?.name}
                </p>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-muted-foreground">Progresso atual:</span>
                  <span className="text-lg font-bold" data-testid="text-checkin-current-progress">
                    {checkinMeta.measurementType === "binary"
                      ? (parseFloat(checkinMeta.currentValue || "0") > 0 ? "Concluído" : "Pendente")
                      : `${formatValue(checkinMeta.currentValue || "0", checkinMeta.measurementType)} / ${formatValue(checkinMeta.targetValue, checkinMeta.measurementType)} ${checkinMeta.unit || (checkinMeta.measurementType === "monetary" ? "" : measurementUnits[checkinMeta.measurementType])}`
                    }
                  </span>
                </div>
                <Progress value={getProgress(checkinMeta)} className="h-2 mt-2" data-testid="progress-checkin" />
              </div>

              {checkinMeta.description && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider mb-1">Descrição</h4>
                  <div
                    className="text-[13px] text-muted-foreground prose prose-sm max-w-none break-words overflow-hidden"
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    dangerouslySetInnerHTML={{ __html: checkinMeta.description }}
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Novo Valor *</Label>
                  <Input
                    type={checkinMeta.measurementType === "monetary" ? "text" : "number"}
                    step="any"
                    value={checkinMeta.measurementType === "monetary"
                      ? (checkinForm.newValue ? formatCurrencyInput((parseFloat(checkinForm.newValue) * 100).toFixed(0)) : "")
                      : checkinForm.newValue
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (checkinMeta.measurementType === "monetary") {
                        setCheckinForm(prev => ({ ...prev, newValue: parseCurrencyValue(val) }));
                      } else {
                        setCheckinForm(prev => ({ ...prev, newValue: val }));
                      }
                    }}
                    placeholder={checkinMeta.measurementType === "monetary" ? "R$ 0,00" : "Informe o valor atual"}
                    data-testid="input-checkin-value"
                  />
                  {checkinMeta.measurementType === "binary" && (
                    <p className="text-xs text-muted-foreground">0 = Não concluído, 1 = Concluído</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Comentário (opcional)</Label>
                  <RichTextarea
                    value={checkinForm.comment}
                    onChange={(val: string) => setCheckinForm(prev => ({ ...prev, comment: val }))}
                    placeholder="O que mudou? Obstáculos encontrados?"
                    data-testid="input-checkin-comment"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Histórico de Check-ins
                </h4>
                <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/5">
                  {checkinsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : checkins.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum check-in realizado ainda.</p>
                  ) : (
                    <div className="space-y-4">
                      {checkins.sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()).map((c) => {
                        const cUser = getUserById(c.userId);
                        return (
                          <div key={c.id} className="text-sm border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-primary">
                                {formatValue(c.newValue, checkinMeta.measurementType)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {c.createdAt ? format(parseISO(c.createdAt.toString()), "dd 'de' MMM yyyy", { locale: ptBR }) : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {cUser?.name?.charAt(0) || "U"}
                              </div>
                              <span>{cUser?.name || "Usuário"}</span>
                            </div>
                            {c.comment && (
                              <p className="mt-1.5 text-xs text-muted-foreground italic leading-relaxed">"{c.comment}"</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsCheckinDialogOpen(false)} data-testid="button-cancel-checkin">
              Cancelar
            </Button>
            <Button
              onClick={handleCheckin}
              disabled={createCheckinMutation.isPending}
              data-testid="button-submit-checkin"
            >
              {createCheckinMutation.isPending ? "Salvando..." : "Registrar Check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
