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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search,
  Pencil,
  Trash2,
  Archive,
} from "lucide-react";
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

export default function MetasPage() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const currentMonthLabel = format(parseISO(`${selectedMonth}-01`), "MMMM yyyy", { locale: ptBR });
  const currentUser = getCurrentUser();

  const [activeTab, setActiveTab] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isMetaDialogOpen, setIsMetaDialogOpen] = useState(false);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [editingArea, setEditingArea] = useState<MetaArea | null>(null);
  const [checkinMeta, setCheckinMeta] = useState<Meta | null>(null);
  const [deletingMeta, setDeletingMeta] = useState<Meta | null>(null);

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

  const [areaForm, setAreaForm] = useState({
    name: "",
    color: "#00A137",
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

  const { data: areas = [], isLoading: areasLoading } = useQuery<MetaArea[]>({
    queryKey: ["/api/meta-areas"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
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

  const updateMetaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/metas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metas"] });
      toast({ title: "Meta atualizada com sucesso!" });
      setIsMetaDialogOpen(false);
      resetMetaForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar meta", description: error.message, variant: "destructive" });
    },
  });

  const deleteMetaMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/metas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metas"] });
      toast({ title: "Meta excluída com sucesso!" });
      setIsDeleteDialogOpen(false);
      setDeletingMeta(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir meta", description: error.message, variant: "destructive" });
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/meta-areas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-areas"] });
      toast({ title: "Área criada com sucesso!" });
      setIsAreaDialogOpen(false);
      resetAreaForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar área", description: error.message, variant: "destructive" });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/meta-areas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-areas"] });
      toast({ title: "Área atualizada com sucesso!" });
      setIsAreaDialogOpen(false);
      resetAreaForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar área", description: error.message, variant: "destructive" });
    },
  });

  const archiveAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/meta-areas/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meta-areas"] });
      if (data.archived) {
        toast({ title: "Área arquivada", description: "A área possui metas vinculadas e foi arquivada." });
      } else {
        toast({ title: "Área excluída com sucesso!" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro ao arquivar área", description: error.message, variant: "destructive" });
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
      areaId: "",
      responsibleId: "",
      measurementType: "percentage",
      targetValue: "",
      unit: "",
      month: selectedMonth,
    });
    setEditingMeta(null);
  };

  const resetAreaForm = () => {
    setAreaForm({ name: "", color: "#00A137" });
    setEditingArea(null);
  };

  const openEditMeta = (meta: Meta) => {
    setEditingMeta(meta);
    setMetaForm({
      title: meta.title,
      description: meta.description || "",
      areaId: meta.areaId,
      responsibleId: meta.responsibleId,
      measurementType: meta.measurementType,
      targetValue: meta.targetValue || "",
      unit: meta.unit || "",
      month: meta.month,
    });
    setIsMetaDialogOpen(true);
  };

  const openEditArea = (area: MetaArea) => {
    setEditingArea(area);
    setAreaForm({ name: area.name, color: area.color });
    setIsAreaDialogOpen(true);
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
    if (editingMeta) {
      updateMetaMutation.mutate({ id: editingMeta.id, data });
    } else {
      createMetaMutation.mutate(data);
    }
  };

  const handleSaveArea = () => {
    if (editingArea) {
      updateAreaMutation.mutate({ id: editingArea.id, data: areaForm });
    } else {
      createAreaMutation.mutate(areaForm);
    }
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

  const filteredMetas = useMemo(() => {
    let result = metas;
    
    if (activeTab === "minhas" && currentUser) {
      result = result.filter(m => m.responsibleId === currentUser.id);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(m => m.title.toLowerCase().includes(term));
    }
    
    if (statusFilter !== "all") {
      result = result.filter(m => m.status === statusFilter);
    }
    
    return result;
  }, [metas, activeTab, currentUser, searchTerm, statusFilter]);

  const metasByArea = useMemo(() => {
    const grouped: Record<string, Meta[]> = {};
    filteredMetas.forEach(meta => {
      if (!grouped[meta.areaId]) grouped[meta.areaId] = [];
      grouped[meta.areaId].push(meta);
    });
    return grouped;
  }, [filteredMetas]);

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

  const renderMetaCard = (meta: Meta) => {
    const area = getAreaById(meta.areaId);
    const user = getUserById(meta.responsibleId);
    const progress = getProgress(meta);

    return (
      <Card key={meta.id} className="hover-elevate" data-testid={`card-meta-${meta.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate" data-testid={`text-meta-title-${meta.id}`}>
                {meta.title}
              </h4>
              {area && (
                <Badge 
                  variant="outline" 
                  className="mt-1 text-xs"
                  style={{ borderColor: area.color, color: area.color }}
                  data-testid={`badge-area-${meta.id}`}
                >
                  {area.name}
                </Badge>
              )}
            </div>
            <Badge className={statusColors[meta.status]} data-testid={`badge-status-${meta.id}`}>
              {statusLabels[meta.status]}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mb-3">
            {user && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{user.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">
                {meta.measurementType === "binary" 
                  ? (parseFloat(meta.currentValue || "0") > 0 ? "Sim" : "Não")
                  : `${meta.currentValue || 0} / ${meta.targetValue} ${meta.unit || measurementUnits[meta.measurementType]}`
                }
              </span>
            </div>
            <Progress value={progress} className="h-2" data-testid={`progress-meta-${meta.id}`} />
            <div className="text-right text-xs font-medium text-muted-foreground">
              {progress.toFixed(0)}%
            </div>
          </div>

          <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openCheckin(meta)}
              data-testid={`button-checkin-${meta.id}`}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openEditMeta(meta)}
              data-testid={`button-edit-${meta.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                setDeletingMeta(meta);
                setIsDeleteDialogOpen(true);
              }}
              data-testid={`button-delete-${meta.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-metas">
            <TabsTrigger value="todas" data-testid="tab-todas">Todas as Metas</TabsTrigger>
            <TabsTrigger value="minhas" data-testid="tab-minhas">Minhas Metas</TabsTrigger>
            <TabsTrigger value="areas" data-testid="tab-areas">Áreas de Negócio</TabsTrigger>
          </TabsList>

          <TabsContent value="todas" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="on_track">No Prazo</SelectItem>
                  <SelectItem value="at_risk">Em Risco</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredMetas.length === 0 ? (
              <Card className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-1">Nenhuma meta encontrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Comece criando sua primeira meta para este mês!
                </p>
                <Button onClick={() => setIsMetaDialogOpen(true)} data-testid="button-criar-primeira">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Meta
                </Button>
              </Card>
            ) : (
              <div className="space-y-8">
                {activeAreas.map(area => {
                  const areaMetas = metasByArea[area.id] || [];
                  if (areaMetas.length === 0) return null;
                  
                  const areaCompleted = areaMetas.filter(m => m.status === "completed" || getProgress(m) >= 100).length;
                  const areaProgress = areaMetas.length > 0 
                    ? areaMetas.reduce((sum, m) => sum + getProgress(m), 0) / areaMetas.length 
                    : 0;

                  return (
                    <div key={area.id} className="space-y-4" data-testid={`area-group-${area.id}`}>
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                          <h3 className="text-lg font-bold">{area.name}</h3>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {areaCompleted}/{areaMetas.length} concluídas
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <Progress value={areaProgress} className="h-1.5 flex-1" />
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                            {areaProgress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {areaMetas.map(meta => renderMetaCard(meta))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="minhas" className="space-y-4 mt-4">
            {filteredMetas.length === 0 ? (
              <Card className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-1">Nenhuma meta atribuída a você</h3>
                <p className="text-sm text-muted-foreground">
                  Você não possui metas como responsável neste mês.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMetas.map(renderMetaCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="areas" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsAreaDialogOpen(true)} data-testid="button-nova-area">
                <Plus className="h-4 w-4 mr-2" />
                Nova Área
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead className="text-center">Metas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areasLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : areas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma área cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    areas.map(area => {
                      const areaMetasCount = metas.filter(m => m.areaId === area.id).length;
                      return (
                        <TableRow key={area.id} data-testid={`row-area-${area.id}`}>
                          <TableCell className="font-medium">{area.name}</TableCell>
                          <TableCell>
                            <div 
                              className="w-6 h-6 rounded border" 
                              style={{ backgroundColor: area.color }}
                            />
                          </TableCell>
                          <TableCell className="text-center">{areaMetasCount}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditArea(area)}
                              data-testid={`button-edit-area-${area.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => archiveAreaMutation.mutate(area.id)}
                              data-testid={`button-archive-area-${area.id}`}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isMetaDialogOpen} onOpenChange={setIsMetaDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
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
            <Button variant="outline" onClick={() => { setIsMetaDialogOpen(false); resetMetaForm(); }} data-testid="button-cancel-meta">
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveMeta}
              disabled={!metaForm.title || !metaForm.areaId || !metaForm.responsibleId || createMetaMutation.isPending || updateMetaMutation.isPending}
              data-testid="button-save-meta"
            >
              {(createMetaMutation.isPending || updateMetaMutation.isPending) ? "Salvando..." : (editingMeta ? "Salvar" : "Criar Meta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingArea ? "Editar Área" : "Nova Área"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={areaForm.name}
                onChange={e => setAreaForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Comercial, Marketing..."
                data-testid="input-area-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={areaForm.color}
                  onChange={e => setAreaForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-14 h-10 p-1"
                  data-testid="input-area-color"
                />
                <Input
                  value={areaForm.color}
                  onChange={e => setAreaForm(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#00A137"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAreaDialogOpen(false); resetAreaForm(); }} data-testid="button-cancel-area">
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveArea}
              disabled={!areaForm.name || createAreaMutation.isPending || updateAreaMutation.isPending}
              data-testid="button-save-area"
            >
              {(createAreaMutation.isPending || updateAreaMutation.isPending) ? "Salvando..." : (editingArea ? "Salvar" : "Criar Área")}
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
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-lg" data-testid="card-checkin-info">
                <h4 className="font-bold text-sm mb-1" data-testid="text-checkin-meta-title">{checkinMeta.title}</h4>
                <p className="text-xs text-muted-foreground" data-testid="text-checkin-area">
                  {getAreaById(checkinMeta.areaId)?.name}
                </p>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-muted-foreground">Progresso atual:</span>
                  <span className="text-lg font-bold" data-testid="text-checkin-current-progress">
                    {checkinMeta.currentValue || 0} / {checkinMeta.targetValue} 
                    {checkinMeta.measurementType !== "binary" && ` ${checkinMeta.unit || measurementUnits[checkinMeta.measurementType]}`}
                  </span>
                </div>
                <Progress value={getProgress(checkinMeta)} className="h-2 mt-2" data-testid="progress-checkin" />
              </div>

              <div className="space-y-2">
                <Label>Novo Valor *</Label>
                <Input
                  type="number"
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta "{deletingMeta?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingMeta && deleteMetaMutation.mutate(deletingMeta.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMetaMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
