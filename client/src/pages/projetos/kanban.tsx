import { useState } from "react";
import { useRoute } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, MoreHorizontal, Calendar, GripVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, KanbanColumn, KanbanCard } from "@shared/schema";
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

export default function KanbanPage() {
  const [, params] = useRoute("/projetos/:id");
  const projectId = params?.id;
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
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

  const handleDragStart = (card: KanbanCard) => {
    setDraggedCard(card);
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
    setIsCardDialogOpen(true);
  };

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

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title={project?.name || "Projeto"} 
        breadcrumbs={[
          { label: "Projetos", href: "/projetos" },
          { label: project?.name || "Projeto" }
        ]}
        actions={
          <Button onClick={() => setIsColumnDialogOpen(true)} variant="outline" data-testid="button-add-column">
            <Plus className="h-4 w-4 mr-2" />
            Nova Coluna
          </Button>
        }
      />

      <main className="flex-1 p-6 overflow-hidden">
        <ScrollArea className="w-full h-full">
          <div className="flex gap-4 pb-4 min-h-[calc(100vh-200px)]">
            {sortedColumns.map((column) => {
              const columnCards = cards.filter(c => c.columnId === column.id).sort((a, b) => a.order - b.order);
              
              return (
                <div 
                  key={column.id}
                  className="flex-shrink-0 w-80"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(column.id)}
                >
                  <Card className="h-full flex flex-col bg-muted/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        {column.name}
                        <Badge variant="secondary" className="text-xs">
                          {columnCards.length}
                        </Badge>
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-column-menu-${column.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openNewCardDialog(column.id)}>
                            Adicionar Card
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteColumnMutation.mutate(column.id)}
                          >
                            Excluir Coluna
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="flex-1 p-2 space-y-2 overflow-auto">
                      {columnCards.map((card) => (
                        <Card 
                          key={card.id}
                          draggable
                          onDragStart={() => handleDragStart(card)}
                          className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                          data-testid={`card-kanban-${card.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{card.title}</p>
                                {card.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {card.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {card.tags?.map((tag, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {card.dueDate && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(card.dueDate).toLocaleDateString("pt-BR")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => openNewCardDialog(column.id)}
                        data-testid={`button-add-card-${column.id}`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar card
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })}

            {columns.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Nenhuma coluna criada ainda
                  </p>
                  <Button onClick={() => setIsColumnDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Coluna
                  </Button>
                </Card>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </main>

      <CardDialog 
        open={isCardDialogOpen} 
        onOpenChange={setIsCardDialogOpen}
        projectId={projectId || ""}
        columnId={selectedColumnId || ""}
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
