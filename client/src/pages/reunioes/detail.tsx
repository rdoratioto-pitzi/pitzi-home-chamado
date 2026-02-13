import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RichTextarea } from "@/components/rich-textarea";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Archive,
  Video,
  MoreHorizontal,
  Send,
  Smile,
  User,
  Users,
  Edit,
  Trash2,
  Save,
  X,
  Download,
  ArrowRight,
  Maximize2,
  Paperclip,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskComment, TaskArea, User as UserType } from "@shared/schema";

const statusConfig = {
  todo: { label: "Agendada", icon: Circle, color: "bg-gray-100 text-gray-700" },
  doing: { label: "Em Andamento", icon: Clock, color: "bg-blue-100 text-blue-700" },
  done: { label: "Concluída", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  archived: { label: "Arquivada", icon: Archive, color: "bg-gray-100 text-gray-500" },
};

const priorityConfig = {
  low: { label: "Baixa", color: "bg-gray-100 text-gray-600" },
  medium: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  high: { label: "Alta", color: "bg-red-100 text-red-700" },
};

const EMOJI_LIST = ["👍", "❤️", "🎉", "👀", "🚀", "💯", "✅", "🤔"];

interface MeetingData {
  date?: string;
  time?: string;
  location?: string;
  participants?: string[];
  externalParticipants?: string[];
  agenda?: string;
  agendaImages?: string[];
  discussions?: string;
  decisions?: string[];
  actions?: Array<{ description: string; responsible: string; deadline: string }>;
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editedMeeting, setEditedMeeting] = useState<Partial<Task>>({});
  const [editedMeetingData, setEditedMeetingData] = useState<MeetingData>({});

  const { data: meeting, isLoading } = useQuery<Task>({
    queryKey: ["/api/tasks", id],
  });

  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: ["/api/tasks", id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: areas = [] } = useQuery<TaskArea[]>({
    queryKey: ["/api/task-tags"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  useEffect(() => {
    if (meeting) {
      setEditedMeeting(meeting);
      if (meeting.meetingData) {
        try {
          setEditedMeetingData(JSON.parse(meeting.meetingData));
        } catch {
          setEditedMeetingData({});
        }
      }
    }
  }, [meeting]);

  const updateMeetingMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      return apiRequest("PUT", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsEditing(false);
      toast({ title: "Reunião atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar reunião", variant: "destructive" });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      navigate("/reunioes");
      toast({ title: "Reunião excluída!" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; parentCommentId?: string; images: string[] }) => {
      return apiRequest("POST", `/api/tasks/${id}/comments`, {
        ...data,
        attachments: data.images.length > 0 ? JSON.stringify(data.images) : null,
        authorId: "admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", id, "comments"] });
      setNewComment("");
      setCommentImages([]);
      setReplyingTo(null);
      toast({ title: "Comentário adicionado!" });
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      return apiRequest("POST", `/api/task-comments/${commentId}/reactions`, { userId: "admin", emoji });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", id, "comments"] });
    },
  });

  const handleSave = () => {
    const data: Partial<Task> = {
      ...editedMeeting,
      meetingData: JSON.stringify(editedMeetingData),
    };
    updateMeetingMutation.mutate(data);
  };

  const handleSubmitComment = () => {
    if (!newComment.trim() && commentImages.length === 0) return;
    createCommentMutation.mutate({
      content: newComment,
      parentCommentId: replyingTo || undefined,
      images: commentImages,
    });
  };

  const convertActionToTask = async (action: { description: string; responsible: string; deadline: string }) => {
    try {
      const responsibleUser = users.find(u => u.name.toLowerCase() === action.responsible.toLowerCase());
      await apiRequest("POST", "/api/tasks", {
        title: action.description,
        description: `Ação originada da reunião: ${meeting?.title}`,
        type: "task",
        status: "todo",
        priority: "medium",
        tagId: meeting?.tagId,
        createdBy: "admin",
        assigneeId: responsibleUser?.id || undefined,
        dueDate: action.deadline || null,
        parentTaskId: meeting?.id,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Tarefa criada a partir da ação!" });
    } catch {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
    }
  };

  const exportMeetingToPDF = async () => {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    
    const doc = new jsPDF();
    const meetingDataLocal = editedMeetingData;
    
    doc.setFontSize(18);
    doc.setTextColor(0, 161, 55);
    doc.text("Renov Home - Agenda de Reunião", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(meeting?.title || "Reunião", 14, 32);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    let yPos = 45;
    
    doc.text(`Data: ${meetingDataLocal.date || "-"}`, 14, yPos);
    doc.text(`Horário: ${meetingDataLocal.time || "-"}`, 80, yPos);
    yPos += 8;
    doc.text(`Local: ${meetingDataLocal.location || "-"}`, 14, yPos);
    yPos += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("Participantes:", 14, yPos);
    yPos += 6;
    doc.setFontSize(10);
    const participantNames = meetingDataLocal.participants?.map(p => {
      const user = users.find(u => u.id === p);
      return user?.name || p;
    }).join(", ") || "-";
    doc.text(participantNames, 14, yPos);
    yPos += 12;
    
    doc.setFontSize(12);
    doc.text("Pauta:", 14, yPos);
    yPos += 6;
    doc.setFontSize(10);
    const agendaLines = doc.splitTextToSize(meetingDataLocal.agenda || "Nenhuma pauta definida", 180);
    doc.text(agendaLines, 14, yPos);
    yPos += agendaLines.length * 5 + 10;
    
    if (meetingDataLocal.actions?.length) {
      doc.setFontSize(12);
      doc.text("Ações:", 14, yPos);
      yPos += 8;
      
      const tableData = meetingDataLocal.actions.map((action) => [
        action.description,
        action.responsible || "-",
        action.deadline ? new Date(action.deadline).toLocaleDateString("pt-BR") : "-"
      ]);
      
      (doc as any).autoTable({
        startY: yPos,
        head: [["Descrição", "Responsável", "Prazo"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [0, 161, 55] },
        margin: { left: 14, right: 14 },
      });
    }
    
    doc.save(`reuniao-${meeting?.id?.slice(0, 8)}.pdf`);
    toast({ title: "PDF exportado com sucesso!" });
  };

  const rootComments = comments.filter(c => !c.parentCommentId);
  const getReplies = (commentId: string) => comments.filter(c => c.parentCommentId === commentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-muted-foreground mb-4">Reunião não encontrada</div>
        <Button onClick={() => navigate("/reunioes")}>Voltar</Button>
      </div>
    );
  }

  const meetingArea = areas.find(a => a.id === meeting.tagId);
  const status = statusConfig[meeting.status as keyof typeof statusConfig];
  const priority = priorityConfig[meeting.priority as keyof typeof priorityConfig];
  const StatusIcon = status?.icon || Circle;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reunioes")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            {meetingArea && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: meetingArea.color || "#00A137" }} />
                {meetingArea.visibility === "shared" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                <span>{meetingArea.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={updateMeetingMutation.isPending} data-testid="button-save-meeting">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-meeting">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="button-meeting-actions">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => deleteMeetingMutation.mutate()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <button
              onClick={() => {
                const nextStatus = meeting.status === "todo" ? "doing" : meeting.status === "doing" ? "done" : "todo";
                updateMeetingMutation.mutate({ status: nextStatus });
              }}
              className="mt-1"
              data-testid="button-toggle-status"
            >
              <StatusIcon className={`h-6 w-6 ${
                meeting.status === "done" ? "text-green-500" : 
                meeting.status === "doing" ? "text-blue-500" : "text-gray-400"
              }`} />
            </button>
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedMeeting.title || ""}
                  onChange={(e) => setEditedMeeting({ ...editedMeeting, title: e.target.value })}
                  className="text-xl font-semibold mb-2"
                  data-testid="input-edit-title"
                />
              ) : (
                <h1 className={`text-xl font-semibold mb-2 ${meeting.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {meeting.title}
                </h1>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  <Video className="h-3 w-3 mr-1" />
                  Reunião
                </Badge>
                {isEditing ? (
                  <Select
                    value={editedMeeting.status || meeting.status}
                    onValueChange={(v) => setEditedMeeting({ ...editedMeeting, status: v })}
                  >
                    <SelectTrigger className="w-36 h-7" data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">Agendada</SelectItem>
                      <SelectItem value="doing">Em Andamento</SelectItem>
                      <SelectItem value="done">Concluída</SelectItem>
                      <SelectItem value="archived">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={status?.color}>{status?.label}</Badge>
                )}
                {isEditing ? (
                  <Select
                    value={editedMeeting.priority || meeting.priority}
                    onValueChange={(v) => setEditedMeeting({ ...editedMeeting, priority: v })}
                  >
                    <SelectTrigger className="w-28 h-7" data-testid="select-edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={priority?.color}>{priority?.label}</Badge>
                )}
                {editedMeetingData.date && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(editedMeetingData.date).toLocaleDateString("pt-BR")}
                  </Badge>
                )}
                {editedMeetingData.time && (
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {editedMeetingData.time}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium flex items-center gap-2">
                <Video className="h-4 w-4" />
                Agenda de Reunião
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={exportMeetingToPDF}
                data-testid="button-export-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data</label>
                  {isEditing ? (
                    <Input
                      type="date"
                      className="date-picker-full"
                      value={editedMeetingData.date || ""}
                      onChange={(e) => setEditedMeetingData({ ...editedMeetingData, date: e.target.value })}
                      data-testid="input-meeting-date"
                    />
                  ) : (
                    <p className="mt-1">{editedMeetingData.date ? new Date(editedMeetingData.date).toLocaleDateString("pt-BR") : "-"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Horário</label>
                  {isEditing ? (
                    <Input
                      type="time"
                      value={editedMeetingData.time || ""}
                      onChange={(e) => setEditedMeetingData({ ...editedMeetingData, time: e.target.value })}
                      data-testid="input-meeting-time"
                    />
                  ) : (
                    <p className="mt-1">{editedMeetingData.time || "-"}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Local</label>
                {isEditing ? (
                  <Input
                    value={editedMeetingData.location || ""}
                    onChange={(e) => setEditedMeetingData({ ...editedMeetingData, location: e.target.value })}
                    placeholder="Local da reunião"
                    data-testid="input-meeting-location"
                  />
                ) : (
                  <p className="mt-1">{editedMeetingData.location || "-"}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Participantes</label>
                {isEditing ? (
                  <Input
                    value={editedMeetingData.participants?.join(", ") || ""}
                    onChange={(e) => setEditedMeetingData({ 
                      ...editedMeetingData, 
                      participants: e.target.value.split(",").map(p => p.trim()).filter(Boolean)
                    })}
                    placeholder="IDs de usuários separados por vírgula"
                    data-testid="input-meeting-participants"
                  />
                ) : (
                  <p className="mt-1">
                    {editedMeetingData.participants?.length 
                      ? editedMeetingData.participants.map(p => {
                          const user = users.find(u => u.id === p);
                          return user?.name || p;
                        }).join(", ")
                      : "-"
                    }
                  </p>
                )}
              </div>

              {editedMeetingData.externalParticipants && editedMeetingData.externalParticipants.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Participantes Externos</label>
                  <p className="mt-1">{editedMeetingData.externalParticipants.join(", ")}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Pauta</label>
                {isEditing ? (
                  <RichTextarea
                    value={editedMeetingData.agenda || ""}
                    onChange={(v) => setEditedMeetingData({ 
                      ...editedMeetingData, 
                      agenda: v
                    })}
                    images={editedMeetingData.agendaImages || []}
                    onImagesChange={(imgs) => setEditedMeetingData({
                      ...editedMeetingData,
                      agendaImages: imgs
                    })}
                    placeholder="Pauta da reunião..."
                    rows={10}
                    maxLength={5000}
                    data-testid="input-meeting-agenda"
                  />
                ) : (
                  <div className="mt-1 space-y-4">
                    <div className="whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {editedMeetingData.agenda || <span className="text-muted-foreground">Nenhuma pauta definida</span>}
                    </div>
                    {editedMeetingData.agendaImages && editedMeetingData.agendaImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {editedMeetingData.agendaImages.map((url, i) => (
                          <Dialog key={i}>
                            <DialogTrigger asChild>
                              <div className="relative group rounded-lg overflow-hidden border bg-muted/50 aspect-video flex items-center justify-center cursor-pointer">
                                <img src={url} alt="Anexo" className="max-w-full max-h-full object-contain" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Maximize2 className="h-6 w-6 text-white" />
                                </div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-transparent border-none">
                              <img src={url} alt="Preview" className="w-full h-auto max-h-[85vh] object-contain mx-auto" />
                            </DialogContent>
                          </Dialog>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Ações</label>
                {isEditing ? (
                  <div className="space-y-2">
                    {(editedMeetingData.actions || []).map((action, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2">
                        <Input
                          value={action.description}
                          onChange={(e) => {
                            const newActions = [...(editedMeetingData.actions || [])];
                            newActions[i] = { ...newActions[i], description: e.target.value };
                            setEditedMeetingData({ ...editedMeetingData, actions: newActions });
                          }}
                          placeholder="Descrição"
                        />
                        <Input
                          value={action.responsible}
                          onChange={(e) => {
                            const newActions = [...(editedMeetingData.actions || [])];
                            newActions[i] = { ...newActions[i], responsible: e.target.value };
                            setEditedMeetingData({ ...editedMeetingData, actions: newActions });
                          }}
                          placeholder="Responsável"
                        />
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            className="date-picker-full"
                            value={action.deadline}
                            onChange={(e) => {
                              const newActions = [...(editedMeetingData.actions || [])];
                              newActions[i] = { ...newActions[i], deadline: e.target.value };
                              setEditedMeetingData({ ...editedMeetingData, actions: newActions });
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const newActions = [...(editedMeetingData.actions || [])];
                              newActions.splice(i, 1);
                              setEditedMeetingData({ ...editedMeetingData, actions: newActions });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditedMeetingData({
                          ...editedMeetingData,
                          actions: [...(editedMeetingData.actions || []), { description: "", responsible: "", deadline: "" }]
                        });
                      }}
                    >
                      Adicionar Ação
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editedMeetingData.actions?.length ? (
                      editedMeetingData.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          <div className="flex-1">
                            <p className="font-medium">{action.description}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span>Responsável: {action.responsible || "-"}</span>
                              {action.deadline && (
                                <span>Prazo: {new Date(action.deadline).toLocaleDateString("pt-BR")}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => convertActionToTask(action)}
                            data-testid={`button-convert-action-${i}`}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Criar Tarefa
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Nenhuma ação definida</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Comments Section */}
        <Card className="p-6">
          <h3 className="font-medium mb-4">Comentários</h3>
          
          <div className="space-y-4 mb-4">
            {rootComments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
            ) : (
              rootComments.map((comment) => {
                const author = users.find(u => u.id === comment.authorId);
                const replies = getReplies(comment.id);
                
                return (
                  <div key={comment.id} className="space-y-3">
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {author?.name?.slice(0, 2).toUpperCase() || "US"}
                        </AvatarFallback>
                      </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{author?.name || "Usuário"}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt || "").toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {comment.content}
                            </p>
                            {(comment as any).attachments && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {(() => {
                                  try {
                                    const attachments = JSON.parse((comment as any).attachments);
                                    if (Array.isArray(attachments)) {
                                      return attachments.map((url: string, i: number) => (
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
                            <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          >
                            Responder
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Smile className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                              <div className="flex gap-1">
                                {EMOJI_LIST.map((emoji) => (
                                  <button
                                    key={emoji}
                                    className="text-lg hover:bg-muted p-1 rounded"
                                    onClick={() => addReactionMutation.mutate({ commentId: comment.id, emoji })}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    
                    {replyingTo === comment.id && (
                      <div className="ml-11 flex gap-2">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Escreva uma resposta..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmitComment();
                            }
                          }}
                        />
                        <Button size="icon" onClick={handleSubmitComment}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {replies.length > 0 && (
                      <div className="ml-11 space-y-3 border-l-2 border-border pl-4">
                        {replies.map((reply) => {
                          const replyAuthor = users.find(u => u.id === reply.authorId);
                          return (
                            <div key={reply.id} className="flex gap-3">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {replyAuthor?.name?.slice(0, 2).toUpperCase() || "US"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{replyAuthor?.name || "Usuário"}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(reply.createdAt || "").toLocaleString("pt-BR")}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          {!replyingTo && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <RichTextarea
                placeholder="Adicione um comentário..."
                value={newComment}
                onChange={setNewComment}
                images={commentImages}
                onImagesChange={setCommentImages}
                rows={3}
                maxLength={5000}
                data-testid="input-new-comment"
              />
              <Button 
                onClick={handleSubmitComment}
                disabled={(!newComment.trim() && commentImages.length === 0) || createCommentMutation.isPending}
                className="w-full"
                data-testid="button-submit-comment"
              >
                <Send className="h-4 w-4 mr-2" />
                {createCommentMutation.isPending ? "Enviando..." : "Enviar Comentário"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
