import { useState } from "react";
import { useRoute } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, MoreHorizontal, GripVertical, Play, Square, Hash, Search, CheckCircle, Lock, Pencil, LayoutGrid, GanttChart, CalendarDays, List, BarChart2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, KanbanColumn, KanbanCard, User } from "@shared/schema";
import { CardDialog } from "./card-dialog";
import { ColumnDialog } from "./column-dialog";
import { GanttView } from "./gantt-view";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";
import { DashboardView } from "./dashboard-view";
import type { KanbanLabel } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DndContext, 
  DragEndEvent, 
  PointerSensor, 
  TouchSensor, 
  useSensor, 
  useSensors,
  closestCorners
} from "@dnd-kit/core";
import { DraggableCard } from "./draggable-card";
import { useDroppable } from "@dnd-kit/core";

type ViewMode = "kanban" | "gantt" | "calendar" | "lista" | "dashboard";

function KanbanColumnComponent({ 
  column, 
  columnCards, 
  users, 
  project, 
  priorityColors, 
  priorityLabels, 
  onNewCard, 
  onEditCard, 
  onDeleteColumn,
  onDragColumnStart,
  onEditColumn,
  onDropColumn
}: { 
  column: KanbanColumn; 
  columnCards: KanbanCard[]; 
  users: User[]; 
  project?: Project; 
  priorityColors: Record<string, string>; 
  priorityLabels: Record<string, string>; 
  onNewCard: (id: string) => void; 
  onEditCard: (card: KanbanCard) => void;
  onDeleteColumn: (id: string) => void;
  onDragColumnStart: (e: React.DragEvent, id: string) => void;
  onEditColumn: (id: string, currentName: string) => void;
  onDropColumn: (targetId: string) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex-shrink-0 w-80 h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropColumn(column.id)}
    >
      <Card className="h-full flex flex-col bg-muted/30 border-none shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 gap-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div
              draggable
              onDragStart={(e) => onDragColumnStart(e, column.id)}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            {column.name}
            <Badge variant="secondary" className="text-xs bg-muted/50">
              {columnCards.length}
            </Badge>
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {project?.status !== "completed" && (
                <>
                  <DropdownMenuItem onClick={() => onNewCard(column.id)}>
                    Adicionar Card
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEditColumn(column.id, column.name)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Renomear Coluna
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => onDeleteColumn(column.id)}
                  >
                    Excluir Coluna
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="flex-1 p-2 space-y-3 overflow-auto">
          {columnCards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              users={users}
              isReadOnly={project?.status === "completed"}
              priorityColors={priorityColors}
              priorityLabels={priorityLabels}
              onClick={() => onEditCard(card)}
            />
          ))}
          
          {project?.status !== "completed" && (
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground h-10 hover:bg-muted/50"
              onClick={() => onNewCard(column.id)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Card
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function KanbanPage() {
  const [, params] = useRoute("/projetos/:id");
  const projectId = params?.id;
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [parentCardIdForNew, setParentCardIdForNew] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingColumn, setEditingColumn] = useState<{ id: string; name: string } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: columns = [], isLoading: columnsLoading } = useQuery<KanbanColumn[]>({
    queryKey: ["/api/projects", projectId, "columns"],
    enabled: !!projectId,
  });

  const { data: cards = [] } = useQuery<KanbanCard[]>({
    queryKey: ["/api/projects", projectId, "cards"],
    enabled: !!projectId,
  });

  const { data: labels = [] } = useQuery<KanbanLabel[]>({
    queryKey: ["/api/projects", projectId, "labels"],
    enabled: !!projectId,
  });

  const { data: blockedCardIdsArr = [] } = useQuery<string[]>({
    queryKey: ["/api/projects", projectId, "blocked-cards"],
    enabled: !!projectId,
  });

  const blockedCardIds = new Set(blockedCardIdsArr);

  const moveCardMutation = useMutation({
    mutationFn: async ({ cardId, columnId }: { cardId: string; columnId: string }) => {
      return apiRequest("PATCH", `/api/cards/${cardId}`, { columnId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "cards"] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const columnId = over.id as string;

    const card = cards.find(c => c.id === cardId);
    if (card && card.columnId !== columnId) {
      moveCardMutation.mutate({ cardId, columnId });
    }
  };

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      return apiRequest("DELETE", `/api/columns/${columnId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "columns"] });
      toast({ title: "Coluna removida", description: "A coluna foi removida com sucesso." });
    },
  });

  const sprintMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/projects/${projectId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ 
        title: "Sprint atualizada", 
        description: "O status da sprint foi atualizado com sucesso." 
      });
    },
  });

  const reorderColumnsMutation = useMutation({
    mutationFn: async (reorders: { columnId: string; order: number }[]) => {
      await Promise.all(
        reorders.map(({ columnId, order }) => 
          apiRequest("PATCH", `/api/columns/${columnId}`, { order })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "columns"] });
    },
  });

  const renameColumnMutation = useMutation({
    mutationFn: async ({ columnId, name }: { columnId: string; name: string }) => {
      return apiRequest("PATCH", `/api/columns/${columnId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "columns"] });
      setEditingColumn(null);
      toast({ title: "Coluna renomeada", description: "O nome da coluna foi atualizado com sucesso." });
    },
  });

  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const handleColumnDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData("columnId", columnId);
    setDraggedColumnId(columnId);
  };

  const handleColumnDrop = (targetColumnId: string) => {
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null);
      return;
    }

    const sorted = [...columns].sort((a, b) => a.order - b.order);
    const draggedIdx = sorted.findIndex(c => c.id === draggedColumnId);
    const targetIdx = sorted.findIndex(c => c.id === targetColumnId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedColumnId(null);
      return;
    }

    const [removed] = sorted.splice(draggedIdx, 1);
    sorted.splice(targetIdx, 0, removed);

    const reorders = sorted.map((col, idx) => ({
      columnId: col.id,
      order: idx,
    }));

    reorderColumnsMutation.mutate(reorders);
    setDraggedColumnId(null);
  };

  const openNewCardDialog = (columnId: string, parentCardId?: string) => {
    setSelectedColumnId(columnId);
    setSelectedCardId(null);
    setParentCardIdForNew(parentCardId);
    setIsCardDialogOpen(true);
  };

  const openEditCardDialog = (card: KanbanCard) => {
    setSelectedCardId(card.id);
    setSelectedColumnId(card.columnId);
    setParentCardIdForNew(undefined);
    setIsCardDialogOpen(true);
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         card.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === "all" || card.priority === filterPriority;
    const matchesAssignee = filterAssignee === "all" || card.assigneeId === filterAssignee;
    const matchesStatus = filterStatus === "all" || card.columnId === filterStatus;
    return matchesSearch && matchesPriority && matchesAssignee && matchesStatus;
  });

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  if (projectLoading || columnsLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <PageHeader title="Carregando..." breadcrumbs={[{ label: "Projetos", href: "/projetos" }, { label: "..." }]} />
        <main className="flex-1 p-6">
          <div className="flex gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="w-80 h-96 flex-shrink-0" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    muito_urgente: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
    urgente: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
    normal: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  };

  const priorityLabels: Record<string, string> = {
    muito_urgente: "Muito Urgente",
    urgente: "Urgente",
    normal: "Normal",
  };

  const viewTabs = [
    { id: "kanban" as ViewMode, label: "Kanban", icon: LayoutGrid },
    { id: "gantt" as ViewMode, label: "Gantt", icon: GanttChart },
    { id: "calendar" as ViewMode, label: "Calendário", icon: CalendarDays },
    { id: "lista" as ViewMode, label: "Lista", icon: List },
    { id: "dashboard" as ViewMode, label: "Dashboard", icon: BarChart2 },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title={project?.name || "Projeto"} 
        breadcrumbs={[
          { label: "Projetos", href: "/projetos" },
          { label: project?.name || "Projeto" }
        ]}
        actions={
          <div className="flex items-center gap-3">
            {project?.status === "completed" ? (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Sprint Finalizada (Somente Visualização)
              </Badge>
            ) : project?.status === "sprint_active" ? (
              <Button 
                onClick={() => sprintMutation.mutate("completed")} 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                data-testid="button-finish-sprint"
              >
                <Square className="h-4 w-4 mr-2" />
                Finalizar Sprint
              </Button>
            ) : (
              <Button 
                onClick={() => sprintMutation.mutate("sprint_active")} 
                variant="outline" 
                className="text-green-600 border-green-200 hover:bg-green-50"
                data-testid="button-start-sprint"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Sprint
              </Button>
            )}
            {viewMode === "kanban" && project?.status !== "completed" && (
              <Button onClick={() => setIsColumnDialogOpen(true)} variant="outline" data-testid="button-add-column">
                <Plus className="h-4 w-4 mr-2" />
                Nova Coluna
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 pt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-3 rounded-lg">
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-background">
            {viewTabs.map((tab) => (
              <Button
                key={tab.id}
                variant={viewMode === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(tab.id)}
                className="gap-1.5"
                data-testid={`button-view-${tab.id}`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-kanban"
            />
          </div>
          
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Prioridades</SelectItem>
              <SelectItem value="muito_urgente">Muito Urgente</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Responsáveis</SelectItem>
              {users.filter(u => u.status === "active").sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {sortedColumns.map(col => (
                <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <main className="flex-1 p-6 overflow-hidden">
        {viewMode === "kanban" && (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="w-full h-full">
              <div className="flex gap-4 pb-4 min-h-[calc(100vh-320px)]">
                {sortedColumns.map((column) => (
                  <KanbanColumnComponent
                    key={column.id}
                    column={column}
                    columnCards={filteredCards.filter(c => c.columnId === column.id).sort((a, b) => {
                      // Sort by priority first: muito_urgente > urgente > normal
                      const priorityOrder: Record<string, number> = {
                        "muito_urgente": 0,
                        "urgente": 1,
                        "normal": 2
                      };
                      const priorityA = priorityOrder[a.priority] ?? 3;
                      const priorityB = priorityOrder[b.priority] ?? 3;
                      if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                      }
                      // Then sort by order
                      return a.order - b.order;
                    })}
                    users={users}
                    project={project}
                    priorityColors={priorityColors}
                    priorityLabels={priorityLabels}
                    onNewCard={openNewCardDialog}
                    onEditCard={openEditCardDialog}
                    onDeleteColumn={(id) => deleteColumnMutation.mutate(id)}
                    onDragColumnStart={handleColumnDragStart}
                    onEditColumn={(id, name) => setEditingColumn({ id, name })}
                    onDropColumn={handleColumnDrop}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DndContext>
        )}

        {viewMode === "gantt" && (
          <GanttView
            cards={filteredCards}
            columns={columns}
            users={users}
            onEditCard={openEditCardDialog}
            onNewCard={openNewCardDialog}
            isReadOnly={project?.status === "completed"}
          />
        )}

        {viewMode === "calendar" && (
          <CalendarView
            cards={filteredCards}
            columns={columns}
            users={users}
            onEditCard={openEditCardDialog}
            onNewCard={(columnId) => openNewCardDialog(columnId)}
            isReadOnly={project?.status === "completed"}
          />
        )}

        {viewMode === "lista" && (
          <ListView
            cards={filteredCards}
            columns={sortedColumns}
            users={users}
            labels={labels}
            blockedCardIds={blockedCardIds}
            onEditCard={openEditCardDialog}
          />
        )}

        {viewMode === "dashboard" && (
          <DashboardView
            projectId={projectId || ""}
            cards={filteredCards}
            columns={sortedColumns}
            users={users}
          />
        )}
      </main>

      <CardDialog 
        open={isCardDialogOpen} 
        onOpenChange={(open) => {
          setIsCardDialogOpen(open);
          if (!open) setParentCardIdForNew(undefined);
        }}
        projectId={projectId || ""}
        columnId={selectedColumnId || ""}
        cardId={selectedCardId || undefined}
        parentCardId={parentCardIdForNew}
        readOnly={project?.status === "completed"}
      />
      <ColumnDialog 
        open={isColumnDialogOpen} 
        onOpenChange={setIsColumnDialogOpen}
        projectId={projectId || ""}
        existingColumnsCount={columns.length}
      />
      <Dialog open={!!editingColumn} onOpenChange={(open) => { if (!open) setEditingColumn(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Renomear Coluna</DialogTitle>
            <DialogDescription>Altere o nome da coluna.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingColumn) {
              renameColumnMutation.mutate({ columnId: editingColumn.id, name: editingColumn.name });
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Coluna</label>
              <Input
                value={editingColumn?.name || ""}
                onChange={(e) => setEditingColumn(prev => prev ? { ...prev, name: e.target.value } : null)}
                data-testid="input-rename-column"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingColumn(null)}>Cancelar</Button>
              <Button type="submit" disabled={renameColumnMutation.isPending} data-testid="button-submit-rename-column">
                {renameColumnMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
