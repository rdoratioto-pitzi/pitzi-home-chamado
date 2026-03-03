import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Ticket } from "@shared/schema";

interface TicketSatisfactionProps {
  ticket: Ticket;
  onUpdate?: (ticket: Ticket) => void;
}

export function TicketSatisfaction({ ticket, onUpdate }: TicketSatisfactionProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Verificar se o ticket já foi avaliado
  const isEvaluated = ticket.satisfactionRating !== null && ticket.satisfactionRating !== undefined;
  const canEvaluate = ticket.status === "closed" || ticket.status === "resolved";

  const satisfactionMutation = useMutation({
    mutationFn: async (data: { rating: number; comment?: string }) => {
      const res = await apiRequest("PATCH", `/api/tickets/${ticket.id}/satisfaction`, data);
      return res.json();
    },
    onSuccess: (updatedTicket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Obrigado pela sua avaliação!",
        description: "Sua opinião nos ajuda a melhorar nosso atendimento.",
      });
      if (onUpdate) {
        onUpdate(updatedTicket);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar avaliação",
        description: error?.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Selecione uma nota",
        description: "Por favor, selecione uma nota de 1 a 5 estrelas.",
        variant: "destructive",
      });
      return;
    }
    satisfactionMutation.mutate({ rating, comment: comment || undefined });
  };

  // Se não pode avaliar, não mostrar nada
  if (!canEvaluate) {
    return null;
  }

  // Se já foi avaliado, mostrar resumo
  if (isEvaluated) {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-800 dark:text-green-200">Avaliação Enviada</span>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-5 w-5 ${
                star <= (ticket.satisfactionRating || 0)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-gray-600"
              }`}
            />
          ))}
        </div>
        {ticket.satisfactionComment && (
          <p className="text-sm text-muted-foreground mt-2 italic">
            "{ticket.satisfactionComment}"
          </p>
        )}
        {ticket.satisfactionCreatedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Avaliado em {new Date(ticket.satisfactionCreatedAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    );
  }

  // Formulário de avaliação
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 mt-4">
      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 text-yellow-500" />
        Como foi seu atendimento?
      </h4>
      
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= (hoveredStar || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-gray-600 hover:text-yellow-300"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mb-3">
        <Textarea
          placeholder="Deixe um comentário (opcional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          className="resize-none text-sm"
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right mt-1">
          {comment.length}/500
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={rating === 0 || satisfactionMutation.isPending}
        className="w-full"
        size="sm"
      >
        {satisfactionMutation.isPending ? (
          "Enviando..."
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Enviar Avaliação
          </>
        )}
      </Button>
    </div>
  );
}