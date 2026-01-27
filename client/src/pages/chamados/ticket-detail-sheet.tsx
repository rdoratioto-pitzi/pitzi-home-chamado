import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Clock } from "lucide-react";
import type { Ticket, TicketComment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TicketDetailSheetProps {
  ticket: Ticket | null;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  resolved: "bg-green-500/10 text-green-600 dark:text-green-400",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export function TicketDetailSheet({ ticket, onClose }: TicketDetailSheetProps) {
  const [comment, setComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery<TicketComment[]>({
    queryKey: ["/api/tickets", ticket?.id, "comments"],
    enabled: !!ticket?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      return apiRequest("PATCH", `/api/tickets/${ticket?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Status atualizado",
        description: "O status do chamado foi atualizado com sucesso.",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/tickets/${ticket?.id}/comments`, {
        content,
        userId: "admin",
        ticketId: ticket?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticket?.id, "comments"] });
      setComment("");
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi adicionado com sucesso.",
      });
    },
  });

  const handleStatusChange = (status: string) => {
    updateMutation.mutate({ status });
  };

  const handleSubmitComment = () => {
    if (comment.trim()) {
      commentMutation.mutate(comment);
    }
  };

  if (!ticket) return null;

  return (
    <Sheet open={!!ticket} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left">{ticket.title}</SheetTitle>
          <SheetDescription className="text-left">
            Chamado #{ticket.id.slice(0, 8)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={statusColors[ticket.status]}>
              {statusLabels[ticket.status]}
            </Badge>
            <Badge variant="outline">
              Prioridade: {priorityLabels[ticket.priority]}
            </Badge>
            <Badge variant="outline">
              {ticket.category}
            </Badge>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Descrição</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                Aberto em {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("pt-BR") : "-"}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Alterar Status</h4>
            <Select 
              value={ticket.status} 
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-full" data-testid="select-change-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Comentários ({comments.length})</h4>
            
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum comentário ainda
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">AD</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Admin</span>
                        <span className="text-xs text-muted-foreground">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <Textarea
            placeholder="Adicione um comentário..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
            data-testid="input-comment"
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={!comment.trim() || commentMutation.isPending}
            className="w-full"
            data-testid="button-submit-comment"
          >
            <Send className="h-4 w-4 mr-2" />
            {commentMutation.isPending ? "Enviando..." : "Enviar Comentário"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
