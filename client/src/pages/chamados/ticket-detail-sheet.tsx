import { useState, useEffect } from "react";
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
import { RichTextarea } from "@/components/rich-textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Clock, Calendar, MessageSquare, CheckCircle, XCircle, Maximize2, Edit2, Check, X } from "lucide-react";
import type { Ticket, TicketComment, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

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

const impactLabels: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

// Helper function to format datetime in Brazilian format
const formatDateTime = (date: Date | string | null): string => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

// Helper function to calculate time difference
const calculateTimeDiff = (start: Date | string | null, end: Date | string | null): string => {
  if (!start || !end) return "";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    return `(${days}d ${hours}h ${diffMinutes}min)`;
  } else if (diffHours > 0) {
    return `(${diffHours}h ${diffMinutes}min)`;
  } else {
    return `(${diffMinutes} minutos)`;
  }
};

// Helper function to calculate time open with color
const getTimeOpenInfo = (createdAt: Date | string | null): { text: string; colorClass: string } => {
  if (!createdAt) return { text: "-", colorClass: "text-muted-foreground" };
  
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let text: string;
  if (diffDays > 0) {
    text = `${diffDays}d ${remainingHours}h ${diffMinutes}m`;
  } else if (diffHours > 0) {
    text = `${diffHours}h ${diffMinutes}m`;
  } else {
    text = `${diffMinutes}m`;
  }
  
  let colorClass: string;
  if (diffHours < 24) {
    colorClass = "text-green-600 dark:text-green-400";
  } else if (diffHours < 72) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
  } else {
    colorClass = "text-red-600 dark:text-red-400";
  }
  
  return { text, colorClass };
};

export function TicketDetailSheet({ ticket, onClose }: TicketDetailSheetProps) {
  const [comment, setComment] = useState("");
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (ticket) {
      setComment("");
      setCommentImages([]);
      setEditedDescription(ticket.description);
      setIsEditingDescription(false);
    }
  }, [ticket]);

  const { data: comments = [] } = useQuery<TicketComment[]>({
    queryKey: ["/api/tickets", ticket?.id, "comments"],
    enabled: !!ticket?.id,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Ticket>) => {
      return apiRequest("PATCH", `/api/tickets/${ticket?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Chamado atualizado",
        description: "As informações do chamado foram atualizadas.",
      });
    },
  });

  const handleStatusChange = (status: string) => {
    updateMutation.mutate({ status });
  };

  const handleAssigneeChange = (userId: string) => {
    updateMutation.mutate({ assigneeId: userId === "none" ? null : userId });
  };

  const handleSaveDescription = () => {
    updateMutation.mutate({ 
      description: editedDescription,
      descriptionLastEditedBy: "admin", // In a real app, this would be the logged in user's ID
      descriptionLastEditedAt: new Date()
    });
    setIsEditingDescription(false);
  };

  const commentMutation = useMutation({
    mutationFn: async (data: { content: string; images: string[] }) => {
      return apiRequest("POST", `/api/tickets/${ticket?.id}/comments`, {
        content: data.content,
        attachments: data.images.length > 0 ? JSON.stringify(data.images) : null,
        userId: "admin",
        ticketId: ticket?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticket?.id, "comments"] });
      setComment("");
      setCommentImages([]);
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi adicionado com sucesso.",
      });
    },
  });

  const handleSubmitComment = () => {
    if (comment.trim() || commentImages.length > 0) {
      commentMutation.mutate({ content: comment, images: commentImages });
    }
  };

  if (!ticket) return null;

  return (
    <Sheet open={!!ticket} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left">{ticket.title}</SheetTitle>
          <SheetDescription className="text-left">
            Chamado {ticket.code || `#${ticket.id.slice(0, 8)}`}
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
              Impacto: {impactLabels[ticket.impact || "medio"]}
            </Badge>
            <Badge variant="outline">
              {ticket.category}
            </Badge>
            <Badge variant="outline">
              {ticket.type || "Bug"}
            </Badge>
            <Badge variant="outline">
              {ticket.location || "-"}
            </Badge>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Descrição</h4>
              {!isEditingDescription && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2" 
                  onClick={() => setIsEditingDescription(true)}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              )}
            </div>
            
            {isEditingDescription ? (
              <div className="space-y-2 mb-4">
                <RichTextarea
                  value={editedDescription}
                  onChange={setEditedDescription}
                  maxLength={2000}
                  rows={6}
                />
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIsEditingDescription(false);
                      setEditedDescription(ticket.description);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveDescription}
                    disabled={updateMutation.isPending || editedDescription === ticket.description}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-hidden mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {ticket.description}
                </p>
                {ticket.descriptionLastEditedAt && (
                  <p className="text-[10px] text-muted-foreground mb-4 italic">
                    Editado por {users.find(u => u.id === ticket.descriptionLastEditedBy)?.name || "Admin"} em {formatDateTime(ticket.descriptionLastEditedAt)}
                  </p>
                )}
              </>
            )}
            
            {ticket.attachments && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(() => {
                  try {
                    const attachments = JSON.parse(ticket.attachments);
                    if (Array.isArray(attachments)) {
                      return attachments.map((url, i) => (
                        <Dialog key={i}>
                          <DialogTrigger asChild>
                            <div className="relative group rounded-md overflow-hidden border aspect-video bg-muted/50 flex items-center justify-center cursor-pointer">
                              <img src={url} alt="Anexo" className="max-w-full max-h-full object-contain" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </DialogTrigger>
                                      <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                                        <VisuallyHidden>
                                          <DialogTitle>Visualização de Imagem</DialogTitle>
                                        </VisuallyHidden>
                                        <img 
                                          src={url} 
                                          alt="Preview" 
                                          className="max-w-full max-h-full object-contain" 
                                        />
                                      </DialogContent>
                        </Dialog>
                      ));
                    }
                  } catch (e) {
                    return null;
                  }
                })()}
              </div>
            )}
          </div>

          {/* Timeline Section */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline do Chamado
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-muted-foreground">Aberto em:</span>
                <span className="font-medium">{formatDateTime(ticket.dataAbertura || ticket.createdAt)}</span>
              </div>
              
              {ticket.dataPrimeiraResposta && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-muted-foreground">Primeira resposta em:</span>
                  <span className="font-medium">
                    {formatDateTime(ticket.dataPrimeiraResposta)}
                    <span className="text-muted-foreground ml-1">
                      {calculateTimeDiff(ticket.dataAbertura || ticket.createdAt, ticket.dataPrimeiraResposta)}
                    </span>
                  </span>
                </div>
              )}
              
              {ticket.dataResolucao && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">Resolvido em:</span>
                  <span className="font-medium">
                    {formatDateTime(ticket.dataResolucao)}
                    <span className="text-muted-foreground ml-1">
                      {calculateTimeDiff(ticket.dataAbertura || ticket.createdAt, ticket.dataResolucao)}
                    </span>
                  </span>
                </div>
              )}
              
              {ticket.dataFechamento && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                  <span className="text-muted-foreground">Fechado em:</span>
                  <span className="font-medium">{formatDateTime(ticket.dataFechamento)}</span>
                </div>
              )}
              
              {/* Time open indicator */}
              {!ticket.dataResolucao && !ticket.dataFechamento && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Tempo aberto:</span>
                  {(() => {
                    const timeInfo = getTimeOpenInfo(ticket.dataAbertura || ticket.createdAt);
                    return (
                      <span className={`font-bold ${timeInfo.colorClass}`}>
                        {timeInfo.text}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Responsável</h4>
            <Select 
              value={ticket.assigneeId || "none"} 
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger className="w-full" data-testid="select-change-assignee">
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não atribuído</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Admin</span>
                        <span className="text-xs text-muted-foreground">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {c.content}
                      </p>
                      {c.attachments && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {(() => {
                            try {
                              const attachments = JSON.parse(c.attachments);
                              if (Array.isArray(attachments)) {
                                return attachments.map((url, i) => (
                                  <Dialog key={i}>
                                    <DialogTrigger asChild>
                                      <div className="relative group rounded-md overflow-hidden border aspect-video bg-muted/50 flex items-center justify-center cursor-pointer">
                                        <img src={url} alt="Anexo" className="max-w-full max-h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Maximize2 className="h-6 w-6 text-white" />
                                        </div>
                                      </div>
                                    </DialogTrigger>
                                  <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                                    <VisuallyHidden>
                                      <DialogTitle>Visualização de Imagem</DialogTitle>
                                    </VisuallyHidden>
                                    <img 
                                      src={url} 
                                      alt="Preview" 
                                      className="max-w-full max-h-full object-contain" 
                                    />
                                  </DialogContent>
                                  </Dialog>
                                ));
                              }
                            } catch (e) {
                              return null;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <RichTextarea
            placeholder="Adicione um comentário..."
            value={comment}
            onChange={setComment}
            images={commentImages}
            onImagesChange={setCommentImages}
            rows={3}
            maxLength={2000}
            data-testid="input-comment"
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={(!comment.trim() && commentImages.length === 0) || commentMutation.isPending}
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
