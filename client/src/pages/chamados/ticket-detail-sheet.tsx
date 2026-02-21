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
import { Send, Clock, Calendar, MessageSquare, CheckCircle, XCircle, Maximize2, Edit2, Check, X, Video, FileText, FileSpreadsheet, File, Download } from "lucide-react";
import type { Ticket, TicketComment, TicketCommentWithUser, User, Setting } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
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
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedAttachments, setEditedAttachments] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (ticket) {
      console.log('[TicketDetailSheet] Carregando ticket:', ticket.id);
      setComment("");
      setEditedDescription(ticket.description || '');
      setEditedAttachments(ticket.attachments ? (() => { try { return JSON.parse(ticket.attachments); } catch { return []; } })() : []);
      setIsEditingDescription(false);
    }
  }, [ticket?.id]);

  const { data: comments = [] } = useQuery<TicketCommentWithUser[]>({
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

  const handleEditDescription = () => {
    try {
      if (!ticket) {
        throw new Error('Nenhum chamado selecionado');
      }
      console.log('[TicketDetailSheet] Iniciando edição da descrição');
      setIsEditingDescription(true);
    } catch (error) {
      console.error('[TicketDetailSheet] Erro ao abrir edição:', error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o editor",
        variant: "destructive",
      });
    }
  };

  const handleSaveDescription = () => {
    if (!ticket) return;
    updateMutation.mutate({
      description: editedDescription,
      attachments: editedAttachments.length > 0 ? JSON.stringify(editedAttachments) : null,
      descriptionLastEditedBy: "admin",
      descriptionLastEditedAt: new Date().toISOString() as any
    });
    setIsEditingDescription(false);
  };

  const commentMutation = useMutation({
    mutationFn: async (data: { content: string; images: string[] }) => {
      return apiRequest("POST", `/api/tickets/${ticket?.id}/comments`, {
        content: data.content,
        attachments: data.images.length > 0 ? JSON.stringify(data.images) : null,
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    
    setIsSubmitting(true);
    try {
      console.log('Enviando comentário ticket:', { content: comment.trim() });
      
      const response = await fetch(`/api/tickets/${ticket?.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: comment.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro response:', errorData);
        throw new Error(errorData.error || 'Erro ao criar comentário');
      }

      const commentData = await response.json();
      console.log('Comentário criado:', commentData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", ticket?.id, "comments"] });
      setComment('');
      toast({ title: "Comentário adicionado!" });
    } catch (error: any) {
      console.error('Erro:', error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { data: categoriesSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_categories"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_categories");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: typesSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_types"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_types");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const categories: { value: string; label: string }[] = categoriesSetting?.value 
    ? JSON.parse(categoriesSetting.value) 
    : [
        { value: "tech", label: "Tech" },
        { value: "rh", label: "Recursos Humanos" },
        { value: "financeiro", label: "Financeiro" },
        { value: "operacoes", label: "Operações" },
        { value: "comercial", label: "Comercial" },
        { value: "outros", label: "Outros" },
      ];

  const types: { value: string; label: string }[] = typesSetting?.value 
    ? JSON.parse(typesSetting.value) 
    : [
        { value: "bug", label: "Bug" },
        { value: "melhoria", label: "Melhoria" },
        { value: "negocio", label: "Negócio" },
      ];

  const handleCategoryChange = (category: string) => {
    updateMutation.mutate({ category });
  };

  const handleTypeChange = (type: string) => {
    updateMutation.mutate({ type });
  };

  const handlePriorityChange = (priority: string) => {
    updateMutation.mutate({ priority });
  };

  const { data: locationsSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_locations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_locations");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const locations: { value: string; label: string }[] = locationsSetting?.value 
    ? JSON.parse(locationsSetting.value) 
    : [
        { value: "sao_paulo", label: "São Paulo" },
        { value: "curitiba", label: "Curitiba" },
        { value: "vitoria", label: "Vitória" },
        { value: "remoto", label: "Remoto" },
      ];

  const handleLocationChange = (location: string) => {
    updateMutation.mutate({ location });
  };

  const handleImpactChange = (impact: string) => {
    updateMutation.mutate({ impact });
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
                  onClick={handleEditDescription}
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
                  images={editedAttachments}
                  onImagesChange={setEditedAttachments}
                  maxLength={5000}
                  rows={6}
                />
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIsEditingDescription(false);
                      setEditedDescription(ticket.description);
                      setEditedAttachments(ticket.attachments ? (() => { try { return JSON.parse(ticket.attachments); } catch { return []; } })() : []);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveDescription}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="text-sm text-muted-foreground prose prose-sm max-w-none break-words overflow-hidden mb-1"
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  dangerouslySetInnerHTML={{ __html: ticket.description || '' }}
                />
                {ticket.descriptionLastEditedAt && (
                  <p className="text-[10px] text-muted-foreground mb-4 italic">
                    Editado por {users.find(u => u.id === ticket.descriptionLastEditedBy || u.email === ticket.descriptionLastEditedBy)?.name || "Admin"} em {formatDateTime(ticket.descriptionLastEditedAt)}
                  </p>
                )}
              </>
            )}
            
            {ticket.attachments && !isEditingDescription && (
              <div className="space-y-2 mt-2">
                {(() => {
                  try {
                    const attachments = JSON.parse(ticket.attachments);
                    if (Array.isArray(attachments)) {
                      return attachments.map((url: string, i: number) => {
                        // Garantir que url não seja null/undefined antes de usar startsWith/endsWith
                        if (!url || typeof url !== 'string') return null;
                        const isVideo = url.startsWith("data:video/") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");
                        const isImage = url.startsWith("data:image/") || url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".png") || url.endsWith(".gif") || url.endsWith(".webp");
                        const isPdf = url.startsWith("data:application/pdf") || url.endsWith(".pdf");
                        const isExcel = url.startsWith("data:application/vnd.ms-excel") || url.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheet") || url.startsWith("data:text/csv") || url.endsWith(".xlsx") || url.endsWith(".xls") || url.endsWith(".csv");
                        
                        if (isImage || isVideo) {
                          return (
                            <Dialog key={i}>
                              <DialogTrigger asChild>
                                <div className="relative group rounded-md overflow-hidden border aspect-video bg-muted/50 flex items-center justify-center cursor-pointer" style={{ maxHeight: "200px" }} data-testid={`attachment-media-${i}`}>
                                  {isVideo ? (
                                    <video src={url} className="max-w-full max-h-full object-contain" />
                                  ) : (
                                    <img src={url} alt="Anexo" className="max-w-full max-h-full object-contain" />
                                  )}
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    {isVideo ? <Video className="h-6 w-6 text-white" /> : <Maximize2 className="h-6 w-6 text-white" />}
                                  </div>
                                  {isVideo && (
                                    <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-md">
                                      <Video className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                                <VisuallyHidden>
                                  <DialogTitle>Visualização de {isVideo ? "Vídeo" : "Imagem"}</DialogTitle>
                                </VisuallyHidden>
                                {isVideo ? (
                                  <video src={url} controls autoPlay className="max-w-full max-h-full" />
                                ) : (
                                  <img src={url} alt="Preview" className="max-w-full max-h-full object-contain" />
                                )}
                              </DialogContent>
                            </Dialog>
                          );
                        }

                        const getFileName = () => {
                          const mimeMatch = url.match(/^data:([^;]+);/);
                          if (mimeMatch) {
                            const extMap: Record<string, string> = { "application/pdf": "pdf", "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "text/csv": "csv", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx" };
                            const ext = extMap[mimeMatch[1]] || mimeMatch[1].split("/")[1] || "arquivo";
                            return `Arquivo_${i + 1}.${ext}`;
                          }
                          return `Arquivo_${i + 1}`;
                        };

                        const handleOpen = () => {
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = getFileName();
                          link.target = "_blank";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        };

                        return (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover-elevate" onClick={handleOpen} data-testid={`attachment-file-${i}`}>
                            {isPdf ? <FileText className="h-6 w-6 text-red-500" /> : isExcel ? <FileSpreadsheet className="h-6 w-6 text-green-600" /> : <File className="h-6 w-6 text-muted-foreground" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{getFileName()}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{isPdf ? "PDF" : isExcel ? "Planilha" : "Arquivo"}</p>
                            </div>
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </div>
                        );
                      });
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Categoria</h4>
              <Select 
                value={ticket.category} 
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="w-full" data-testid="select-change-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Tipo</h4>
              <Select 
                value={ticket.type} 
                onValueChange={handleTypeChange}
              >
                <SelectTrigger className="w-full" data-testid="select-change-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Prioridade</h4>
              <Select 
                value={ticket.priority} 
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger className="w-full" data-testid="select-change-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Local</h4>
              <Select 
                value={ticket.location || ""} 
                onValueChange={handleLocationChange}
              >
                <SelectTrigger className="w-full" data-testid="select-change-location">
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Impacto</h4>
              <Select 
                value={ticket.impact || ""} 
                onValueChange={handleImpactChange}
              >
                <SelectTrigger className="w-full" data-testid="select-change-impact">
                  <SelectValue placeholder="Selecione o impacto" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      <AvatarFallback className="text-xs">
                        {c.author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.author.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy HH:mm") : "-"}
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
                                return attachments.map((url, i) => {
                                  // Garantir que url não seja null/undefined antes de usar startsWith/endsWith
                                  if (!url || typeof url !== 'string') return null;
                                  const isVideo = url.startsWith("data:video/") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");
                                  return (
                                    <Dialog key={i}>
                                      <DialogTrigger asChild>
                                        <div className="relative group rounded-md overflow-hidden border aspect-video bg-muted/50 flex items-center justify-center cursor-pointer">
                                          {isVideo ? (
                                            <video src={url} className="max-w-full max-h-full object-contain" />
                                          ) : (
                                            <img src={url} alt="Anexo" className="max-w-full max-h-full object-contain" />
                                          )}
                                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            {isVideo ? <Video className="h-6 w-6 text-white" /> : <Maximize2 className="h-6 w-6 text-white" />}
                                          </div>
                                          {isVideo && (
                                            <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-md">
                                              <Video className="h-3 w-3" />
                                            </div>
                                          )}
                                        </div>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                                        <VisuallyHidden>
                                          <DialogTitle>Visualização de {isVideo ? "Vídeo" : "Imagem"}</DialogTitle>
                                        </VisuallyHidden>
                                        {isVideo ? (
                                          <video src={url} controls autoPlay className="max-w-full max-h-full" />
                                        ) : (
                                          <img 
                                            src={url} 
                                            alt="Preview" 
                                            className="max-w-full max-h-full object-contain" 
                                          />
                                        )}
                                      </DialogContent>
                                    </Dialog>
                                  );
                                });
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
          <Textarea
            placeholder="Adicione um comentário..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="resize-none"
            data-testid="input-comment"
          />
          <Button
            onClick={handleSubmitComment}
            disabled={!comment.trim() || isSubmitting}
            className="w-full"
            data-testid="button-submit-comment"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Enviando..." : "Enviar Comentário"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
