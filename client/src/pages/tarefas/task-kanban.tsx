import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Task, TaskArea } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Calendar, FileText, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

interface TaskKanbanProps {
  tasks: Task[];
  areas: TaskArea[];
}

const columns = [
  { id: "todo", title: "A Fazer", color: "bg-gray-500" },
  { id: "doing", title: "Em Andamento", color: "bg-blue-500" },
  { id: "done", title: "Concluído", color: "bg-green-500" },
  { id: "archived", title: "Arquivado", color: "bg-slate-400" },
];

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600 border-slate-300",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-300",
  high: "bg-red-500/10 text-red-600 border-red-300",
};

const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  task: { label: "Tarefa", icon: CheckCircle2 },
  meeting_note: { label: "Reunião", icon: FileText },
};

export function TaskKanban({ tasks, areas }: TaskKanbanProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);

  const getColumnWidth = (colId: string) => columnWidths[colId] || 288;

  const handleColumnResizeStart = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    resizingCol.current = colId;
    const startX = e.clientX;
    const startWidth = columnWidths[colId] || 288;
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const newWidth = Math.max(220, Math.min(600, startWidth + (ev.clientX - startX)));
      setColumnWidths(prev => ({ ...prev, [colId]: newWidth }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [columnWidths]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PUT", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: () => {
      toast({ title: "Erro ao mover tarefa", variant: "destructive" });
    },
  });

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== status) {
      updateMutation.mutate({ id: taskId, status });
    }
  };

  const getArea = (areaId: string) => areas.find((a) => a.id === areaId);

  return (
    <div className="flex gap-0 overflow-x-auto pb-4 select-none">
      {columns.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.id);
        const width = getColumnWidth(column.id);
        return (
          <div
            key={column.id}
            className="flex-shrink-0 relative"
            style={{ width }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
            data-testid={`kanban-column-${column.id}`}
          >
            <div className="pr-3 pl-1">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-3 w-3 rounded-full ${column.color}`} />
                <h3 className="font-semibold">{column.title}</h3>
                <Badge variant="secondary" className="ml-auto">
                  {columnTasks.length}
                </Badge>
              </div>

              <div className="space-y-3 min-h-[200px] bg-muted/30 rounded-lg p-2">
              {columnTasks.map((task) => {
                const taskArea = getArea(task.areaId);
                const taskType = typeConfig[task.type as keyof typeof typeConfig];
                const TypeIcon = taskType?.icon || CheckCircle2;

                return (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => navigate(`/tarefas/${task.id}`)}
                    className="p-3 cursor-pointer hover-elevate"
                    data-testid={`kanban-card-${task.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {taskType?.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${priorityColors[task.priority]}`}
                      >
                        {task.priority === "high"
                          ? "Alta"
                          : task.priority === "medium"
                          ? "Média"
                          : "Baixa"}
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm mb-2 line-clamp-2">
                      {task.title}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      {taskArea && (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: taskArea.color || "#00A137" }}
                          />
                          <span className="truncate max-w-[80px]">{taskArea.name}</span>
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(task.dueDate).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
            </div>
            <div
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
              onMouseDown={(e) => handleColumnResizeStart(e, column.id)}
              data-testid={`kanban-resize-${column.id}`}
            />
          </div>
        );
      })}
    </div>
  );
}
