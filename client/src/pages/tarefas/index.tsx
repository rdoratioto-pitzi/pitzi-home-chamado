import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Folder, 
  Users, 
  User, 
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Archive,
  FileText,
  Trash2,
  Edit,
  LayoutGrid,
  List
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { TaskArea, Task } from "@shared/schema";
import { TaskKanban } from "./task-kanban";

const statusConfig = {
  todo: { label: "A Fazer", icon: Circle, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  doing: { label: "Em Andamento", icon: Clock, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  done: { label: "Concluído", icon: CheckCircle2, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  archived: { label: "Arquivado", icon: Archive, color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

const priorityConfig = {
  low: { label: "Baixa", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  high: { label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const typeConfig = {
  task: { label: "Tarefa", icon: CheckCircle2 },
  meeting_note: { label: "Reunião", icon: FileText },
};

export default function TarefasPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingArea, setEditingArea] = useState<TaskArea | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("grid");

  const [newArea, setNewArea] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "shared",
    color: "#00A137",
    ownerId: "admin",
  });

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "task" as "task" | "meeting_note",
    status: "todo",
    priority: "medium",
    areaId: "",
    createdBy: "admin",
    assigneeId: "",
    dueDate: "",
    meetingData: {
      date: "",
      time: "",
      location: "",
      participants: [] as string[],
      agenda: [] as string[],
      actions: [] as { description: string; responsible: string; deadline: string }[],
    }
  });

  const { data: areas = [], isLoading: areasLoading } = useQuery<TaskArea[]>({
    queryKey: ["/api/task-areas"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", selectedAreaId],
    queryFn: async () => {
      const url = selectedAreaId 
        ? `/api/tasks?area_id=${selectedAreaId}` 
        : "/api/tasks";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: async (data: typeof newArea) => {
      return apiRequest("POST", "/api/task-areas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-areas"] });
      setShowAreaDialog(false);
      setNewArea({ name: "", description: "", visibility: "private", color: "#00A137", ownerId: "admin" });
      toast({ title: "Área criada com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Area creation error:", error);
      toast({ title: "Erro ao criar área", description: error.message, variant: "destructive" });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskArea> }) => {
      return apiRequest("PUT", `/api/task-areas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-areas"] });
      setShowAreaDialog(false);
      setEditingArea(null);
      toast({ title: "Área atualizada com sucesso!" });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/task-areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-areas"] });
      if (selectedAreaId) setSelectedAreaId(null);
      toast({ title: "Área excluída com sucesso!" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        type: data.type,
        status: data.status,
        priority: data.priority,
        areaId: data.areaId || selectedAreaId || "",
        createdBy: data.createdBy,
        dueDate: data.dueDate || null,
        assigneeId: data.assigneeId || undefined,
        meetingData: data.type === "meeting_note" ? data.meetingData : undefined,
      };
      return apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      // Invalidate both the general list and the area-specific list
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      setShowTaskDialog(false);
      setNewTask({
        title: "",
        description: "",
        type: "task",
        status: "todo",
        priority: "medium",
        areaId: "",
        createdBy: "admin",
        assigneeId: "",
        dueDate: "",
        meetingData: {
          date: "",
          time: "",
          location: "",
          participants: [],
          agenda: [],
          actions: [],
        }
      });
      toast({ title: "Tarefa criada com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Task creation error:", error);
      toast({ title: "Erro ao criar tarefa", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return apiRequest("PUT", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      toast({ title: "Tarefa atualizada!" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      toast({ title: "Tarefa excluída!" });
    },
  });

  const filteredTasks = tasks.filter(task => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && task.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== "all" && task.type !== typeFilter) {
      return false;
    }
    return true;
  });

  const selectedArea = areas.find(a => a.id === selectedAreaId);

  const handleOpenAreaDialog = (area?: TaskArea) => {
    if (area) {
      setEditingArea(area);
      setNewArea({
        name: area.name,
        description: area.description || "",
        visibility: area.visibility as "private" | "shared",
        color: area.color || "#00A137",
        ownerId: area.ownerId,
      });
    } else {
      setEditingArea(null);
      setNewArea({ name: "", description: "", visibility: "private", color: "#00A137", ownerId: "admin" });
    }
    setShowAreaDialog(true);
  };

  const handleSaveArea = () => {
    if (editingArea) {
      updateAreaMutation.mutate({ id: editingArea.id, data: newArea });
    } else {
      createAreaMutation.mutate(newArea);
    }
  };

  const handleOpenTaskDialog = (type: "task" | "meeting_note" = "task") => {
    setNewTask({
      ...newTask,
      type,
      areaId: selectedAreaId || (areas[0]?.id || ""),
      meetingData: {
        date: "",
        time: "",
        location: "",
        participants: [] as string[],
        agenda: [] as string[],
        actions: [] as { description: string; responsible: string; deadline: string }[],
      }
    });
    setShowTaskDialog(true);
  };

  const handleOpenMeetingDialog = () => handleOpenTaskDialog("meeting_note");
  const handleOpenNormalTaskDialog = () => handleOpenTaskDialog("task");

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Áreas
            </h2>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => handleOpenAreaDialog()}
              data-testid="button-new-area"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          <button
            onClick={() => setSelectedAreaId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedAreaId === null 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-muted"
            }`}
            data-testid="button-all-tasks"
          >
            <Folder className="h-4 w-4" />
            <span>Todas as Tarefas</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {tasks.length}
            </Badge>
          </button>

          <div className="mt-4 space-y-1">
            {areasLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              areas.map((area) => {
                const areaTaskCount = tasks.filter(t => t.areaId === area.id).length;
                return (
                  <div 
                    key={area.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      selectedAreaId === area.id 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedAreaId(area.id)}
                    data-testid={`button-area-${area.id}`}
                  >
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: area.color || "#00A137" }}
                    />
                    {area.visibility === "shared" ? (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{area.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {areaTaskCount}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-area-menu-${area.id}`}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenAreaDialog(area)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteAreaMutation.mutate(area.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <PageHeader
          title={selectedArea ? selectedArea.name : "Todas as Tarefas"}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleOpenMeetingDialog} data-testid="button-new-meeting">
                <FileText className="h-4 w-4 mr-2" />
                Nova Reunião
              </Button>
              <Button onClick={handleOpenNormalTaskDialog} data-testid="button-new-task">
                <Plus className="h-4 w-4 mr-2" />
                Nova Tarefa
              </Button>
            </div>
          }
        />

        <div className="p-6 flex-1 overflow-auto">
          <Card className="shadow-sm border-border/60 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-tasks"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="doing">Em Andamento</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-type-filter">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="task">Tarefas</SelectItem>
                  <SelectItem value="meeting_note">Reuniões</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center border rounded-md p-1 bg-muted/50">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grid"
                >
                  <Folder className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setViewMode("kanban")}
                  data-testid="button-view-kanban"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {tasksLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando tarefas...</div>
          ) : filteredTasks.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all" 
                  ? "Tente ajustar os filtros"
                  : "Crie sua primeira tarefa para começar"}
              </p>
              {!searchQuery && statusFilter === "all" && typeFilter === "all" && (
                <Button onClick={handleOpenTaskDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </Button>
              )}
            </Card>
          ) : viewMode === "kanban" ? (
            <TaskKanban tasks={filteredTasks} areas={areas} />
          ) : (
            <div className={viewMode === "grid" ? "space-y-2" : "border rounded-md divide-y"}>
              {filteredTasks.map((task) => {
                const status = statusConfig[task.status as keyof typeof statusConfig];
                const priority = priorityConfig[task.priority as keyof typeof priorityConfig];
                const taskType = typeConfig[task.type as keyof typeof typeConfig];
                const taskArea = areas.find(a => a.id === task.areaId);
                const StatusIcon = status?.icon || Circle;
                const TypeIcon = taskType?.icon || CheckCircle2;

                if (viewMode === "list") {
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tarefas/${task.id}`)}
                      data-testid={`list-item-task-${task.id}`}
                    >
                      <button
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
                          updateTaskMutation.mutate({ id: task.id, data: { status: nextStatus } });
                        }}
                      >
                        <StatusIcon className={`h-5 w-5 ${
                          task.status === "done" ? "text-green-500" : 
                          task.status === "doing" ? "text-blue-500" : "text-gray-400"
                        }`} />
                      </button>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className={`font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">
                          <TypeIcon className="h-2 w-2 mr-1" />
                          {taskType?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {taskArea && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: taskArea.color || "#00A137" }} />
                            <span className="text-xs text-muted-foreground">{taskArea.name}</span>
                          </div>
                        )}
                        <Badge className={`text-[10px] h-4 px-1 ${priority?.color}`}>
                          {priority?.label}
                        </Badge>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/tarefas/${task.id}`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteTaskMutation.mutate(task.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                }

                return (
                  <Card 
                    key={task.id}
                    className="p-4 hover-elevate cursor-pointer"
                    onClick={() => navigate(`/tarefas/${task.id}`)}
                    data-testid={`card-task-${task.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        className="mt-1 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
                          updateTaskMutation.mutate({ id: task.id, data: { status: nextStatus } });
                        }}
                        data-testid={`button-toggle-status-${task.id}`}
                      >
                        <StatusIcon className={`h-5 w-5 ${
                          task.status === "done" ? "text-green-500" : 
                          task.status === "doing" ? "text-blue-500" : "text-gray-400"
                        }`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {taskType?.label}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {taskArea && !selectedAreaId && (
                            <Badge variant="secondary" className="text-xs">
                              <div 
                                className="h-2 w-2 rounded-full mr-1" 
                                style={{ backgroundColor: taskArea.color || "#00A137" }}
                              />
                              {taskArea.name}
                            </Badge>
                          )}
                          <Badge className={`text-xs ${priority?.color}`}>
                            {priority?.label}
                          </Badge>
                          {task.dueDate && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-task-menu-${task.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tarefas/${task.id}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTaskMutation.mutate(task.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? "Editar Área" : "Nova Área"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newArea.name}
                onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                placeholder="Nome da área"
                data-testid="input-area-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={newArea.description}
                onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                placeholder="Descrição opcional"
                data-testid="input-area-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibilidade</label>
              <Select 
                value={newArea.visibility} 
                onValueChange={(v) => setNewArea({ ...newArea, visibility: v as "private" | "shared" })}
              >
                <SelectTrigger data-testid="select-area-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Privada
                    </div>
                  </SelectItem>
                  <SelectItem value="shared">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Compartilhada
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor</label>
              <div className="flex gap-2">
                {["#00A137", "#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", "#EC4899"].map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full border-2 ${
                      newArea.color === color ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewArea({ ...newArea, color })}
                    data-testid={`button-color-${color.slice(1)}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAreaDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveArea} 
              disabled={!newArea.name || createAreaMutation.isPending || updateAreaMutation.isPending}
              data-testid="button-save-area"
            >
              {editingArea ? "Salvar" : "Criar Área"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{newTask.type === "meeting_note" ? "Nova Reunião" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder={newTask.type === "meeting_note" ? "Título da reunião" : "Título da tarefa"}
                data-testid="input-task-title"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Área</label>
              <Select 
                value={newTask.areaId || selectedAreaId || ""} 
                onValueChange={(v) => setNewTask({ ...newTask, areaId: v })}
              >
                <SelectTrigger data-testid="select-task-area">
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: area.color || "#00A137" }}
                        />
                        {area.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newTask.type === "task" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Detalhes da tarefa..."
                    rows={3}
                    data-testid="input-task-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prioridade</label>
                    <Select 
                      value={newTask.priority} 
                      onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
                    >
                      <SelectTrigger data-testid="select-task-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Entrega</label>
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      data-testid="input-task-due-date"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4 border-t pt-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data</label>
                    <Input
                      type="date"
                      value={newTask.meetingData.date}
                      onChange={(e) => setNewTask({ 
                        ...newTask, 
                        meetingData: { ...newTask.meetingData, date: e.target.value } 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Horário</label>
                    <Input
                      type="time"
                      value={newTask.meetingData.time}
                      onChange={(e) => setNewTask({ 
                        ...newTask, 
                        meetingData: { ...newTask.meetingData, time: e.target.value } 
                      })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Local</label>
                  <Input
                    value={newTask.meetingData.location}
                    onChange={(e) => setNewTask({ 
                      ...newTask, 
                      meetingData: { ...newTask.meetingData, location: e.target.value } 
                    })}
                    placeholder="Local da reunião"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Participantes</label>
                  <Input
                    value={newTask.meetingData.participants.join(", ")}
                    onChange={(e) => setNewTask({ 
                      ...newTask, 
                      meetingData: { 
                        ...newTask.meetingData, 
                        participants: e.target.value.split(",").map(p => p.trim()).filter(Boolean) 
                      } 
                    })}
                    placeholder="Participantes (separados por vírgula)"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pauta</label>
                  <Textarea
                    value={newTask.meetingData.agenda.join("\n")}
                    onChange={(e) => setNewTask({ 
                      ...newTask, 
                      meetingData: { 
                        ...newTask.meetingData, 
                        agenda: e.target.value.split("\n").filter(Boolean) 
                      } 
                    })}
                    placeholder="Itens da pauta (um por linha)"
                    rows={6}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createTaskMutation.mutate(newTask)} 
              disabled={!newTask.title || !newTask.areaId || createTaskMutation.isPending}
              data-testid="button-save-task"
            >
              {newTask.type === "meeting_note" ? "Criar Reunião" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
