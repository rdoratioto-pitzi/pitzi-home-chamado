import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextarea } from "@/components/rich-textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Target,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Pencil,
  Trash2,
  BarChart3,
  ChevronDown,
  Search,
  Archive,
} from "lucide-react";
import type { Meta, MetaArea, MetaCheckin, User } from "@shared/schema";

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
  percentage: "Percentual (%)",
  absolute: "Quantidade",
  monetary: "Monetário (R$)",
  binary: "Sim/Não",
};

const measurementUnits: Record<string, string> = {
  percentage: "%",
  absolute: "",
  monetary: "R$",
  binary: "",
};

const areaColors = [
  "#00A137", "#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

function generateMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = -6; i <= 3; i++) {
    const date = addMonths(now, i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return options;
}

function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) return JSON.parse(userStr);
  } catch (e) {}
  return null;
}

export default function GestaoMetasPage() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState<string[]>([]);

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

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (let i = currentMonth; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  };

  const monthOptions = getMonthOptions();
  const currentUser = getCurrentUser();

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
    
    if (areaFilter.length > 0) {
      result = result.filter(m => areaFilter.includes(m.areaId));
    }
    
    return result;
  }, [metas, activeTab, currentUser, searchTerm, statusFilter, areaFilter]);

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
    const completed = metas.filter(m => m.status === "completed").length;
    const inProgress = metas.filter(m => m.status === "on_track" || m.status === "at_risk").length;
    const overdue = metas.filter(m => m.status === "overdue").length;
    return { total, completed, inProgress, overdue };
  }, [metas]);

  const renderMetaCard = (meta: Meta) => {
    const area = getAreaById(meta.areaId);
    const user = getUserById(meta.responsibleId);
    const progress = getProgress(meta);

    // Buscar check-ins da meta
    const { data: checkins = [] } = useQuery<any[]>({
      queryKey: ["/api/metas", meta.id, "checkins"],
      queryFn: async () => {
        const res = await fetch(`/api/metas/${meta.id}/checkins`);
        return res.json();
      },
    });

    const formatValue = (value: number) => {
      if (meta.measurementType === "monetary") {
        return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      }
      if (meta.measurementType === "percentage") {
        return `${value}%`;
      }
      return `${value} ${meta.unit || ""}`;
    };

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

          {/* Histórico de Check-ins - completo */}
          {checkins && checkins.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Histórico de Check-ins ({checkins.length})
                </span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {checkins
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((checkin: any) => (
                    <div
                      key={checkin.id}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                          {(checkin.user?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{checkin.user?.name || 'Usuário'}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(checkin.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-medium text-primary">
                          {meta.measurementType === 'monetary'
                            ? `R$ ${Number(checkin.newValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            : meta.measurementType === 'percentage'
                            ? `${checkin.newValue}%`
                            : `${checkin.newValue} ${meta.unit || ''}`
                          }
                        </span>
                        {checkin.comment && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={checkin.comment}>
                            {checkin.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => openCheckin(meta)}
              data-testid={`button-checkin-${meta.id}`}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => openEditMeta(meta)}
              data-testid={`button-edit-${meta.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
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

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Gestão de Metas"
        breadcrumbs={[{ label: "Metas" }, { label: "Gestão" }]}
        actions={
          <Button onClick={() => setIsMetaDialogOpen(true)} data-testid="button-nova-meta">
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold" data-testid="stat-total">{stats.total}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                  <p className="text-lg font-bold" data-testid="stat-completed">{stats.completed}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                  <p className="text-lg font-bold" data-testid="stat-inprogress">{stats.inProgress}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                  <p className="text-lg font-bold" data-testid="stat-overdue">{stats.overdue}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-metas">
            <TabsTrigger value="todas" data-testid="tab-todas">Todas as Metas</TabsTrigger>
            <TabsTrigger value="minhas" data-testid="tab-minhas">Minhas Metas</TabsTrigger>
            <TabsTrigger value="areas" data-testid="tab-areas">Áreas de Negócio</TabsTrigger>
          </TabsList>

          <TabsContent value="todas" className="space-y-4">
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

            {metasLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : filteredMetas.length === 0 ? (
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
              <Accordion type="multiple" defaultValue={Object.keys(metasByArea)} className="space-y-3">
                {Object.entries(metasByArea).map(([areaId, areaMetas]) => {
                  const area = getAreaById(areaId);
                  const avgProgress = areaMetas.reduce((sum, m) => sum + getProgress(m), 0) / areaMetas.length;
                  const completedCount = areaMetas.filter(m => m.status === "completed").length;

                  return (
                    <AccordionItem key={areaId} value={areaId} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: area?.color || "#888" }}
                          />
                          <span className="font-medium">{area?.name || "Sem Área"}</span>
                          <Badge variant="outline" className="ml-2">
                            {completedCount}/{areaMetas.length} concluídas
                          </Badge>
                          <div className="flex-1 max-w-[120px] ml-auto mr-4">
                            <Progress value={avgProgress} className="h-2" />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {avgProgress.toFixed(0)}%
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {areaMetas.map(renderMetaCard)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>

          <TabsContent value="minhas" className="space-y-4">
            {metasLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : filteredMetas.length === 0 ? (
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

          <TabsContent value="areas" className="space-y-4">
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
                              className="h-8 w-8"
                              onClick={() => openEditArea(area)}
                              data-testid={`button-edit-area-${area.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={metaForm.title}
                onChange={e => setMetaForm({ ...metaForm, title: e.target.value })}
                placeholder="Ex: Aumentar vendas em 20%"
                data-testid="input-meta-title"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <RichTextarea
                value={metaForm.description}
                onChange={(val: string) => setMetaForm({ ...metaForm, description: val })}
                placeholder="Detalhes da meta..."
                data-testid="input-meta-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Área de Negócio *</Label>
                <Select 
                  value={metaForm.areaId} 
                  onValueChange={v => setMetaForm({ ...metaForm, areaId: v })}
                >
                  <SelectTrigger data-testid="select-meta-area">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map(area => (
                      <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável *</Label>
                <Select 
                  value={metaForm.responsibleId} 
                  onValueChange={v => setMetaForm({ ...metaForm, responsibleId: v })}
                >
                  <SelectTrigger data-testid="select-meta-responsible">
                    <SelectValue placeholder="Selecione" />
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
              <div>
                <Label>Tipo de Valor *</Label>
                <Select 
                  value={metaForm.measurementType} 
                  onValueChange={v => setMetaForm({ ...metaForm, measurementType: v, targetValue: "" })}
                >
                  <SelectTrigger data-testid="select-meta-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(measurementLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Meta *</Label>
                {metaForm.measurementType === "monetary" ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-9"
                      value={metaForm.targetValue}
                      onChange={e => setMetaForm({ ...metaForm, targetValue: e.target.value })}
                      placeholder="0,00"
                      data-testid="input-meta-target-monetary"
                    />
                  </div>
                ) : metaForm.measurementType === "binary" ? (
                  <Select 
                    value={metaForm.targetValue} 
                    onValueChange={v => setMetaForm({ ...metaForm, targetValue: v })}
                  >
                    <SelectTrigger data-testid="select-meta-target-binary">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sim</SelectItem>
                      <SelectItem value="0">Não</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Input
                      type="number"
                      className={metaForm.measurementType === "percentage" ? "pr-9" : ""}
                      value={metaForm.targetValue}
                      onChange={e => setMetaForm({ ...metaForm, targetValue: e.target.value })}
                      placeholder={metaForm.measurementType === "percentage" ? "100" : "0"}
                      data-testid="input-meta-target"
                    />
                    {metaForm.measurementType === "percentage" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Mês</Label>
              <Select 
                value={metaForm.month} 
                onValueChange={v => setMetaForm({ ...metaForm, month: v })}
              >
                <SelectTrigger data-testid="select-meta-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsMetaDialogOpen(false); resetMetaForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveMeta} 
              disabled={createMetaMutation.isPending || updateMetaMutation.isPending}
              data-testid="button-save-meta"
            >
              {editingMeta ? "Salvar" : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingArea ? "Editar Área" : "Nova Área"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={areaForm.name}
                onChange={e => setAreaForm({ ...areaForm, name: e.target.value })}
                placeholder="Ex: Vendas"
                data-testid="input-area-name"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {areaColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded border-2 ${areaForm.color === color ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setAreaForm({ ...areaForm, color })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAreaDialogOpen(false); resetAreaForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveArea} 
              disabled={createAreaMutation.isPending || updateAreaMutation.isPending}
              data-testid="button-save-area"
            >
              {editingArea ? "Salvar" : "Criar Área"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckinDialogOpen} onOpenChange={setIsCheckinDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Registrar Check-in</DialogTitle>
          </DialogHeader>
          {checkinMeta && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{checkinMeta.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor atual: {checkinMeta.currentValue || 0} / Meta: {checkinMeta.targetValue}
                </p>
              </div>
              <div>
                <Label>Novo Valor *</Label>
                <Input
                  type="number"
                  value={checkinForm.newValue}
                  onChange={e => setCheckinForm({ ...checkinForm, newValue: e.target.value })}
                  data-testid="input-checkin-value"
                />
              </div>
              <div>
                <Label>Comentário</Label>
                <RichTextarea
                  value={checkinForm.comment}
                  onChange={(val: string) => setCheckinForm({ ...checkinForm, comment: val })}
                  placeholder="Opcional: adicione um comentário..."
                  data-testid="input-checkin-comment"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsCheckinDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCheckin}
              disabled={createCheckinMutation.isPending}
              data-testid="button-save-checkin"
            >
              Registrar Check-in
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingMeta && deleteMetaMutation.mutate(deletingMeta.id)}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
