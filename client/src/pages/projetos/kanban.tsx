import { useState } from "react";
import { useRoute } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, MoreHorizontal, Calendar, GripVertical, Play, Square, User as UserIcon, Tag as TagIcon, Hash, Search, CheckCircle, Lock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, KanbanColumn, KanbanCard, User } from "@shared/schema";
import { CardDialog } from "./card-dialog";
import { ColumnDialog } from "./column-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function KanbanPage() {
  const [, params] = useRoute("/projetos/:id");
  const projectId = params?.id;
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const moveCardMutation = useMutation({
    mutationFn: async ({ cardId, columnId }: { cardId: string; columnId: string }) => {
      return apiRequest("PATCH", `/api/cards/${cardId}`, { columnId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "cards"] });
    },
  });

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

  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const handleDragStart = (card: KanbanCard) => {
    setDraggedCard(card);
  };

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (columnId: string) => {
    if (draggedCard && draggedCard.columnId !== columnId) {
      moveCardMutation.mutate({ cardId: draggedCard.id, columnId });
    }
    setDraggedCard(null);
  };

  const openNewCardDialog = (columnId: string) => {
    setSelectedColumnId(columnId);
    setSelectedCardId(null);
    setIsCardDialogOpen(true);
  };

  const openEditCardDialog = (card: KanbanCard) => {
    setSelectedCardId(card.id);
    setSelectedColumnId(card.columnId);
    setIsCardDialogOpen(true);
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         card.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === "all" || card.priority === filterPriority;
    const matchesAssignee = filterAssignee === "all" || card.assigneeId === filterAssignee;
    return matchesSearch && matchesPriority && matchesAssignee;
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
            {project?.status !== "completed" && (
              <Button onClick={() => setIsColumnDialogOpen(true)} variant="outline" data-testid="button-add-column">
                <Plus className="h-4 w-4 mr-2" />
                Nova Coluna
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 pt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-4 rounded-lg">
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
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <main className="flex-1 p-6 overflow-hidden">
        <ScrollArea className="w-full h-full">
          <div className="flex gap-4 pb-4 min-h-[calc(100vh-280px)]">
            {sortedColumns.map((column) => {
              const columnCards = filteredCards.filter(c => c.columnId === column.id).sort((a, b) => a.order - b.order);
              
              return (
                <div 
                  key={column.id}
                  className={`flex-shrink-0 w-80 transition-opacity ${draggedColumnId === column.id ? 'opacity-50' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedColumnId) {
                      handleColumnDrop(column.id);
                    } else {
                      handleDrop(column.id);
                    }
                  }}
                >
                  <Card className="h-full flex flex-col bg-muted/30 border-none shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleColumnDragStart(e, column.id);
                          }}
                          onDragEnd={() => setDraggedColumnId(null)}
                          className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
                          data-testid={`drag-handle-column-${column.id}`}
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" data-testid={`button-column-menu-${column.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {project?.status !== "completed" && (
                            <>
                              <DropdownMenuItem onClick={() => openNewCardDialog(column.id)}>
                                Adicionar Card
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteColumnMutation.mutate(column.id)}
                              >
                                Excluir Coluna
                              </DropdownMenuItem>
                            </>
                          )}
                          {project?.status === "completed" && (
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              <Lock className="h-3 w-3 mr-2" />
                              Sprint Finalizada
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="flex-1 p-2 space-y-3 overflow-auto">
                      {columnCards.map((card) => {
                        const assignee = users.find(u => u.id === card.assigneeId);
                        const isReadOnly = project?.status === "completed";
                        return (
                          <Card 
                            key={card.id}
                            draggable={!isReadOnly}
                            onDragStart={() => !isReadOnly && handleDragStart(card)}
                            onClick={() => openEditCardDialog(card)}
                            className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary/50 group ${isReadOnly ? 'opacity-80' : 'active:cursor-grabbing'}`}
                            data-testid={`card-kanban-${card.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-tight truncate">
                                      {card.code}
                                    </span>
                                  </div>
                                  <Badge className={`text-[10px] h-4 px-1.5 uppercase font-bold tracking-wider ${priorityColors[card.priority]}`}>
                                    {priorityLabels[card.priority]}
                                  </Badge>
                                </div>

                                <div>
                                  <h4 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                                    {card.title}
                                  </h4>
                                  {card.objectives && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {card.objectives}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-muted/50">
                                  {card.tags?.map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-none hover:bg-primary/20">
                                      <TagIcon className="h-2 w-2 mr-1" />
                                      {tag}
                                    </Badge>
                                  ))}
                                  
                                  <div className="flex items-center gap-3 ml-auto">
                                    {card.startDate && (
                                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(card.startDate).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                                      </div>
                                    )}
                                    {assignee && (
                                      <div className="flex items-center gap-1 text-[10px] font-medium">
                                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                          <UserIcon className="h-3 w-3" />
                                        </div>
                                        <span className="max-w-[80px] truncate">{assignee.name.split(' ')[0]}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      
                      {project?.status !== "completed" && (
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start text-muted-foreground h-10 hover:bg-muted/50"
                          onClick={() => openNewCardDialog(column.id)}
                          data-testid={`button-add-card-${column.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Card
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </main>

      <CardDialog 
        open={isCardDialogOpen} 
        onOpenChange={setIsCardDialogOpen}
        projectId={projectId || ""}
        columnId={selectedColumnId || ""}
        cardId={selectedCardId || undefined}
        readOnly={project?.status === "completed"}
      />
      <ColumnDialog 
        open={isColumnDialogOpen} 
        onOpenChange={setIsColumnDialogOpen}
        projectId={projectId || ""}
        existingColumnsCount={columns.length}
      />
    </div>
  );
}
