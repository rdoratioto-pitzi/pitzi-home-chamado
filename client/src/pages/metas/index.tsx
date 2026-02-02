import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  BarChart3,
  Building2,
  CalendarClock,
  Loader2,
} from "lucide-react";
import type { Meta, MetaArea, User, MetaCheckin } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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

function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) return JSON.parse(userStr);
  } catch (e) {}
  return null;
}

export default function MetasVisaoGeralPage() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const currentMonthLabel = format(parseISO(`${selectedMonth}-01`), "MMMM yyyy", { locale: ptBR });
  const currentUser = getCurrentUser();

  const [isMetaDialogOpen, setIsMetaDialogOpen] = useState(false);
  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [checkinMeta, setCheckinMeta] = useState<Meta | null>(null);

  const [metaForm, setMetaForm] = useState({
    title: "",
    description: "",
    areaId: "",
    responsibleId: "",
    measurementType: "percentage",
    targetValue: "",
    unit: "",
    month: selectedMonth,
  });

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

  const { data: checkins = [], isLoading: checkinsLoading } = useQuery<MetaCheckin[]>({
    queryKey: ["/api/metas", checkinMeta?.id, "checkins"],
    queryFn: async () => {
      if (!checkinMeta) return [];
      const res = await fetch(`/api/metas/${checkinMeta.id}/checkins`);
      return res.json();
    },
    enabled: !!checkinMeta,
  });

  const handlePrevMonth = () => {
    const prev = subMonths(parseISO(`${selectedMonth}-01`), 1);
    setSelectedMonth(format(prev, "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const next = addMonths(parseISO(`${selectedMonth}-01`), 1);
    setSelectedMonth(format(next, "yyyy-MM"));
  };

  const createMetaMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/metas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metas"] });
      toast({ title: "Meta criada com sucesso!" });
      setIsMetaDialogOpen(false);
      resetMetaForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar meta", description: error.message, variant: "destructive" });
    },
  });

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

  const resetMetaForm = () => {
    setMetaForm({
      title: "",
      description: "",
      areaId: selectedAreaId || "",
      responsibleId: "",
      measurementType: "percentage",
      targetValue: "",
      unit: "",
      month: selectedMonth,
    });
  };

  const openNewMetaDialog = (areaId: string) => {
    setSelectedAreaId(areaId);
    setMetaForm(prev => ({ ...prev, areaId, month: selectedMonth }));
    setIsMetaDialogOpen(true);
  };

  const openCheckin = (meta: Meta) => {
    setCheckinMeta(meta);
    setCheckinForm({ newValue: meta.currentValue || "0", comment: "" });
    setIsCheckinDialogOpen(true);
  };

  const handleSaveMeta = () => {
    const data = {
      ...metaForm,
      targetValue: parseFloat(metaForm.targetValue) || 0,
    };
    createMetaMutation.mutate(data);
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
        actions={
          <Button onClick={() => setIsMetaDialogOpen(true)} data-testid="button-nova-meta">
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">Metas Mensais</h2>
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

          <Card data-testid="card-by-area">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Total por Área</p>
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

          <Card data-testid="card-progress">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Progresso Médio</p>
                  <p className="text-2xl font-bold" data-testid="text-avg-progress">{stats.avgProgress.toFixed(0)}%</p>
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

          <Card data-testid="card-completed">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Metas Atingidas</p>
                  <p className="text-2xl font-bold" data-testid="text-completed-count">
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
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
                            Metas ({areaMetas.length})
                          </h4>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-primary font-bold"
                            onClick={() => openNewMetaDialog(area.id)}
                            data-testid={`button-add-meta-${area.id}`}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Nova Meta
                          </Button>
                        </div>
                        
                        {areaMetas.length === 0 ? (
                          <div className="text-center py-8 rounded-lg border border-dashed border-border/60">
                            <p className="text-[13px] text-muted-foreground">
                              Nenhuma meta cadastrada para esta área neste mês.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {areaMetas.map((meta) => {
                              const progress = getProgress(meta);
                              const user = getUserById(meta.responsibleId);
                              const current = parseFloat(meta.currentValue || "0");
                              const target = parseFloat(meta.targetValue || "100");

                              return (
                                <Card 
                                  key={meta.id} 
                                  className="p-4 shadow-none border-border/40 bg-background hover-elevate cursor-pointer" 
                                  data-testid={`card-meta-${meta.id}`}
                                  onClick={() => openCheckin(meta)}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <p className="text-[14px] font-bold text-foreground leading-snug" data-testid={`text-meta-title-${meta.id}`}>{meta.title}</p>
                                        <Badge variant="secondary" className="text-[9px] uppercase font-bold" data-testid={`badge-meta-type-${meta.id}`}>
                                          {measurementLabels[meta.measurementType] || meta.measurementType}
                                        </Badge>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-[9px] uppercase font-bold ${statusColors[meta.status]}`}
                                          data-testid={`badge-meta-status-${meta.id}`}
                                        >
                                          <CalendarClock className="h-3 w-3 mr-1" />
                                          {statusLabels[meta.status]}
                                        </Badge>
                                      </div>
                                      
                                      <div className="flex items-center gap-4 mb-2">
                                        <div className="flex-1 bg-muted rounded-full h-1.5" data-testid={`progress-meta-${meta.id}`}>
                                          <div 
                                            className="h-full rounded-full transition-all"
                                            style={{ 
                                              width: `${progress}%`,
                                              backgroundColor: area.color
                                            }}
                                          />
                                        </div>
                                        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap" data-testid={`text-meta-value-${meta.id}`}>
                                          {meta.measurementType === "binary" 
                                            ? (current > 0 ? "1 / 1" : "0 / 1")
                                            : `${formatValue(current, meta.measurementType)} / ${formatValue(target, meta.measurementType)} ${meta.unit || (meta.measurementType === "monetary" ? "" : measurementUnits[meta.measurementType])}`
                                          }
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                        {user && (
                                          <div className="flex items-center gap-1" data-testid={`text-meta-responsible-${meta.id}`}>
                                            <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                            </div>
                                            <span>{user.name}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1" data-testid={`text-meta-updated-${meta.id}`}>
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {meta.updatedAt ? format(parseISO(meta.updatedAt.toString()), "dd 'de' MMM yyyy", { locale: ptBR }) : format(parseISO(`${meta.month}-01`), "MMM yyyy", { locale: ptBR })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-2">
                                      <div 
                                        className="h-12 w-12 shrink-0 rounded-full border-2 flex items-center justify-center"
                                        style={{ borderColor: `${area.color}40` }}
                                        data-testid={`circle-progress-${meta.id}`}
                                      >
                                        <span className="text-[13px] font-bold" style={{ color: area.color }}>
                                          {progress.toFixed(0)}%
                                        </span>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-[10px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCheckin(meta);
                                        }}
                                        data-testid={`button-checkin-${meta.id}`}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Check-in
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
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

      <Dialog open={isMetaDialogOpen} onOpenChange={setIsMetaDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={metaForm.title}
                onChange={e => setMetaForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Aumentar vendas em 20%"
                data-testid="input-meta-title"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={metaForm.description}
                onChange={e => setMetaForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva a meta..."
                rows={2}
                data-testid="input-meta-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Área de Negócio *</Label>
                <Select
                  value={metaForm.areaId}
                  onValueChange={val => setMetaForm(prev => ({ ...prev, areaId: val }))}
                >
                  <SelectTrigger data-testid="select-meta-area">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAreas.map(area => (
                      <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsável *</Label>
                <Select
                  value={metaForm.responsibleId}
                  onValueChange={val => setMetaForm(prev => ({ ...prev, responsibleId: val }))}
                >
                  <SelectTrigger data-testid="select-meta-responsible">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Medição *</Label>
                <Select
                  value={metaForm.measurementType}
                  onValueChange={val => setMetaForm(prev => ({ ...prev, measurementType: val }))}
                >
                  <SelectTrigger data-testid="select-meta-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="absolute">Quantidade</SelectItem>
                    <SelectItem value="monetary">Monetário (R$)</SelectItem>
                    <SelectItem value="binary">Sim/Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {metaForm.measurementType !== "binary" && (
                <div className="space-y-2">
                  <Label>Valor Alvo *</Label>
                  <Input
                    type="number"
                    value={metaForm.targetValue}
                    onChange={e => setMetaForm(prev => ({ ...prev, targetValue: e.target.value }))}
                    placeholder={metaForm.measurementType === "percentage" ? "100" : "0"}
                    data-testid="input-meta-target"
                  />
                </div>
              )}
            </div>

            {metaForm.measurementType === "absolute" && (
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input
                  value={metaForm.unit}
                  onChange={e => setMetaForm(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="Ex: Pontos, Unidades, Itens..."
                  data-testid="input-meta-unit"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMetaDialogOpen(false)} data-testid="button-cancel-meta">
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveMeta}
              disabled={!metaForm.title || !metaForm.areaId || !metaForm.responsibleId || createMetaMutation.isPending}
              data-testid="button-save-meta"
            >
              {createMetaMutation.isPending ? "Salvando..." : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckinDialogOpen} onOpenChange={setIsCheckinDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Check-in de Progresso</DialogTitle>
          </DialogHeader>
          {checkinMeta && (
            <div className="space-y-6 py-4">
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Novo Valor *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={checkinForm.newValue}
                    onChange={e => setCheckinForm(prev => ({ ...prev, newValue: e.target.value }))}
                    placeholder="Informe o valor atual"
                    data-testid="input-checkin-value"
                  />
                  {checkinMeta.measurementType === "binary" && (
                    <p className="text-xs text-muted-foreground">0 = Não concluído, 1 = Concluído</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Comentário (opcional)</Label>
                  <Textarea
                    value={checkinForm.comment}
                    onChange={e => setCheckinForm(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="O que mudou? Obstáculos encontrados?"
                    rows={3}
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
                              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
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
          <DialogFooter>
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
