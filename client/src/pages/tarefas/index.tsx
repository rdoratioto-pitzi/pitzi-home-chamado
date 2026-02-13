import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RichTextarea } from "@/components/rich-textarea";
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
  List,
  Repeat,
  X,
  GripVertical,
  Maximize2
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import type { User as UserType } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("list");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const sidebarResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!sidebarResizing.current) return;
      const newWidth = Math.max(180, Math.min(480, startWidth + (ev.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      sidebarResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || "";

  const [newArea, setNewArea] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "shared",
    color: "#00A137",
    ownerId: currentUserId,
    memberIds: [] as string[],
    scope: "tasks" as string,
  });
  const [memberSearchInput, setMemberSearchInput] = useState("");

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "task" as "task" | "meeting_note",
    status: "todo",
    priority: "medium",
    areaId: "",
    createdBy: "admin",
    assigneeId: "",
    assigneeIds: [] as string[],
    dueDate: "",
    meetingData: {
      date: "",
      time: "",
      location: "",
      participants: [] as string[],
      externalParticipants: [] as string[],
      agenda: "",
      actions: [] as { description: string; responsible: string; deadline: string }[],
    },
    isRecurring: false,
    recurrenceType: "daily" as "daily" | "weekly",
    recurrenceWeekdays: [] as number[],
    recurrenceEndDate: "",
  });

  const [participantInput, setParticipantInput] = useState("");
  const [externalParticipantInput, setExternalParticipantInput] = useState("");

  const { data: areas = [], isLoading: areasLoading } = useQuery<TaskArea[]>({
    queryKey: ["/api/task-tags", "tasks"],
    queryFn: async () => {
      const res = await fetch("/api/task-tags?scope=tasks");
      if (!res.ok) throw new Error("Failed to fetch areas");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const filteredUsers = useMemo(() => {
    if (!participantInput) return users;
    const search = participantInput.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }, [users, participantInput]);

  const { data: globalTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", "tasks", "all"],
    queryFn: async () => {
      const res = await fetch("/api/tasks?type=task");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", selectedAreaId],
    queryFn: async () => {
      const url = selectedAreaId 
        ? `/api/tasks?tagId=${selectedAreaId}&type=task` 
        : "/api/tasks?type=task";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: async (data: typeof newArea) => {
      return apiRequest("POST", "/api/task-tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "tasks"] });
      setShowAreaDialog(false);
      setNewArea({ name: "", description: "", visibility: "private", color: "#00A137", ownerId: currentUserId, memberIds: [], scope: "tasks" });
      setMemberSearchInput("");
      toast({ title: "Tag criada com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Area creation error:", error);
      toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskArea> }) => {
      return apiRequest("PUT", `/api/task-tags/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "tasks"] });
      setShowAreaDialog(false);
      setEditingArea(null);
      toast({ title: "Tag atualizada com sucesso!" });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/task-tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "tasks"] });
      if (selectedAreaId) setSelectedAreaId(null);
      toast({ title: "Tag excluída com sucesso!" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const meetingDataPayload = data.type === "meeting_note" ? {
        ...data.meetingData,
        agenda: data.meetingData.agenda,
        participants: data.meetingData.participants,
        externalParticipants: data.meetingData.externalParticipants,
      } : undefined;
      
      const payload = {
        title: data.title,
        description: data.description || undefined,
        type: data.type,
        status: data.status,
        priority: data.priority,
        tagId: data.areaId || selectedAreaId || undefined,
        createdBy: data.createdBy,
        dueDate: data.dueDate || null,
        assigneeId: data.assigneeId || undefined,
        assigneeIds: data.assigneeIds.length > 0 ? JSON.stringify(data.assigneeIds) : undefined,
        meetingData: meetingDataPayload ? JSON.stringify(meetingDataPayload) : undefined,
        isRecurring: data.isRecurring,
        recurrenceType: data.isRecurring ? data.recurrenceType : undefined,
        recurrenceWeekdays: data.isRecurring && data.recurrenceType === "weekly" ? JSON.stringify(data.recurrenceWeekdays) : undefined,
        recurrenceEndDate: data.isRecurring && data.recurrenceEndDate ? data.recurrenceEndDate : undefined,
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
        createdBy: currentUserId,
        assigneeId: "",
        assigneeIds: [],
        dueDate: "",
        meetingData: {
          date: "",
          time: "",
          location: "",
          participants: [],
          externalParticipants: [],
          agenda: "",
          actions: [],
        },
        isRecurring: false,
        recurrenceType: "daily",
        recurrenceWeekdays: [],
        recurrenceEndDate: "",
      });
      setParticipantInput("");
      setExternalParticipantInput("");
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

  const [sortBy, setSortBy] = useState<"priority" | "date" | "custom">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isAreasSidebarOpen, setIsAreasSidebarOpen] = useState(false);

  const priorityOrder = { high: 0, medium: 1, low: 2 };

  // Filter for open tasks (todo + doing) for counters
  const openTasksOnly = useMemo(() => {
    return tasks.filter(task => 
      task.type !== "meeting_note" && 
      (task.status === "todo" || task.status === "doing")
    );
  }, [tasks]);

  const tasksOnly = useMemo(() => {
    return tasks.filter(task => task.type !== "meeting_note");
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasksOnly.filter(task => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Default filter for main screen: only todo and doing
      if (statusFilter === "all") {
        return task.status === "todo" || task.status === "doing";
      }

      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== "all" && task.type !== typeFilter) {
        return false;
      }
      return true;
    });

    if (sortBy === "priority") {
      result = [...result].sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
        
        let comparison = 0;
        if (priorityA !== priorityB) {
          comparison = priorityA - priorityB;
        } else if (a.dueDate && b.dueDate) {
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        } else if (a.dueDate) {
          comparison = -1;
        } else if (b.dueDate) {
          comparison = 1;
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
    } else if (sortBy === "date") {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        if (a.dueDate && b.dueDate) {
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        } else if (a.dueDate) {
          comparison = -1;
        } else if (b.dueDate) {
          comparison = 1;
        } else {
          const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
          const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
          comparison = priorityA - priorityB;
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
    } else {
      result = [...result].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return result;
  }, [tasksOnly, searchQuery, statusFilter, typeFilter, sortBy, sortOrder]);

  const selectedArea = areas.find(a => a.id === selectedAreaId);

  const handleOpenAreaDialog = async (area?: TaskArea) => {
    if (area) {
      setEditingArea(area);
      // Fetch current members when editing
      try {
        const response = await fetch(`/api/task-tags/${area.id}/members`);
        if (response.ok) {
          const members = await response.json();
          setNewArea({
            name: area.name,
            description: area.description || "",
            visibility: area.visibility as "private" | "shared",
            color: area.color || "#00A137",
            ownerId: area.ownerId,
            memberIds: members.map((m: any) => m.userId),
            scope: "tasks",
          });
        }
      } catch (error) {
        console.error("Error fetching area members:", error);
        setNewArea({
          name: area.name,
          description: area.description || "",
          visibility: area.visibility as "private" | "shared",
          color: area.color || "#00A137",
          ownerId: area.ownerId,
          memberIds: [],
          scope: "tasks",
        });
      }
    } else {
      setEditingArea(null);
      setNewArea({ name: "", description: "", visibility: "private", color: "#00A137", ownerId: currentUserId, memberIds: [], scope: "tasks" });
    }
    setMemberSearchInput("");
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
      title: "",
      description: "",
      type,
      status: "todo",
      priority: "medium",
      areaId: selectedAreaId || (areas[0]?.id || ""),
      createdBy: currentUserId,
      assigneeId: "",
      assigneeIds: [],
      dueDate: "",
      meetingData: {
        date: "",
        time: "",
        location: "",
        participants: [],
        externalParticipants: [],
        agenda: "",
        actions: [],
      },
      isRecurring: false,
      recurrenceType: "daily",
      recurrenceWeekdays: [],
      recurrenceEndDate: "",
    });
    setParticipantInput("");
    setExternalParticipantInput("");
    setShowTaskDialog(true);
  };

  const handleOpenNormalTaskDialog = () => handleOpenTaskDialog("task");

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || sortBy !== "custom") return;

    // Only allow reordering within the same area if an area is selected, 
    // or across all tasks if "Todas as Tarefas" is selected.
    // The current filteredTasks already handles the view filtering.
    const items = Array.from(filteredTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Optimistic update
    queryClient.setQueryData(["/api/tasks", selectedAreaId], items);
    
    // Persist new order
    const reorderUpdates = items.map((task: any, index: number) => ({
      id: task.id,
      order: index
    }));
    
    apiRequest("PATCH", "/api/tasks/reorder", { updates: reorderUpdates })
      .catch((error) => {
        console.error("Failed to reorder tasks:", error);
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      });
  };

  return (
    <div className="flex h-full">
      {/* Áreas Sidebar (Left) */}
      {isAreasSidebarOpen && (
        <div
          ref={sidebarRef}
          className="border-r border-border bg-muted/30 flex flex-col animate-in slide-in-from-left duration-200 relative select-none"
          style={{ width: sidebarWidth, minWidth: 180, maxWidth: 480 }}
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Tags
            </h2>
            <div className="flex items-center gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6"
                onClick={() => handleOpenAreaDialog()}
                data-testid="button-new-area"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6"
                onClick={() => setIsAreasSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
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
                {globalTasks.filter(t => t.status === "todo" || t.status === "doing").length}
              </Badge>
            </button>

            <div className="mt-4 space-y-1">
              {areasLoading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Carregando...</div>
              ) : (
                areas.map((area) => {
                  const areaTaskCount = globalTasks.filter(t => 
                    t.tagId === area.id && (t.status === "todo" || t.status === "doing")
                  ).length;
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
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
            onMouseDown={handleSidebarMouseDown}
            data-testid="sidebar-resize-handle"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <PageHeader
          title={selectedArea ? selectedArea.name : "Todas as Tarefas"}
          actions={
            <div className="flex items-center gap-2">
              {!isAreasSidebarOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAreasSidebarOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4" />
                  <span>Tags</span>
                </Button>
              )}
              <Button onClick={handleOpenNormalTaskDialog} data-testid="button-new-task">
                <Plus className="h-4 w-4 mr-2" />
                Nova Tarefa
              </Button>
            </div>
          }
        />

        <div className="p-6 flex-1 overflow-auto">
          <Card className="shadow-sm border-border/60 p-6 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
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
                  <SelectItem value="all">Em Aberto</SelectItem>
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="doing">Em Andamento</SelectItem>
                  <SelectItem value="done">Concluídas</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "priority" | "date" | "custom")}>
                  <SelectTrigger className="w-40" data-testid="select-sort-by">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Por Prioridade</SelectItem>
                    <SelectItem value="date">Por Data</SelectItem>
                    <SelectItem value="custom">Ordem Manual</SelectItem>
                  </SelectContent>
                </Select>

                {sortBy !== "custom" && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    title={sortOrder === "asc" ? "Crescente" : "Decrescente"}
                  >
                    {sortOrder === "asc" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/></svg>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex items-center border rounded-md p-1 bg-muted/50 ml-auto">
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

          <div className="mb-6 p-4 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer group" onClick={handleOpenNormalTaskDialog}>
            <div className="flex items-center justify-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
              <Plus className="h-5 w-5" />
              <span className="font-medium text-sm">+ Adicionar nova tarefa</span>
            </div>
          </div>

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
                <Button onClick={handleOpenNormalTaskDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </Button>
              )}
            </Card>
          ) : viewMode === "kanban" ? (
            <TaskKanban tasks={filteredTasks} areas={areas} />
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="tasks-list">
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={viewMode === "grid" ? "space-y-2" : "border rounded-md divide-y"}
                  >
                    {filteredTasks.map((task, index) => {
                      const status = statusConfig[task.status as keyof typeof statusConfig];
                      const priority = priorityConfig[task.priority as keyof typeof priorityConfig];
                      const taskType = typeConfig[task.type as keyof typeof typeConfig];
                      const taskArea = areas.find(a => a.id === task.tagId);
                      const StatusIcon = status?.icon || Circle;
                      const TypeIcon = taskType?.icon || CheckCircle2;

                      return (
                        <Draggable 
                          key={task.id} 
                          draggableId={task.id} 
                          index={index}
                          isDragDisabled={sortBy !== "custom"}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? "z-50 opacity-90 shadow-2xl" : ""}
                            >
                              {viewMode === "list" ? (
                                <div
                                  className="flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                  onClick={() => navigate(`/tarefas/${task.id}`)}
                                  data-testid={`list-item-task-${task.id}`}
                                >
                                  {sortBy === "custom" && (
                                    <div {...provided.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                  )}
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
                              ) : (
                                <Card 
                                  className="p-4 hover-elevate cursor-pointer relative"
                                  onClick={() => navigate(`/tarefas/${task.id}`)}
                                  data-testid={`card-task-${task.id}`}
                                >
                                  <div className="flex items-start gap-4">
                                    {sortBy === "custom" && (
                                      <div {...provided.dragHandleProps} className="mt-1.5 text-muted-foreground cursor-grab active:cursor-grabbing">
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                    )}
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
                                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
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
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </div>

      <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? "Editar Tag" : "Nova Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newArea.name}
                onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                placeholder="Nome da tag"
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
            {newArea.visibility === "shared" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Compartilhar com</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {newArea.memberIds.map((userId) => {
                    const user = users.find(u => u.id === userId);
                    return (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {user?.name || userId}
                        <button
                          type="button"
                          onClick={() => setNewArea({
                            ...newArea,
                            memberIds: newArea.memberIds.filter(id => id !== userId)
                          })}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <div className="relative">
                  <Input
                    value={memberSearchInput}
                    onChange={(e) => setMemberSearchInput(e.target.value)}
                    placeholder="Buscar usuário para adicionar..."
                    data-testid="input-member-search"
                  />
                  {memberSearchInput && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {users
                        .filter(u => 
                          !newArea.memberIds.includes(u.id) &&
                          (u.name.toLowerCase().includes(memberSearchInput.toLowerCase()) ||
                           u.email.toLowerCase().includes(memberSearchInput.toLowerCase()))
                        )
                        .slice(0, 5)
                        .map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                            onClick={() => {
                              setNewArea({
                                ...newArea,
                                memberIds: [...newArea.memberIds, user.id]
                              });
                              setMemberSearchInput("");
                            }}
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{user.name}</span>
                            <span className="text-muted-foreground text-xs">({user.email})</span>
                          </button>
                        ))}
                      {users.filter(u => 
                        !newArea.memberIds.includes(u.id) &&
                        u.name.toLowerCase().includes(memberSearchInput.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Os usuários selecionados receberão um email de notificação e poderão acessar as tarefas desta tag.
                </p>
              </div>
            )}
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
              {editingArea ? "Salvar" : "Criar Tag"}
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
              <label className="text-sm font-medium">Tag</label>
              <Select 
                value={newTask.areaId} 
                onValueChange={(v) => setNewTask({ ...newTask, areaId: v })}
              >
                <SelectTrigger data-testid="select-task-area">
                  <SelectValue placeholder="Selecione uma tag (opcional)" />
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
                  <RichTextarea
                    value={newTask.description}
                    onChange={(v) => setNewTask({ ...newTask, description: v })}
                    images={(newTask as any).attachments ? JSON.parse((newTask as any).attachments) : []}
                    onImagesChange={(imgs) => setNewTask({ ...newTask, attachments: JSON.stringify(imgs) } as any)}
                    placeholder="Detalhes da tarefa..."
                    rows={4}
                    maxLength={5000}
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
                      className="date-picker-full"
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
                      className="date-picker-full"
                      value={newTask.meetingData.date}
                      onChange={(e) => setNewTask({ 
                        ...newTask, 
                        meetingData: { ...newTask.meetingData, date: e.target.value } 
                      })}
                      data-testid="input-meeting-date"
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
                      data-testid="input-meeting-time"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="recurring-toggle" className="text-sm font-medium cursor-pointer">
                      Repetir
                    </Label>
                  </div>
                  <Switch
                    id="recurring-toggle"
                    checked={newTask.isRecurring}
                    onCheckedChange={(checked) => setNewTask({ ...newTask, isRecurring: checked })}
                    data-testid="switch-recurring"
                  />
                </div>

                {newTask.isRecurring && (
                  <div className="space-y-3 p-3 border rounded-lg bg-background">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="recurrence"
                          value="daily"
                          checked={newTask.recurrenceType === "daily"}
                          onChange={() => setNewTask({ ...newTask, recurrenceType: "daily", recurrenceWeekdays: [] })}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-sm">Diária</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="recurrence"
                          value="weekly"
                          checked={newTask.recurrenceType === "weekly"}
                          onChange={() => setNewTask({ ...newTask, recurrenceType: "weekly" })}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-sm">Semanal</span>
                      </label>
                    </div>

                    {newTask.recurrenceType === "weekly" && (
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 0, label: "Dom" },
                          { value: 1, label: "Seg" },
                          { value: 2, label: "Ter" },
                          { value: 3, label: "Qua" },
                          { value: 4, label: "Qui" },
                          { value: 5, label: "Sex" },
                          { value: 6, label: "Sáb" },
                        ].map((day) => (
                          <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={newTask.recurrenceWeekdays.includes(day.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewTask({ 
                                    ...newTask, 
                                    recurrenceWeekdays: [...newTask.recurrenceWeekdays, day.value].sort()
                                  });
                                } else {
                                  setNewTask({ 
                                    ...newTask, 
                                    recurrenceWeekdays: newTask.recurrenceWeekdays.filter(d => d !== day.value)
                                  });
                                }
                              }}
                            />
                            <span className="text-sm">{day.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Repetir até (opcional)</label>
                      <Input
                        type="date"
                        className="date-picker-full"
                        value={newTask.recurrenceEndDate}
                        onChange={(e) => setNewTask({ ...newTask, recurrenceEndDate: e.target.value })}
                        data-testid="input-recurrence-end"
                      />
                    </div>

                    {newTask.meetingData.time && (
                      <p className="text-xs text-muted-foreground bg-primary/10 p-2 rounded">
                        {newTask.recurrenceType === "daily" 
                          ? `Repete todos os dias às ${newTask.meetingData.time}`
                          : newTask.recurrenceWeekdays.length > 0
                            ? `Repete às ${newTask.meetingData.time} em: ${newTask.recurrenceWeekdays.map(d => 
                                ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d]
                              ).join(", ")}`
                            : "Selecione os dias da semana"
                        }
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Local</label>
                  <Input
                    value={newTask.meetingData.location}
                    onChange={(e) => setNewTask({ 
                      ...newTask, 
                      meetingData: { ...newTask.meetingData, location: e.target.value } 
                    })}
                    placeholder="Local da reunião"
                    data-testid="input-meeting-location"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Participantes do Sistema</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {newTask.meetingData.participants.map((userId) => {
                      const user = users.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="gap-1">
                          {user?.name || userId}
                          <button
                            type="button"
                            onClick={() => setNewTask({
                              ...newTask,
                              meetingData: {
                                ...newTask.meetingData,
                                participants: newTask.meetingData.participants.filter(p => p !== userId)
                              }
                            })}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <Input
                      value={participantInput}
                      onChange={(e) => setParticipantInput(e.target.value)}
                      placeholder="Buscar usuário por nome ou email..."
                      data-testid="input-participant-search"
                    />
                    {participantInput && filteredUsers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredUsers
                          .filter(u => !newTask.meetingData.participants.includes(u.id))
                          .slice(0, 5)
                          .map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                              onClick={() => {
                                setNewTask({
                                  ...newTask,
                                  meetingData: {
                                    ...newTask.meetingData,
                                    participants: [...newTask.meetingData.participants, user.id]
                                  }
                                });
                                setParticipantInput("");
                              }}
                            >
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{user.name}</span>
                              <span className="text-muted-foreground text-xs">({user.email})</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Participantes Externos (emails)</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {newTask.meetingData.externalParticipants.map((email, idx) => (
                      <Badge key={idx} variant="outline" className="gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => setNewTask({
                            ...newTask,
                            meetingData: {
                              ...newTask.meetingData,
                              externalParticipants: newTask.meetingData.externalParticipants.filter((_, i) => i !== idx)
                            }
                          })}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={externalParticipantInput}
                      onChange={(e) => setExternalParticipantInput(e.target.value)}
                      placeholder="email@exemplo.com"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && externalParticipantInput.includes("@")) {
                          e.preventDefault();
                          setNewTask({
                            ...newTask,
                            meetingData: {
                              ...newTask.meetingData,
                              externalParticipants: [...newTask.meetingData.externalParticipants, externalParticipantInput]
                            }
                          });
                          setExternalParticipantInput("");
                        }
                      }}
                      data-testid="input-external-participant"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (externalParticipantInput.includes("@")) {
                          setNewTask({
                            ...newTask,
                            meetingData: {
                              ...newTask.meetingData,
                              externalParticipants: [...newTask.meetingData.externalParticipants, externalParticipantInput]
                            }
                          });
                          setExternalParticipantInput("");
                        }
                      }}
                      disabled={!externalParticipantInput.includes("@")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Pauta</label>
                  <RichTextarea
                    value={newTask.meetingData.agenda}
                    onChange={(v) => setNewTask({ 
                      ...newTask, 
                      meetingData: { 
                        ...newTask.meetingData, 
                        agenda: v
                      } 
                    })}
                    images={(newTask.meetingData as any).agendaImages || []}
                    onImagesChange={(imgs) => setNewTask({
                      ...newTask,
                      meetingData: {
                        ...newTask.meetingData,
                        agendaImages: imgs
                      } as any
                    })}
                    placeholder="Descreva a pauta da reunião..."
                    rows={6}
                    maxLength={5000}
                    data-testid="input-meeting-agenda"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ações (opcional)</label>
                  <div className="space-y-3">
                    {newTask.meetingData.actions.map((action, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                        <div className="flex-1 space-y-2">
                          <Input
                            value={action.description}
                            onChange={(e) => {
                              const newActions = [...newTask.meetingData.actions];
                              newActions[index] = { ...action, description: e.target.value };
                              setNewTask({
                                ...newTask,
                                meetingData: { ...newTask.meetingData, actions: newActions }
                              });
                            }}
                            placeholder="Descrição da ação *"
                            data-testid={`input-action-description-${index}`}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <Input
                                value={action.responsible}
                                onChange={(e) => {
                                  const newActions = [...newTask.meetingData.actions];
                                  newActions[index] = { ...action, responsible: e.target.value };
                                  setNewTask({
                                    ...newTask,
                                    meetingData: { ...newTask.meetingData, actions: newActions }
                                  });
                                }}
                                placeholder="Responsável"
                                list={`action-responsible-${index}`}
                                data-testid={`input-action-responsible-${index}`}
                              />
                              <datalist id={`action-responsible-${index}`}>
                                {users.map(u => (
                                  <option key={u.id} value={u.name} />
                                ))}
                              </datalist>
                            </div>
                            <Input
                              type="date"
                              className="date-picker-full"
                              value={action.deadline}
                              onChange={(e) => {
                                const newActions = [...newTask.meetingData.actions];
                                newActions[index] = { ...action, deadline: e.target.value };
                                setNewTask({
                                  ...newTask,
                                  meetingData: { ...newTask.meetingData, actions: newActions }
                                });
                              }}
                              min={newTask.meetingData.date || undefined}
                              data-testid={`input-action-deadline-${index}`}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            const newActions = newTask.meetingData.actions.filter((_, i) => i !== index);
                            setNewTask({
                              ...newTask,
                              meetingData: { ...newTask.meetingData, actions: newActions }
                            });
                          }}
                          data-testid={`button-remove-action-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewTask({
                          ...newTask,
                          meetingData: {
                            ...newTask.meetingData,
                            actions: [...newTask.meetingData.actions, { description: "", responsible: "", deadline: "" }]
                          }
                        });
                      }}
                      data-testid="button-add-action"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Ação
                    </Button>
                  </div>
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
              disabled={!newTask.title || createTaskMutation.isPending}
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
