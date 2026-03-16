import { useState, useMemo, useCallback } from "react";
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
import { DataTable } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { Plus, Folder, Users, User, Search, Filter, MoreHorizontal, Calendar, CheckCircle2, Circle, Clock, Archive, FileText, Trash2, Edit, LayoutGrid, List, Repeat, X, Video, Globe, MonitorPlay, ChevronLeft, ChevronRight, XCircle, GripVertical, Star, Table, Tag, Copy, ArrowLeft, Flag } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { User as UserType } from "@shared/schema";
import { RichTextarea } from "@/components/rich-textarea";
import { RichContent } from "@/components/rich-content";
import DOMPurify from "dompurify";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { TaskArea, Task } from "@shared/schema";

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

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
  const [viewMode, setViewMode] = useState<"table" | "grid" | "list">("table");
  const [showTagsSidebar, setShowTagsSidebar] = useState(true);

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
    recurrenceCreateLeadDays: 1 as number, // dias de antecedência para criar instâncias recorrentes
    templateId: "" as string, // template de origem (se aplicado)
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

  // Templates query for meeting templates
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/task-templates", "meeting"],
    queryFn: async () => {
      const res = await fetch("/api/task-templates?type=meeting");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const filteredUsers = useMemo(() => {
    const activeUsers = users.filter(u => u.status === "active");
    if (!participantInput) return activeUsers;
    const search = participantInput.toLowerCase();
    return activeUsers.filter(u =>
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }, [users, participantInput]);

  const { data: allMeetings = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", "meetings", "all"],
    queryFn: async () => {
      // Filtrar apenas reuniões (type=meeting_note)
      const res = await fetch("/api/tasks?type=meeting_note");
      if (!res.ok) throw new Error("Failed to fetch meetings");
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds for shared meetings
  });

  const { data: meetings = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", selectedAreaId, "meetings"],
    queryFn: async () => {
      // Filtrar apenas reuniões (type=meeting_note)
      const url = selectedAreaId
        ? `/api/tasks?tagId=${selectedAreaId}&type=meeting_note`
        : "/api/tasks?type=meeting_note";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch meetings");
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds for shared meetings
  });

  // Definição das colunas da tabela de reuniões
  // Colunas removidas: Responsável, Status, Local
  const meetingTableColumns = useMemo(() => [
    {
      key: 'title',
      label: 'Nome da Reunião',
      render: (value: string) => (
        <div className="font-medium">
          {value}
        </div>
      )
    },
    {
      key: 'meetingData',
      label: 'Data',
      className: 'w-[120px]',
      render: (value: any, row: Task) => {
        const meetingData = row.meetingData ? JSON.parse(row.meetingData as string) : {};
        const date = meetingData?.date || row.dueDate;
        return date ? new Date(date).toLocaleDateString('pt-BR') : '-';
      }
    },
    {
      key: 'meetingData',
      label: 'Horário',
      className: 'w-[100px]',
      render: (value: any, row: Task) => {
        const meetingData = row.meetingData ? JSON.parse(row.meetingData as string) : {};
        return meetingData?.time || '-';
      }
    },
    {
      key: 'assigneeIds',
      label: 'Participantes',
      className: 'w-[150px]',
      render: (value: string[], row: Task) => {
        // Parse meetingData to get participants
        const meetingData = row.meetingData ? JSON.parse(row.meetingData as string) : {};
        const participantIds = meetingData?.participants || [];
        const externalParticipants = meetingData?.externalParticipants || [];
        
        if (participantIds.length === 0 && externalParticipants.length === 0) return '-';
        
        // Get names of internal participants
        const participantNames = participantIds
          .map((id: string) => {
            const user = users?.find(u => u.id === id);
            return user?.name;
          })
          .filter(Boolean);
        
        // Combine with external participants
        const allParticipants = [...participantNames, ...externalParticipants];
        
        if (allParticipants.length === 0) return '-';
        if (allParticipants.length === 1) return allParticipants[0];
        
        return (
          <Popover>
            <PopoverTrigger className="text-primary hover:underline cursor-pointer text-sm">
              +{allParticipants.length} pessoas
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="text-sm font-medium mb-2">Participantes</div>
              <ul className="text-sm space-y-1">
                {allParticipants.map((name: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    {name}
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        );
      }
    },
    {
      key: 'tagId',
      label: 'Tag',
      className: 'w-[120px]',
      render: (value: string) => {
        const area = areas?.find(a => a.id === value);
        return area ? (
          <Badge
            variant="secondary"
            className="gap-1"
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: area.color || "#00A137" }}
            />
            {area.name}
          </Badge>
        ) : '-';
      }
    },
    {
      key: 'recurrence',
      label: 'Recorrência',
      className: 'w-[120px]',
      render: (value: any, row: Task) => {
        if (row.isRecurring) {
          const recurrenceType = row.recurrenceType === 'weekly' ? 'Semanal' : 'Diária';
          return `🔄 ${recurrenceType}`;
        }
        return '-';
      }
    }
  ], [users, areas]);

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
      console.error("[createAreaMutation] Area creation error:", error);
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

  // Mutation para definir tag como padrão
  const setDefaultTagMutation = useMutation({
    mutationFn: async ({ id, isDefault }: { id: string; isDefault: boolean }) => {
      if (isDefault) {
        return apiRequest("DELETE", `/api/task-tags/${id}/set-default`);
      } else {
        return apiRequest("POST", `/api/task-tags/${id}/set-default`, { scope: "meetings" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "meetings"] });
      toast({ title: "Tag padrão atualizada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar tag padrão", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para reordenar tags
  const reorderTagsMutation = useMutation({
    mutationFn: async (tagIds: string[]) => {
      return apiRequest("POST", "/api/task-tags/reorder", { tagIds, scope: "meetings" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-tags", "meetings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao reordenar tags", description: error.message, variant: "destructive" });
    },
  });

  // Query para buscar tag padrão
  const { data: defaultTag } = useQuery<TaskArea | null>({
    queryKey: ["/api/task-tags/default", "meetings"],
    queryFn: async () => {
      const res = await fetch("/api/task-tags/default?scope=meetings");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Sensors para drag and drop do dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handler para drag end das tags
  const handleTagDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = areas.findIndex(t => t.id === active.id);
      const newIndex = areas.findIndex(t => t.id === over.id);
      
      const newOrder = arrayMove(areas, oldIndex, newIndex);
      reorderTagsMutation.mutate(newOrder.map(t => t.id));
    }
  };

  // Componente para tag ordenável
  function SortableTag({ area, areaMeetingCount }: { area: TaskArea; areaMeetingCount: number }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: area.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
          selectedAreaId === area.id
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted"
        }`}
        onClick={() => setSelectedAreaId(area.id)}
        data-testid={`button-area-${area.id}`}
      >
        <button
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        <div
          className="h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: area.color || "#00A137" }}
        />
        {area.visibility === "shared" ? (
          <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{area.name}</span>
        {area.isDefault && (
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
        )}
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {areaMeetingCount}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-area-menu-${area.id}`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setDefaultTagMutation.mutate({
                  id: area.id,
                  isDefault: area.isDefault || false
                });
              }}
            >
              <Star className={`h-4 w-4 mr-2 ${area.isDefault ? "fill-yellow-400 text-yellow-400" : ""}`} />
              {area.isDefault ? "Remover como Padrão" : "Definir como Padrão"}
            </DropdownMenuItem>
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
  }

  const createMeetingMutation = useMutation({
    mutationFn: async (data: typeof newMeeting) => {
      const meetingDataPayload = {
        ...data.meetingData,
        agenda: data.meetingData.agenda,
        agendaImages: agendaImages,
        participants: data.meetingData.participants,
        externalParticipants: data.meetingData.externalParticipants,
        recurrenceCreateLeadDays: data.isRecurring ? data.recurrenceCreateLeadDays : undefined,
        templateId: data.templateId || undefined,
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
    mutationFn: async ({ id, scope }: { id: string; scope: string }) => {
      return apiRequest("DELETE", `/api/tasks/${id}?scope=${scope}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      setDeletingMeeting(null);
      toast({ title: "Reunião excluída!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir reunião", variant: "destructive" });
    },
  });

  const removeRecurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/tasks/${id}/remove-recurrence`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", selectedAreaId] });
      setRemovingRecurrenceMeeting(null);
      toast({ title: "Recorrência removida. A reunião foi mantida como avulsa." });
    },
    onError: () => {
      toast({ title: "Erro ao remover recorrência", variant: "destructive" });
    },
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; structure: string }) => {
      return apiRequest("POST", "/api/task-templates", { ...data, type: "meeting" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", "meeting"] });
      toast({ title: "Template criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar template", description: error.message, variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; structure: string } }) => {
      return apiRequest("PUT", `/api/task-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", "meeting"] });
      toast({ title: "Template atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar template", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/task-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", "meeting"] });
      toast({ title: "Template excluído!" });
    },
  });

  const setDefaultTemplateMutation = useMutation({
    mutationFn: async ({ id, isDefault }: { id: string; isDefault: boolean }) => {
      if (isDefault) {
        return apiRequest("DELETE", `/api/task-templates/${id}/set-default`);
      }
      return apiRequest("POST", `/api/task-templates/${id}/set-default`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", "meeting"] });
      toast({ title: "Template padrão atualizado!" });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (template: { id: string; name: string; structure: string }) => {
      return apiRequest("POST", "/api/task-templates", {
        name: `${template.name} (cópia)`,
        structure: template.structure,
        type: "meeting",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", "meeting"] });
      toast({ title: "Template duplicado!" });
    },
  });

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateStructure, setTemplateStructure] = useState("");

  // Drawer de gerenciamento de templates
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [templateDrawerView, setTemplateDrawerView] = useState<"list" | "create" | "edit">("list");
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string; structure: string } | null>(null);
  const [drawerTemplateName, setDrawerTemplateName] = useState("");
  const [drawerTemplateAgenda, setDrawerTemplateAgenda] = useState("");
  const [drawerTemplateLocation, setDrawerTemplateLocation] = useState("");
  const [drawerTemplateIsRecurring, setDrawerTemplateIsRecurring] = useState(false);
  const [drawerTemplateRecurrenceType, setDrawerTemplateRecurrenceType] = useState<"daily" | "weekly">("weekly");
  const [drawerTemplateWeekdays, setDrawerTemplateWeekdays] = useState<number[]>([]);
  const [drawerTemplateLeadDays, setDrawerTemplateLeadDays] = useState(1);
  
  // Inline editing state
  const [editingAgendaFor, setEditingAgendaFor] = useState<string | null>(null);
  const [inlineAgendaText, setInlineAgendaText] = useState("");
  
  // Presentation mode state
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentPresentationIndex, setCurrentPresentationIndex] = useState(0);

  // Delete meeting dialog state
  const [deletingMeeting, setDeletingMeeting] = useState<Task | null>(null);
  const [deleteScope, setDeleteScope] = useState<string>("single");

  // Remove recurrence dialog state
  const [removingRecurrenceMeeting, setRemovingRecurrenceMeeting] = useState<Task | null>(null);

  const applyTemplate = (template: { id: string; name: string; structure: string }) => {
    try {
      const structure = JSON.parse(template.structure);
      setNewMeeting({
        ...newMeeting,
        // Aplica título e descrição do template só se o campo estiver vazio
        title: newMeeting.title || structure.title || "",
        description: newMeeting.description || structure.description || "",
        meetingData: {
          ...newMeeting.meetingData,
          // Aplica agenda, local e participantes do template; preserva data e hora já preenchidas
          agenda: structure.agenda || newMeeting.meetingData.agenda,
          location: structure.location || newMeeting.meetingData.location,
          participants: structure.participants?.length > 0 ? structure.participants : newMeeting.meetingData.participants,
          externalParticipants: structure.externalParticipants?.length > 0 ? structure.externalParticipants : newMeeting.meetingData.externalParticipants,
          // date e time são preservados — não sobrescreve com template
          date: newMeeting.meetingData.date,
          time: newMeeting.meetingData.time,
          actions: structure.actions?.length > 0 ? structure.actions : newMeeting.meetingData.actions,
        },
        // Aplica configurações de recorrência do template (sem recurrenceEndDate — é específico de cada instância)
        isRecurring: structure.isRecurring ?? newMeeting.isRecurring,
        recurrenceType: structure.recurrenceType || newMeeting.recurrenceType,
        recurrenceWeekdays: structure.recurrenceWeekdays?.length > 0 ? structure.recurrenceWeekdays : newMeeting.recurrenceWeekdays,
        recurrenceCreateLeadDays: structure.recurrenceCreateLeadDays ?? newMeeting.recurrenceCreateLeadDays,
        // recurrenceEndDate NÃO é aplicado do template — cada instância define a sua
        templateId: template.id,
      });
      toast({ title: `Template "${template.name}" aplicado!` });
    } catch {
      toast({ title: "Erro ao aplicar template", variant: "destructive" });
    }
  };

  const handleSaveAsTemplate = () => {
    // Salva apenas campos persistentes: exclui data, hora e recurrenceEndDate específicos da instância
    const structure = JSON.stringify({
      title: newMeeting.title,
      description: newMeeting.description,
      agenda: newMeeting.meetingData.agenda,
      location: newMeeting.meetingData.location,
      participants: newMeeting.meetingData.participants,
      externalParticipants: newMeeting.meetingData.externalParticipants,
      actions: newMeeting.meetingData.actions,
      isRecurring: newMeeting.isRecurring,
      recurrenceType: newMeeting.recurrenceType,
      recurrenceWeekdays: newMeeting.recurrenceWeekdays,
      recurrenceCreateLeadDays: newMeeting.recurrenceCreateLeadDays,
      // NÃO salva: date, time, recurrenceEndDate (específicos de cada instância)
    });
    createTemplateMutation.mutate({ name: templateName, structure });
    setShowTemplateDialog(false);
    setTemplateName("");
    setTemplateStructure("");
  };

  // Inline editing handlers
  const startEditingAgenda = (meeting: Task) => {
    const data = getMeetingData(meeting);
    setInlineAgendaText(data.agenda || "");
    setEditingAgendaFor(meeting.id);
  };

  const saveInlineAgenda = (meeting: Task) => {
    const currentData = getMeetingData(meeting);
    const updatedData = { ...currentData, agenda: inlineAgendaText };
    updateMeetingMutation.mutate({
      id: meeting.id,
      data: { meetingData: JSON.stringify(updatedData) }
    });
    setEditingAgendaFor(null);
  };

  const cancelInlineEdit = () => {
    setEditingAgendaFor(null);
    setInlineAgendaText("");
  };

  const resetMeetingForm = () => {
    setNewMeeting({
      title: "",
      description: "",
      type: "meeting_note",
      status: "todo",
      priority: "medium",
      areaId: selectedAreaId || (defaultTag?.id || (areas[0]?.id || "")),
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
      recurrenceCreateLeadDays: 1,
      templateId: "",
    });
    setAgendaImages([]);
  };

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
    const defaultTemplate = (templates as any[]).find((t: any) => t.isDefault);
    const baseForm = {
      title: "",
      description: "",
      type: "meeting_note" as const,
      status: "todo",
      priority: "medium",
      areaId: selectedAreaId || (defaultTag?.id || (areas[0]?.id || "")),
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
      recurrenceCreateLeadDays: 1,
      templateId: "",
    };

    if (defaultTemplate) {
      try {
        const structure = JSON.parse(defaultTemplate.structure);
        setNewMeeting({
          ...baseForm,
          title: structure.title || "",
          description: structure.description || "",
          meetingData: {
            ...baseForm.meetingData,
            agenda: structure.agenda || "",
            location: structure.location || "",
            participants: structure.participants || [],
            externalParticipants: structure.externalParticipants || [],
            actions: structure.actions || [],
          },
          isRecurring: structure.isRecurring ?? false,
          recurrenceType: structure.recurrenceType || "daily",
          recurrenceWeekdays: structure.recurrenceWeekdays || [],
          recurrenceCreateLeadDays: structure.recurrenceCreateLeadDays ?? 1,
          templateId: defaultTemplate.id,
        });
      } catch {
        setNewMeeting(baseForm);
      }
    } else {
      setNewMeeting(baseForm);
    }
    setShowMeetingDialog(true);
  };

  const handleOpenTemplateDrawer = () => {
    setTemplateDrawerView("list");
    setEditingTemplate(null);
    setShowTemplateDrawer(true);
  };

  const handleEditTemplate = (template: any) => {
    try {
      const structure = JSON.parse(template.structure);
      setEditingTemplate(template);
      setDrawerTemplateName(template.name);
      setDrawerTemplateAgenda(structure.agenda || "");
      setDrawerTemplateLocation(structure.location || "");
      setDrawerTemplateIsRecurring(structure.isRecurring || false);
      setDrawerTemplateRecurrenceType(structure.recurrenceType || "weekly");
      setDrawerTemplateWeekdays(structure.recurrenceWeekdays || []);
      setDrawerTemplateLeadDays(structure.recurrenceCreateLeadDays ?? 1);
    } catch {
      setDrawerTemplateName(template.name);
    }
    setTemplateDrawerView("edit");
  };

  const handleOpenNewTemplateForm = () => {
    setEditingTemplate(null);
    setDrawerTemplateName("");
    setDrawerTemplateAgenda("");
    setDrawerTemplateLocation("");
    setDrawerTemplateIsRecurring(false);
    setDrawerTemplateRecurrenceType("weekly");
    setDrawerTemplateWeekdays([]);
    setDrawerTemplateLeadDays(1);
    setTemplateDrawerView("create");
  };

  const handleSaveDrawerTemplate = () => {
    const structure = JSON.stringify({
      agenda: drawerTemplateAgenda,
      location: drawerTemplateLocation,
      isRecurring: drawerTemplateIsRecurring,
      recurrenceType: drawerTemplateRecurrenceType,
      recurrenceWeekdays: drawerTemplateWeekdays,
      recurrenceCreateLeadDays: drawerTemplateLeadDays,
    });
    if (editingTemplate) {
      updateTemplateMutation.mutate(
        { id: editingTemplate.id, data: { name: drawerTemplateName, structure } },
        { onSuccess: () => setTemplateDrawerView("list") }
      );
    } else {
      createTemplateMutation.mutate(
        { name: drawerTemplateName, structure },
        { onSuccess: () => setTemplateDrawerView("list") }
      );
    }
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
      {/* Sidebar - Areas (condicional) */}
      {showTagsSidebar && (
        <div className="w-56 border-r border-border bg-muted/30 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Tags</span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => handleOpenAreaDialog()}
                data-testid="button-add-area"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setShowTagsSidebar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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
            {areas.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTagDragEnd}
              >
                <SortableContext
                  items={areas.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {areas.map((area) => {
                    const areaCount = allMeetings.filter(m => m.tagId === area.id).length;
                    return (
                      <SortableTag
                        key={area.id}
                        area={area}
                        areaMeetingCount={areaCount}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhuma tag criada
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={selectedArea ? selectedArea.name : "Todas as Reuniões"}
          description={selectedArea?.description || "Gerencie suas reuniões e anotações"}
          actions={
            <div className="flex items-center gap-2">
              {!showTagsSidebar && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTagsSidebar(true)}
                  className="flex items-center gap-2"
                >
                  <Tag className="h-4 w-4" />
                  <span>Tags</span>
                </Button>
              )}
              <Button onClick={handleOpenMeetingDialog} data-testid="button-new-meeting">
                <Plus className="h-4 w-4 mr-2" />
                Nova Reunião
              </Button>
            </div>
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
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
              title="Visualização em Tabela"
            >
              <Table className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
              title="Visualização em Lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
              title="Visualização em Cards"
            >
              <LayoutGrid className="h-4 w-4" />
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
          ) : viewMode === "table" ? (
            <DataTable
              columns={meetingTableColumns}
              data={filteredMeetings}
              onRowClick={(meeting) => navigate(`/reunioes/${meeting.id}`)}
              showCheckbox={false}
              isLoading={tasksLoading}
              emptyMessage="Nenhuma reunião encontrada."
            />
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
                            const idx = filteredMeetings.findIndex(m => m.id === meeting.id);
                            setCurrentPresentationIndex(idx >= 0 ? idx : 0);
                            setPresentationMode(true);
                          }}>
                            <MonitorPlay className="h-4 w-4 mr-2" />
                            Modo Apresentação
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reunioes/${meeting.id}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {(meeting.isRecurring || meeting.parentTaskId) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setRemovingRecurrenceMeeting(meeting);
                              }}>
                                <Repeat className="h-4 w-4 mr-2" />
                                Remover recorrência
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={(e) => {
                            e.stopPropagation();
                            setDeletingMeeting(meeting);
                            setDeleteScope("single");
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
                          {meetingData.templateId && (
                            <Badge variant="secondary" className="text-xs">
                              <LayoutGrid className="h-3 w-3 mr-1" />
                              Modelo
                            </Badge>
                          )}
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
                        {/* Inline Agenda Editing */}
                        <div className="mt-3">
                          {editingAgendaFor === meeting.id ? (
                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                              <RichTextarea
                                value={inlineAgendaText}
                                onChange={(v) => setInlineAgendaText(v)}
                                placeholder="Adicione os tópicos da agenda..."
                                data-testid="input-inline-agenda"
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => saveInlineAgenda(meeting)}
                                  disabled={updateMeetingMutation.isPending}
                                >
                                  Salvar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={cancelInlineEdit}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-muted-foreground cursor-pointer hover:bg-muted p-2 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingAgenda(meeting);
                              }}
                            >
                              {meetingData.agenda ? (
                                <div className="line-clamp-2 whitespace-pre-wrap">
                                  {stripHtml(meetingData.agenda)}
                                </div>
                              ) : (
                                <span className="italic text-xs flex items-center gap-1">
                                  <Edit className="h-3 w-3" />
                                  Adicionar agenda...
                                </span>
                              )}
                            </div>
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
                            const idx = filteredMeetings.findIndex(m => m.id === meeting.id);
                            setCurrentPresentationIndex(idx >= 0 ? idx : 0);
                            setPresentationMode(true);
                          }}>
                            <MonitorPlay className="h-4 w-4 mr-2" />
                            Modo Apresentação
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reunioes/${meeting.id}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {(meeting.isRecurring || meeting.parentTaskId) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setRemovingRecurrenceMeeting(meeting);
                              }}>
                                <Repeat className="h-4 w-4 mr-2" />
                                Remover recorrência
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingMeeting(meeting);
                              setDeleteScope("single");
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
                        .filter(u => u.status === "active" &&
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
                        u.status === "active" &&
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
            <div className="flex items-center justify-between pr-12">
              <DialogTitle>Nova Reunião</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenTemplateDrawer}>
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Templates
                </Button>
              </div>
            </div>
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Criar instância com antecedência de</label>
                    <Select
                      value={String(newMeeting.recurrenceCreateLeadDays)}
                      onValueChange={(v) => setNewMeeting({ ...newMeeting, recurrenceCreateLeadDays: Number(v) })}
                    >
                      <SelectTrigger data-testid="select-recurrence-lead-days">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No mesmo dia</SelectItem>
                        <SelectItem value="1">1 dia antes</SelectItem>
                        <SelectItem value="2">2 dias antes</SelectItem>
                        <SelectItem value="7">1 semana antes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define quando o sistema criará a reunião para que os participantes possam preparar a pauta com antecedência.
                    </p>
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
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplateDialog(true)}
              className="sm:mr-auto"
            >
              <FileText className="h-4 w-4 mr-1" />
              Salvar como Template
            </Button>
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

      {/* Template Save Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar como Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Template</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ex: Reunião Diária"
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">O que será salvo:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Título e descrição</li>
                <li>Pauta (agenda)</li>
                <li>Local</li>
                <li>Participantes</li>
                <li>Configurações de recorrência</li>
              </ul>
              <p className="text-xs mt-2">Data, horário e data de término <strong>não</strong> são salvos — são específicos de cada reunião.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={!templateName || createTemplateMutation.isPending}
            >
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Manager Drawer */}
      <Dialog open={showTemplateDrawer} onOpenChange={setShowTemplateDrawer}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {templateDrawerView !== "list" && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTemplateDrawerView("list")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle>
                {templateDrawerView === "list" && "Modelos de Reunião"}
                {templateDrawerView === "create" && "Novo Modelo"}
                {templateDrawerView === "edit" && "Editar Modelo"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {templateDrawerView === "list" && (
              <div className="space-y-2">
                {(templates as any[]).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum modelo criado ainda</p>
                  </div>
                ) : (
                  (templates as any[]).map((t: any) => {
                    let structure: any = {};
                    try { structure = JSON.parse(t.structure); } catch {}
                    const agendaPreview = structure.agenda ? stripHtml(structure.agenda).slice(0, 80) : "";

                    return (
                      <div key={t.id} className="group flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { applyTemplate(t); setShowTemplateDrawer(false); }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{t.name}</span>
                            {t.isDefault && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">Padrão</Badge>
                            )}
                            {structure.isRecurring && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                <Repeat className="h-3 w-3 mr-1" />
                                {structure.recurrenceType === "weekly" ? "Semanal" : "Diária"}
                              </Badge>
                            )}
                          </div>
                          {agendaPreview && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{agendaPreview}</p>
                          )}
                          {structure.location && (
                            <p className="text-xs text-muted-foreground mt-0.5">📍 {structure.location}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { applyTemplate(t); setShowTemplateDrawer(false); }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Usar este modelo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditTemplate(t)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateTemplateMutation.mutate(t)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDefaultTemplateMutation.mutate({ id: t.id, isDefault: t.isDefault || false })}
                            >
                              <Flag className="h-4 w-4 mr-2" />
                              {t.isDefault ? "Remover como Padrão" : "Definir como Padrão"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteTemplateMutation.mutate(t.id)}
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
            )}

            {(templateDrawerView === "create" || templateDrawerView === "edit") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Modelo</label>
                  <Input
                    value={drawerTemplateName}
                    onChange={(e) => setDrawerTemplateName(e.target.value)}
                    placeholder="Ex: Reunião de Alinhamento"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Local padrão</label>
                  <Input
                    value={drawerTemplateLocation}
                    onChange={(e) => setDrawerTemplateLocation(e.target.value)}
                    placeholder="Ex: Sala de reunião, Teams, Zoom"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pauta padrão</label>
                  <RichTextarea
                    value={drawerTemplateAgenda}
                    onChange={setDrawerTemplateAgenda}
                    placeholder="Tópicos a serem discutidos..."
                  />
                </div>

                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Repeat className="h-4 w-4" />
                      Recorrência padrão
                    </Label>
                    <Switch
                      checked={drawerTemplateIsRecurring}
                      onCheckedChange={setDrawerTemplateIsRecurring}
                    />
                  </div>
                  {drawerTemplateIsRecurring && (
                    <div className="space-y-3 pl-2">
                      <div className="flex gap-4">
                        {(["daily", "weekly"] as const).map((type) => (
                          <label key={type} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="drawer-recurrence"
                              value={type}
                              checked={drawerTemplateRecurrenceType === type}
                              onChange={() => setDrawerTemplateRecurrenceType(type)}
                              className="w-4 h-4 text-primary"
                            />
                            <span className="text-sm">{type === "daily" ? "Diária" : "Semanal"}</span>
                          </label>
                        ))}
                      </div>
                      {drawerTemplateRecurrenceType === "weekly" && (
                        <div className="flex flex-wrap gap-2">
                          {weekdays.map((day) => (
                            <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                              <Checkbox
                                checked={drawerTemplateWeekdays.includes(day.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setDrawerTemplateWeekdays([...drawerTemplateWeekdays, day.value].sort());
                                  } else {
                                    setDrawerTemplateWeekdays(drawerTemplateWeekdays.filter(d => d !== day.value));
                                  }
                                }}
                              />
                              <span className="text-sm">{day.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Criar instância com antecedência de</label>
                        <Select
                          value={String(drawerTemplateLeadDays)}
                          onValueChange={(v) => setDrawerTemplateLeadDays(Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">No mesmo dia</SelectItem>
                            <SelectItem value="1">1 dia antes</SelectItem>
                            <SelectItem value="2">2 dias antes</SelectItem>
                            <SelectItem value="7">1 semana antes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-3 flex justify-between">
            {templateDrawerView === "list" ? (
              <>
                <Button variant="outline" onClick={() => setShowTemplateDrawer(false)}>Fechar</Button>
                <Button onClick={handleOpenNewTemplateForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Modelo
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setTemplateDrawerView("list")}>Cancelar</Button>
                <Button
                  onClick={handleSaveDrawerTemplate}
                  disabled={!drawerTemplateName || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                >
                  {editingTemplate ? "Salvar Alterações" : "Criar Modelo"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Meeting Dialog */}
      <AlertDialog open={!!deletingMeeting} onOpenChange={(open) => !open && setDeletingMeeting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Reunião</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Tem certeza que deseja excluir a reunião "{deletingMeeting?.title}"?</p>
                {(deletingMeeting?.isRecurring || deletingMeeting?.parentTaskId) && (
                  <RadioGroup value={deleteScope} onValueChange={setDeleteScope} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="delete-single" />
                      <Label htmlFor="delete-single" className="text-sm font-normal cursor-pointer">Apenas esta reunião</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="future" id="delete-future" />
                      <Label htmlFor="delete-future" className="text-sm font-normal cursor-pointer">Esta e todas as futuras</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="delete-all" />
                      <Label htmlFor="delete-all" className="text-sm font-normal cursor-pointer">Todas as reuniões da série</Label>
                    </div>
                  </RadioGroup>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingMeeting && deleteMeetingMutation.mutate({ id: deletingMeeting.id, scope: deleteScope })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Recurrence Dialog */}
      <AlertDialog open={!!removingRecurrenceMeeting} onOpenChange={(open) => !open && setRemovingRecurrenceMeeting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              A recorrência da reunião "{removingRecurrenceMeeting?.title}" será removida. O registro da reunião será mantido como uma reunião avulsa, sem vínculo com a série. Esta ação não afeta as outras instâncias da série.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingRecurrenceMeeting && removeRecurrenceMutation.mutate(removingRecurrenceMeeting.id)}
            >
              Remover recorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Presentation Mode Dialog */}
      {presentationMode && filteredMeetings.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/50">
            <div className="text-white">
              <span className="text-sm text-gray-400">
                {currentPresentationIndex + 1} de {filteredMeetings.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPresentationMode(false)}
              className="text-white hover:bg-white/20"
            >
              <XCircle className="h-6 w-6" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-8">
            {(() => {
              const meeting = filteredMeetings[currentPresentationIndex];
              const meetingData = getMeetingData(meeting);
              const meetingArea = areas.find(a => a.id === meeting.tagId);
              
              return (
                <div className="max-w-4xl w-full bg-card rounded-lg p-8 text-center space-y-6">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {meetingArea && (
                      <Badge 
                        variant="secondary" 
                        className="text-sm"
                        style={{ backgroundColor: meetingArea.color || "#00A137" }}
                      >
                        {meetingArea.name}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-sm">
                      <Video className="h-4 w-4 mr-1" />
                      Reunião
                    </Badge>
                  </div>
                  
                  <h1 className="text-4xl font-bold">
                    {meeting.title}
                  </h1>
                  
                  {meeting.description && (
                    <RichContent
                      content={DOMPurify.sanitize(meeting.description)}
                      className="text-xl text-muted-foreground"
                    />
                  )}
                  
                  <div className="flex items-center justify-center gap-4 py-4">
                    {meetingData.date && (
                      <div className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5" />
                        {new Date(meetingData.date).toLocaleDateString("pt-BR", { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                    )}
                    {meetingData.time && (
                      <div className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5" />
                        {meetingData.time}
                      </div>
                    )}
                  </div>
                  
                  {meetingData.location && (
                    <p className="text-lg text-muted-foreground">
                      📍 {meetingData.location}
                    </p>
                  )}
                  
                  {meetingData.agenda && (
                    <div className="text-left mt-8 p-6 bg-muted rounded-lg">
                      <h3 className="text-xl font-semibold mb-4">📋 Pauta da Reunião</h3>
                      <RichContent content={meetingData.agenda} />
                    </div>
                  )}
                  
                  {meetingData.participants && meetingData.participants.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-2">Participantes Internos</h3>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {meetingData.participants.map((p: string) => {
                          const user = users.find(u => u.id === p);
                          return (
                            <Badge key={p} variant="secondary" className="text-sm py-1">
                              {user?.name || user?.email || p}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {meetingData.externalParticipants && meetingData.externalParticipants.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold mb-2">Participantes Externos</h3>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {meetingData.externalParticipants.map((email: string) => (
                          <Badge key={email} variant="outline" className="text-sm py-1">
                            {email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {meetingData.actions && meetingData.actions.length > 0 && (
                    <div className="text-left mt-8 p-6 bg-muted rounded-lg">
                      <h3 className="text-xl font-semibold mb-4">✅ Ações</h3>
                      <ul className="space-y-2">
                        {meetingData.actions.map((action: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" />
                            <span>
                              {action.description}
                              {action.responsible && (
                                <span className="text-muted-foreground"> - Responsável: {action.responsible}</span>
                              )}
                              {action.deadline && (
                                <span className="text-muted-foreground"> - Prazo: {action.deadline}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-8 p-4 bg-black/50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPresentationIndex(i => Math.max(0, i - 1))}
              disabled={currentPresentationIndex === 0}
              className="text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPresentationIndex(i => Math.min(filteredMeetings.length - 1, i + 1))}
              disabled={currentPresentationIndex === filteredMeetings.length - 1}
              className="text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
