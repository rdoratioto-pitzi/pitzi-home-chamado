import { useState, useMemo } from "react";
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
import { Plus, Folder, Users, User, Search, Filter, MoreHorizontal, Calendar, CheckCircle2, Circle, Clock, Archive, FileText, Trash2, Edit, LayoutGrid, List, Repeat, X, Video, Globe } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { RichTextarea } from "@/components/rich-textarea";
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

const statusConfig = {
  todo: { label: "Agendada", icon: Circle, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  doing: { label: "Em Andamento", icon: Clock, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  done: { label: "Concluída", icon: CheckCircle2, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  archived: { label: "Arquivada", icon: Archive, color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

const priorityConfig = {
  low: { label: "Baixa", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  high: { label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export default function ReunioesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [editingArea, setEditingArea] = useState<TaskArea | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || "";

  const [newArea, setNewArea] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "shared" | "public",
    color: "#00A137",
    ownerId: currentUserId,
    memberIds: [] as string[],
    scope: "meetings" as string,
  });
  const [memberSearchInput, setMemberSearchInput] = useState("");

  const [newMeeting, setNewMeeting] = useState({
    title: "",
    description: "",
    type: "meeting_note" as const,
    status: "todo",
    priority: "medium",
    areaId: "",
    createdBy: currentUserId,
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

  const [agendaImages, setAgendaImages] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [externalParticipantInput, setExternalParticipantInput] = useState("");

  const { data: areas = [], isLoading: areasLoading } = useQuery<TaskArea[]>({
    queryKey: ["/api/task-tags", "meetings"],
    queryFn: async () => {
      const res = await fetch("/api/task-tags?scope=meetings");
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

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", selectedAreaId],
    queryFn: async () => {
      const url = selectedAreaId 
        ? `/api/tasks?tagId=${selectedAreaId}` 
        : "/api/tasks";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  // Filter only meetings (type === "meeting_note")
  const meetings = useMemo(() => {
    return allTasks.filter(task => task.type === "meeting_note");
  }, [allTasks]);

  const createAreaMutation = useMutation({
    mutationFn: async (data: typeof newArea) => {
      return apiRequest("POST", "/api/task-tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "meetings"] });
      setShowAreaDialog(false);
      setNewArea({ name: "", description: "", visibility: "private" as "private" | "shared" | "public", color: "#00A137", ownerId: currentUserId, memberIds: [], scope: "meetings" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "meetings"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "meetings"] });
      if (selectedAreaId) setSelectedAreaId(null);
      toast({ title: "Tag excluída com sucesso!" });
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: typeof newMeeting) => {
      const meetingDataPayload = {
        ...data.meetingData,
        agenda: data.meetingData.agenda,
        agendaImages: agendaImages,
        participants: data.meetingData.participants,
        externalParticipants: data.meetingData.externalParticipants,
      };
      
      const payload = {
        title: data.title,
        description: data.description || undefined,
        type: "meeting_note",
        status: data.status,
        priority: data.priority,
        tagId: data.areaId || selectedAreaId || undefined,
        createdBy: data.createdBy,
        dueDate: data.meetingData.date || null,
        assigneeId: data.assigneeId || undefined,
        assigneeIds: data.assigneeIds.length > 0 ? JSON.stringify(data.assigneeIds) : undefined,
        meetingData: JSON.stringify(meetingDataPayload),
        isRecurring: data.isRecurring,
        recurrenceType: data.isRecurring ? data.recurrenceType : undefined,
        recurrenceWeekdays: data.isRecurring && data.recurrenceType === "weekly" ? JSON.stringify(data.recurrenceWeekdays) : undefined,
        recurrenceEndDate: data.isRecurring && data.recurrenceEndDate ? data.recurrenceEndDate : undefined,
      };
      return apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      setShowMeetingDialog(false);
      resetMeetingForm();
      toast({ title: "Reunião criada com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Meeting creation error:", error);
      toast({ title: "Erro ao criar reunião", description: error.message, variant: "destructive" });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return apiRequest("PUT", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      toast({ title: "Reunião atualizada!" });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      toast({ title: "Reunião excluída!" });
    },
  });

  const [sortBy, setSortBy] = useState<"priority" | "date">("date");

  const priorityOrder = { high: 0, medium: 1, low: 2 };

  const filteredMeetings = useMemo(() => {
    let result = meetings.filter(meeting => {
      if (searchQuery && !meeting.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter !== "all" && meeting.status !== statusFilter) {
        return false;
      }
      return true;
    });

    if (sortBy === "priority") {
      result = [...result].sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
        if (priorityA !== priorityB) return priorityA - priorityB;
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    } else if (sortBy === "date") {
      result = [...result].sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    }

    return result;
  }, [meetings, searchQuery, statusFilter, sortBy]);

  const selectedArea = areas.find(a => a.id === selectedAreaId);

  const resetMeetingForm = () => {
    setNewMeeting({
      title: "",
      description: "",
      type: "meeting_note",
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
    setAgendaImages([]);
    setParticipantInput("");
    setExternalParticipantInput("");
  };

  const handleOpenAreaDialog = async (area?: TaskArea) => {
    if (area) {
      setEditingArea(area);
      try {
        const response = await fetch(`/api/task-tags/${area.id}/members`);
        if (response.ok) {
          const members = await response.json();
          setNewArea({
            name: area.name,
            description: area.description || "",
            visibility: area.visibility as "private" | "shared" | "public",
            color: area.color || "#00A137",
            ownerId: area.ownerId,
            memberIds: members.map((m: any) => m.userId),
            scope: "meetings",
          });
        }
      } catch (error) {
        console.error("Error fetching area members:", error);
        setNewArea({
          name: area.name,
          description: area.description || "",
          visibility: area.visibility as "private" | "shared" | "public",
          color: area.color || "#00A137",
          ownerId: area.ownerId,
          memberIds: [],
          scope: "meetings",
        });
      }
    } else {
      setEditingArea(null);
      setNewArea({ name: "", description: "", visibility: "private" as "private" | "shared" | "public", color: "#00A137", ownerId: currentUserId, memberIds: [], scope: "meetings" });
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

  const handleOpenMeetingDialog = () => {
    setNewMeeting({
      ...newMeeting,
      areaId: selectedAreaId || (areas[0]?.id || ""),
    });
    setShowMeetingDialog(true);
  };

  const handleAddParticipant = (userId: string) => {
    if (!newMeeting.meetingData.participants.includes(userId)) {
      setNewMeeting({
        ...newMeeting,
        meetingData: {
          ...newMeeting.meetingData,
          participants: [...newMeeting.meetingData.participants, userId],
        },
      });
    }
    setParticipantInput("");
  };

  const handleRemoveParticipant = (userId: string) => {
    setNewMeeting({
      ...newMeeting,
      meetingData: {
        ...newMeeting.meetingData,
        participants: newMeeting.meetingData.participants.filter((p) => p !== userId),
      },
    });
  };

  const handleAddExternalParticipant = () => {
    if (externalParticipantInput && externalParticipantInput.includes("@")) {
      if (!newMeeting.meetingData.externalParticipants.includes(externalParticipantInput)) {
        setNewMeeting({
          ...newMeeting,
          meetingData: {
            ...newMeeting.meetingData,
            externalParticipants: [...newMeeting.meetingData.externalParticipants, externalParticipantInput],
          },
        });
      }
      setExternalParticipantInput("");
    }
  };

  const handleRemoveExternalParticipant = (email: string) => {
    setNewMeeting({
      ...newMeeting,
      meetingData: {
        ...newMeeting.meetingData,
        externalParticipants: newMeeting.meetingData.externalParticipants.filter((p) => p !== email),
      },
    });
  };

  const handleAddAction = () => {
    setNewMeeting({
      ...newMeeting,
      meetingData: {
        ...newMeeting.meetingData,
        actions: [...newMeeting.meetingData.actions, { description: "", responsible: "", deadline: "" }],
      },
    });
  };

  const handleUpdateAction = (index: number, field: string, value: string) => {
    const newActions = [...newMeeting.meetingData.actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setNewMeeting({
      ...newMeeting,
      meetingData: {
        ...newMeeting.meetingData,
        actions: newActions,
      },
    });
  };

  const handleRemoveAction = (index: number) => {
    setNewMeeting({
      ...newMeeting,
      meetingData: {
        ...newMeeting.meetingData,
        actions: newMeeting.meetingData.actions.filter((_, i) => i !== index),
      },
    });
  };

  const weekdays = [
    { value: 0, label: "Dom" },
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" },
  ];

  const getMeetingData = (meeting: Task) => {
    try {
      return meeting.meetingData ? JSON.parse(meeting.meetingData) : {};
    } catch {
      return {};
    }
  };

  if (areasLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Areas */}
      <div className="w-56 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Tags</span>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6"
            onClick={() => handleOpenAreaDialog()}
            data-testid="button-add-area"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 mb-1 ${
              !selectedAreaId ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
            }`}
            onClick={() => setSelectedAreaId(null)}
            data-testid="button-all-meetings"
          >
            <Folder className="h-4 w-4" />
            Todas as Reuniões
            <Badge variant="secondary" className="ml-auto text-xs">
              {meetings.length}
            </Badge>
          </button>
          {areas.map((area) => {
            const areaCount = meetings.filter(m => m.tagId === area.id).length;
            return (
              <div
                key={area.id}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 mb-1 group cursor-pointer ${
                  selectedAreaId === area.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
                onClick={() => setSelectedAreaId(area.id)}
                data-testid={`button-area-${area.id}`}
              >
                <div 
                  className="h-3 w-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: area.color || "#00A137" }}
                />
                {area.visibility === "public" ? (
                  <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : area.visibility === "shared" ? (
                  <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate flex-1">{area.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {areaCount}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAreaDialog(area);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAreaMutation.mutate(area.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader 
          title={selectedArea ? selectedArea.name : "Todas as Reuniões"}
          description={selectedArea?.description || "Gerencie suas reuniões e anotações"}
          actions={
            <Button onClick={handleOpenMeetingDialog} data-testid="button-new-meeting">
              <Plus className="h-4 w-4 mr-2" />
              Nova Reunião
            </Button>
          }
        />

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar reuniões..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-meetings"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="todo">Agendada</SelectItem>
              <SelectItem value="doing">Em Andamento</SelectItem>
              <SelectItem value="done">Concluída</SelectItem>
              <SelectItem value="archived">Arquivada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "priority" | "date")}>
            <SelectTrigger className="w-36" data-testid="select-sort-by">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Por Data</SelectItem>
              <SelectItem value="priority">Por Prioridade</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-auto">
            <Button 
              size="icon" 
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Meetings List */}
        <div className="flex-1 overflow-y-auto p-6">
          {tasksLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Carregando reuniões...</div>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma reunião encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Crie sua primeira reunião clicando no botão acima"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={handleOpenMeetingDialog} data-testid="button-create-first-meeting">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Reunião
                </Button>
              )}
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
              {filteredMeetings.map((meeting) => {
                const status = statusConfig[meeting.status as keyof typeof statusConfig];
                const priority = priorityConfig[meeting.priority as keyof typeof priorityConfig];
                const StatusIcon = status?.icon || Circle;
                const meetingArea = areas.find(a => a.id === meeting.tagId);
                const meetingData = getMeetingData(meeting);

                if (viewMode === "list") {
                  return (
                    <div 
                      key={meeting.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/reunioes/${meeting.id}`)}
                      data-testid={`row-meeting-${meeting.id}`}
                    >
                      <button
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = meeting.status === "todo" ? "doing" : meeting.status === "doing" ? "done" : "todo";
                          updateMeetingMutation.mutate({ id: meeting.id, data: { status: nextStatus } });
                        }}
                        data-testid={`button-toggle-status-${meeting.id}`}
                      >
                        <StatusIcon className={`h-5 w-5 ${
                          meeting.status === "done" ? "text-green-500" : 
                          meeting.status === "doing" ? "text-blue-500" : "text-gray-400"
                        }`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-muted-foreground" />
                          <h3 className={`font-medium truncate ${meeting.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {meeting.title}
                          </h3>
                        </div>
                      </div>
                      {meetingArea && !selectedAreaId && (
                        <Badge variant="secondary" className="text-xs">
                          <div 
                            className="h-2 w-2 rounded-full mr-1" 
                            style={{ backgroundColor: meetingArea.color || "#00A137" }}
                          />
                          {meetingArea.name}
                        </Badge>
                      )}
                      <Badge className={`text-xs ${priority?.color}`}>
                        {priority?.label}
                      </Badge>
                      {meetingData.date && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(meetingData.date).toLocaleDateString("pt-BR")}
                        </Badge>
                      )}
                      {meetingData.time && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {meetingData.time}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-meeting-menu-${meeting.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reunioes/${meeting.id}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => {
                            e.stopPropagation();
                            deleteMeetingMutation.mutate(meeting.id);
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                }

                return (
                  <Card 
                    key={meeting.id}
                    className="p-4 hover-elevate cursor-pointer"
                    onClick={() => navigate(`/reunioes/${meeting.id}`)}
                    data-testid={`card-meeting-${meeting.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        className="mt-1 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = meeting.status === "todo" ? "doing" : meeting.status === "doing" ? "done" : "todo";
                          updateMeetingMutation.mutate({ id: meeting.id, data: { status: nextStatus } });
                        }}
                        data-testid={`button-toggle-status-${meeting.id}`}
                      >
                        <StatusIcon className={`h-5 w-5 ${
                          meeting.status === "done" ? "text-green-500" : 
                          meeting.status === "doing" ? "text-blue-500" : "text-gray-400"
                        }`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${meeting.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {meeting.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            <Video className="h-3 w-3 mr-1" />
                            Reunião
                          </Badge>
                        </div>
                        {meetingData.location && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {meetingData.location}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {meetingArea && !selectedAreaId && (
                            <Badge variant="secondary" className="text-xs">
                              <div 
                                className="h-2 w-2 rounded-full mr-1" 
                                style={{ backgroundColor: meetingArea.color || "#00A137" }}
                              />
                              {meetingArea.name}
                            </Badge>
                          )}
                          <Badge className={`text-xs ${priority?.color}`}>
                            {priority?.label}
                          </Badge>
                          {meetingData.date && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(meetingData.date).toLocaleDateString("pt-BR")}
                            </Badge>
                          )}
                          {meetingData.time && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {meetingData.time}
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
                            data-testid={`button-meeting-menu-${meeting.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reunioes/${meeting.id}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMeetingMutation.mutate(meeting.id);
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

      {/* Area Dialog */}
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
                onValueChange={(v) => setNewArea({ ...newArea, visibility: v as "private" | "shared" | "public" })}
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
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Pública
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

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Reunião</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                placeholder="Título da reunião"
                data-testid="input-meeting-title"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tag</label>
              <Select 
                value={newMeeting.areaId} 
                onValueChange={(v) => setNewMeeting({ ...newMeeting, areaId: v })}
              >
                <SelectTrigger data-testid="select-meeting-area">
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

            {/* Meeting specific fields */}
            <div className="space-y-4 border-t pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data</label>
                  <Input
                    type="date"
                    className="date-picker-full"
                    value={newMeeting.meetingData.date}
                    onChange={(e) => setNewMeeting({ 
                      ...newMeeting, 
                      meetingData: { ...newMeeting.meetingData, date: e.target.value } 
                    })}
                    data-testid="input-meeting-date"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Horário</label>
                  <Input
                    type="time"
                    value={newMeeting.meetingData.time}
                    onChange={(e) => setNewMeeting({ 
                      ...newMeeting, 
                      meetingData: { ...newMeeting.meetingData, time: e.target.value } 
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
                  checked={newMeeting.isRecurring}
                  onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, isRecurring: checked })}
                  data-testid="switch-recurring"
                />
              </div>

              {newMeeting.isRecurring && (
                <div className="space-y-3 p-3 border rounded-lg bg-background">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrence"
                        value="daily"
                        checked={newMeeting.recurrenceType === "daily"}
                        onChange={() => setNewMeeting({ ...newMeeting, recurrenceType: "daily", recurrenceWeekdays: [] })}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm">Diária</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recurrence"
                        value="weekly"
                        checked={newMeeting.recurrenceType === "weekly"}
                        onChange={() => setNewMeeting({ ...newMeeting, recurrenceType: "weekly" })}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm">Semanal</span>
                    </label>
                  </div>

                  {newMeeting.recurrenceType === "weekly" && (
                    <div className="flex flex-wrap gap-2">
                      {weekdays.map((day) => (
                        <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={newMeeting.recurrenceWeekdays.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewMeeting({
                                  ...newMeeting,
                                  recurrenceWeekdays: [...newMeeting.recurrenceWeekdays, day.value].sort()
                                });
                              } else {
                                setNewMeeting({
                                  ...newMeeting,
                                  recurrenceWeekdays: newMeeting.recurrenceWeekdays.filter(d => d !== day.value)
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
                    <label className="text-sm font-medium">Terminar em (opcional)</label>
                    <Input
                      type="date"
                      className="date-picker-full"
                      value={newMeeting.recurrenceEndDate}
                      onChange={(e) => setNewMeeting({ ...newMeeting, recurrenceEndDate: e.target.value })}
                      data-testid="input-recurrence-end-date"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Local</label>
                <Input
                  value={newMeeting.meetingData.location}
                  onChange={(e) => setNewMeeting({ 
                    ...newMeeting, 
                    meetingData: { ...newMeeting.meetingData, location: e.target.value } 
                  })}
                  placeholder="Ex: Sala de reunião, Teams, Zoom"
                  data-testid="input-meeting-location"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Participantes (do sistema)</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {newMeeting.meetingData.participants.map((userId) => {
                    const user = users.find((u) => u.id === userId);
                    return (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {user?.name || userId}
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(userId)}
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
                    placeholder="Buscar participante..."
                    data-testid="input-participant-search"
                  />
                  {participantInput && filteredUsers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredUsers
                        .filter((u) => !newMeeting.meetingData.participants.includes(u.id))
                        .slice(0, 5)
                        .map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                            onClick={() => handleAddParticipant(user.id)}
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
                <label className="text-sm font-medium">Participantes externos (email)</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {newMeeting.meetingData.externalParticipants.map((email) => (
                    <Badge key={email} variant="outline" className="gap-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveExternalParticipant(email)}
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
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddExternalParticipant();
                      }
                    }}
                    data-testid="input-external-participant"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddExternalParticipant}
                    data-testid="button-add-external"
                  >
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium">Pauta <span className="text-destructive">*</span></label>
                <RichTextarea
                  value={newMeeting.meetingData.agenda}
                  onChange={(v) => setNewMeeting({ 
                    ...newMeeting, 
                    meetingData: { ...newMeeting.meetingData, agenda: v } 
                  })}
                  images={agendaImages}
                  onImagesChange={setAgendaImages}
                  placeholder="Tópicos a serem discutidos..."
                  maxLength={5000}
                  rows={5}
                  data-testid="input-meeting-agenda"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Ações</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAction}
                    data-testid="button-add-action"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Ação
                  </Button>
                </div>
                {newMeeting.meetingData.actions.map((action, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-muted/30">
                    <div className="col-span-5">
                      <Input
                        value={action.description}
                        onChange={(e) => handleUpdateAction(index, "description", e.target.value)}
                        placeholder="Descrição da ação"
                        data-testid={`input-action-description-${index}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={action.responsible}
                        onChange={(e) => handleUpdateAction(index, "responsible", e.target.value)}
                        placeholder="Responsável"
                        data-testid={`input-action-responsible-${index}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="date"
                        className="date-picker-full"
                        value={action.deadline}
                        onChange={(e) => handleUpdateAction(index, "deadline", e.target.value)}
                        data-testid={`input-action-deadline-${index}`}
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveAction(index)}
                        data-testid={`button-remove-action-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMeetingMutation.mutate(newMeeting)}
              disabled={!newMeeting.title || createMeetingMutation.isPending}
              data-testid="button-save-meeting"
            >
              Criar Reunião
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
