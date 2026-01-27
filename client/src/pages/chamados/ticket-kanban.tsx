import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Ticket, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface TicketKanbanProps {
  tickets: Ticket[];
  users: User[];
  onTicketClick: (ticket: Ticket) => void;
}

const columns = [
  { id: "open", title: "Aberto", color: "bg-blue-500" },
  { id: "in_progress", title: "Em Andamento", color: "bg-yellow-500" },
  { id: "blocked", title: "Bloqueado", color: "bg-red-500" },
  { id: "resolved", title: "Resolvido", color: "bg-green-500" },
  { id: "closed", title: "Fechado", color: "bg-gray-500" },
];

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600 border-slate-300",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-300",
  high: "bg-orange-500/10 text-orange-600 border-orange-300",
  critical: "bg-red-500/10 text-red-600 border-red-300",
};

const typeLabels: Record<string, string> = {
  bug: "Bug",
  melhoria: "Melhoria",
  negocio: "Negócio",
};

export function TicketKanban({ tickets, users, onTicketClick }: TicketKanbanProps) {
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/tickets/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError: () => {
      toast({ title: "Erro ao mover chamado", variant: "destructive" });
    },
  });

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.setData("ticketId", ticketId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData("ticketId");
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket && ticket.status !== status) {
      updateMutation.mutate({ id: ticketId, status });
    }
  };

  const getUser = (userId: string | null) => users.find((u) => u.id === userId);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTickets = tickets.filter((t) => t.status === column.id);
        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
            data-testid={`kanban-column-${column.id}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-3 w-3 rounded-full ${column.color}`} />
              <h3 className="font-semibold">{column.title}</h3>
              <Badge variant="secondary" className="ml-auto">
                {columnTickets.length}
              </Badge>
            </div>

            <div className="space-y-3 min-h-[200px] bg-muted/30 rounded-lg p-2">
              {columnTickets.map((ticket) => {
                const assignee = getUser(ticket.assigneeId || null);
                return (
                  <Card
                    key={ticket.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, ticket.id)}
                    onClick={() => onTicketClick(ticket)}
                    className="p-3 cursor-pointer hover-elevate"
                    data-testid={`kanban-card-${ticket.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {ticket.code}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${priorityColors[ticket.priority]}`}
                      >
                        {ticket.priority === "critical"
                          ? "Crí."
                          : ticket.priority === "high"
                          ? "Alta"
                          : ticket.priority === "medium"
                          ? "Méd."
                          : "Baixa"}
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm mb-2 line-clamp-2">
                      {ticket.title}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {typeLabels[ticket.type || "bug"]}
                      </Badge>
                      {assignee && (
                        <span className="truncate max-w-[80px]">
                          {assignee.name}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
