import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RichTextarea } from "@/components/rich-textarea";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Archive,
  FileText,
  MoreHorizontal,
  Send,
  Smile,
  Paperclip,
  MessageSquare,
  User,
  Users,
  Edit,
  Trash2,
  Save,
  X,
  Download,
  ArrowRight,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskComment, TaskReaction, TaskArea, User as UserType } from "@shared/schema";

const statusConfig = {
  todo: { label: "A Fazer", icon: Circle, color: "bg-gray-100 text-gray-700" },
  doing: { label: "Em Andamento", icon: Clock, color: "bg-blue-100 text-blue-700" },
  done: { label: "Concluído", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  archived: { label: "Arquivado", icon: Archive, color: "bg-gray-100 text-gray-500" },
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
  agenda?: string;
  discussions?: string;
  decisions?: string[];
  actions?: Array<{ description: string; responsible: string; deadline: string }>;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [editedMeetingData, setEditedMeetingData] = useState<MeetingData>({});
  const [editedAttachments, setEditedAttachments] = useState<string[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);

  const { data: task, isLoading } = useQuery<Task>({
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
    queryKey: ["/api/task-areas"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  useEffect(() => {
    if (task) {
      setEditedTask(task);
      if (task.meetingData) {
        try {
          setEditedMeetingData(JSON.parse(task.meetingData));
        } catch {
          setEditedMeetingData({});
        }
      }
      if (task.attachments) {
        try {
          setEditedAttachments(JSON.parse(task.attachments));
        } catch {
          setEditedAttachments([]);
        }
      }
    }
  }, [task]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      return apiRequest("PUT", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsEditing(false);
      toast({ title: "Tarefa atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar tarefa", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      navigate("/tarefas");
      toast({ title: "Tarefa excluída!" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; parentCommentId?: string }) => {
      return apiRequest("POST", `/api/tasks/${id}/comments`, {
        ...data,
        authorId: "admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", id, "comments"] });
      setNewComment("");
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
      ...editedTask,
      attachments: JSON.stringify(editedAttachments),
      meetingData: task?.type === "meeting_note" ? JSON.stringify(editedMeetingData) : undefined,
    };
    updateTaskMutation.mutate(data);
  };

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate({
      content: newComment,
      parentCommentId: replyingTo || undefined,
    });
  };

  const convertActionToTask = async (action: { description: string; responsible: string; deadline: string }, _index: number) => {
    try {
      const responsibleUser = users.find(u => u.name.toLowerCase() === action.responsible.toLowerCase());
      await apiRequest("POST", "/api/tasks", {
        title: action.description,
        description: `Ação originada da reunião: ${task?.title}`,
        type: "task",
        status: "todo",
        priority: "medium",
        areaId: task?.areaId,
        createdBy: "admin",
        assigneeId: responsibleUser?.id || undefined,
        dueDate: action.deadline || null,
        parentTaskId: task?.id,
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
    const meeting = editedMeetingData;
    
    doc.setFontSize(18);
    doc.setTextColor(0, 161, 55);
    doc.text("Renov Home - Agenda de Reunião", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(task?.title || "Reunião", 14, 32);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    let yPos = 45;
    
    doc.text(`Data: ${meeting.date || "-"}`, 14, yPos);
    doc.text(`Horário: ${meeting.time || "-"}`, 80, yPos);
    yPos += 8;
    doc.text(`Local: ${meeting.location || "-"}`, 14, yPos);
    yPos += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("Participantes:", 14, yPos);
    yPos += 6;
    doc.setFontSize(10);
    const participantNames = meeting.participants?.map(p => {
      const user = users.find(u => u.id === p);
      return user?.name || p;
    }).join(", ") || "-";
    doc.text(participantNames, 14, yPos);
    yPos += 12;
    
    doc.setFontSize(12);
    doc.text("Pauta:", 14, yPos);
    yPos += 6;
    doc.setFontSize(10);
    const agendaLines = doc.splitTextToSize(meeting.agenda || "Nenhuma pauta definida", 180);
    doc.text(agendaLines, 14, yPos);
    yPos += agendaLines.length * 5 + 10;
    
    if (meeting.actions?.length) {
      doc.setFontSize(12);
      doc.text("Ações:", 14, yPos);
      yPos += 8;
      
      const tableData = meeting.actions.map((action) => [
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
    
    doc.save(`reuniao-${task?.id?.slice(0, 8)}.pdf`);
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

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-muted-foreground mb-4">Tarefa não encontrada</div>
        <Button onClick={() => navigate("/tarefas")}>Voltar</Button>
      </div>
    );
  }

  const taskArea = areas.find(a => a.id === task.areaId);
  const status = statusConfig[task.status as keyof typeof statusConfig];
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig];
  const StatusIcon = status?.icon || Circle;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tarefas")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            {taskArea && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: taskArea.color || "#00A137" }} />
                {taskArea.visibility === "shared" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                <span>{taskArea.name}</span>
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
                <Button onClick={handleSave} disabled={updateTaskMutation.isPending} data-testid="button-save-task">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-task">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="button-task-actions">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => deleteTaskMutation.mutate()}
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
                const nextStatus = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
                updateTaskMutation.mutate({ status: nextStatus });
              }}
              className="mt-1"
              data-testid="button-toggle-status"
            >
              <StatusIcon className={`h-6 w-6 ${
                task.status === "done" ? "text-green-500" : 
                task.status === "doing" ? "text-blue-500" : "text-gray-400"
              }`} />
            </button>
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTask.title || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                  className="text-xl font-semibold mb-2"
                  data-testid="input-edit-title"
                />
              ) : (
                <h1 className={`text-xl font-semibold mb-2 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </h1>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  {task.type === "meeting_note" ? (
                    <>
                      <FileText className="h-3 w-3 mr-1" />
                      Reunião
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Tarefa
                    </>
                  )}
                </Badge>
                {isEditing ? (
                  <Select
                    value={editedTask.status || task.status}
                    onValueChange={(v) => setEditedTask({ ...editedTask, status: v })}
                  >
                    <SelectTrigger className="w-36 h-7" data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">A Fazer</SelectItem>
                      <SelectItem value="doing">Em Andamento</SelectItem>
                      <SelectItem value="done">Concluído</SelectItem>
                      <SelectItem value="archived">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={status?.color}>{status?.label}</Badge>
                )}
                {isEditing ? (
                  <Select
                    value={editedTask.priority || task.priority}
                    onValueChange={(v) => setEditedTask({ ...editedTask, priority: v })}
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
                {task.dueDate && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-3">Descrição</h3>
            {isEditing ? (
              <RichTextarea
                value={editedTask.description || ""}
                onChange={(value) => setEditedTask({ ...editedTask, description: value })}
                images={editedAttachments}
                onImagesChange={setEditedAttachments}
                placeholder="Adicione uma descrição..."
                rows={4}
                maxLength={1000}
                data-testid="input-edit-description"
              />
            ) : (
              <div>
                <p className="text-muted-foreground whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {task.description || "Nenhuma descrição"}
                </p>
                {task.attachments && JSON.parse(task.attachments).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                    {JSON.parse(task.attachments).map((url: string, index: number) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={url}
                          alt={`Anexo ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {task.type === "meeting_note" && (
            <div className="border-t border-border pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
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
                        value={editedMeetingData.date || ""}
                        onChange={(e) => setEditedMeetingData({ ...editedMeetingData, date: e.target.value })}
                        data-testid="input-meeting-date"
                      />
                    ) : (
                      <p className="mt-1">{editedMeetingData.date || "-"}</p>
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
                      placeholder="Nomes separados por vírgula"
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

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pauta</label>
                  {isEditing ? (
                    <div className="space-y-1">
                      <Textarea
                        value={editedMeetingData.agenda || ""}
                        onChange={(e) => setEditedMeetingData({ 
                          ...editedMeetingData, 
                          agenda: e.target.value
                        })}
                        placeholder="Pauta da reunião..."
                        rows={10}
                        maxLength={1000}
                        data-testid="input-meeting-agenda"
                      />
                      <div className="flex justify-end">
                        <span className="text-[10px] text-muted-foreground">
                          {(editedMeetingData.agenda || "").length}/1000
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {editedMeetingData.agenda || <span className="text-muted-foreground">Nenhuma pauta definida</span>}
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
                                const newActions = (editedMeetingData.actions || []).filter((_, idx) => idx !== i);
                                setEditedMeetingData({ ...editedMeetingData, actions: newActions });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newActions = [...(editedMeetingData.actions || []), { description: "", responsible: "", deadline: "" }];
                          setEditedMeetingData({ ...editedMeetingData, actions: newActions });
                        }}
                        data-testid="button-add-action"
                      >
                        + Adicionar Ação
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {editedMeetingData.actions?.length ? (
                        editedMeetingData.actions.map((action, i) => (
                          <div key={i} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                            <span className="flex-1">{action.description}</span>
                            {action.responsible && (
                              <Badge variant="outline">{action.responsible}</Badge>
                            )}
                            {action.deadline && (
                              <Badge variant="outline">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(action.deadline).toLocaleDateString("pt-BR")}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => convertActionToTask(action, i)}
                              data-testid={`button-convert-action-${i}`}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
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
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comentários ({comments.length})
          </h3>

          <div className="space-y-4 mb-6">
            {rootComments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum comentário ainda. Seja o primeiro a comentar!
              </p>
            ) : (
              rootComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replies={getReplies(comment.id)}
                  onReply={() => setReplyingTo(comment.id)}
                  onReact={(emoji) => addReactionMutation.mutate({ commentId: comment.id, emoji })}
                  users={users}
                />
              ))
            )}
          </div>

          <div className="border-t border-border pt-4">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <span>Respondendo a um comentário</span>
                <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">AD</AvatarFallback>
              </Avatar>
              <div className="flex-1 relative">
                <Textarea
                  value={newComment}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewComment(value);
                    
                    const cursorPos = e.target.selectionStart;
                    const textBeforeCursor = value.slice(0, cursorPos);
                    const atMatch = textBeforeCursor.match(/@(\w*)$/);
                    
                    if (atMatch) {
                      setMentionQuery(atMatch[1].toLowerCase());
                      setMentionPosition(cursorPos - atMatch[0].length);
                      setShowMentionSuggestions(true);
                    } else {
                      setShowMentionSuggestions(false);
                    }
                  }}
                  placeholder="Adicione um comentário... Use @nome para mencionar alguém"
                  rows={2}
                  className="resize-none mb-2"
                  data-testid="input-new-comment"
                />
                {showMentionSuggestions && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-32 overflow-y-auto">
                    {users
                      .filter(u => u.name.toLowerCase().includes(mentionQuery) || u.email.toLowerCase().includes(mentionQuery))
                      .slice(0, 5)
                      .map(user => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                          onClick={() => {
                            const before = newComment.slice(0, mentionPosition);
                            const after = newComment.slice(mentionPosition + mentionQuery.length + 1);
                            setNewComment(`${before}@${user.name} ${after}`);
                            setShowMentionSuggestions(false);
                          }}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{user.name}</span>
                          <span className="text-muted-foreground text-xs">({user.email})</span>
                        </button>
                      ))}
                    {users.filter(u => u.name.toLowerCase().includes(mentionQuery)).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                      <Smile className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || createCommentMutation.isPending}
                    data-testid="button-submit-comment"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CommentItem({ 
  comment, 
  replies, 
  onReply, 
  onReact,
  users,
  isReply = false 
}: { 
  comment: TaskComment; 
  replies: TaskComment[];
  onReply: () => void;
  onReact: (emoji: string) => void;
  users: UserType[];
  isReply?: boolean;
}) {
  const author = users.find(u => u.id === comment.authorId);
  
  return (
    <div className={`${isReply ? "ml-10 mt-3" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {author?.name?.slice(0, 2).toUpperCase() || "??"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{author?.name || "Usuário"}</span>
            <span className="text-xs text-muted-foreground">
              {comment.createdAt ? new Date(comment.createdAt).toLocaleString("pt-BR") : ""}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-2 mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Smile className="h-3 w-3 mr-1" />
                  Reagir
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="flex gap-1">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      className="hover:bg-muted p-1 rounded"
                      onClick={() => onReact(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {!isReply && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onReply}>
                <MessageSquare className="h-3 w-3 mr-1" />
                Responder
              </Button>
            )}
          </div>
        </div>
      </div>
      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          replies={[]}
          onReply={() => {}}
          onReact={(emoji) => onReact(emoji)}
          users={users}
          isReply
        />
      ))}
    </div>
  );
}
