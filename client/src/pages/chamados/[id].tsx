import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RichTextarea } from "@/components/rich-textarea";
import { RichContent } from "@/components/rich-content";
import { UserSelect } from "@/components/ui/user-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Send, Clock, Calendar, MessageSquare, CheckCircle, XCircle, Edit2, Check, X, HelpCircle, Loader2, Save, Maximize2, Video, FileText, FileSpreadsheet, File, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { Ticket, TicketCommentWithUser, User, Setting } from "@shared/schema";

type TicketWithNames = Ticket & { requesterName: string | null; assigneeName: string | null };
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

const statusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400",
  resolved: "bg-green-500/10 text-green-600 dark:text-green-400",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  blocked: "Bloqueado",
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

const typeLabels: Record<string, string> = {
  bug: "Bug",
  melhoria: "Melhoria",
  negocio: "Negócio",
};

// Helper function to format datetime in Brazilian format
const formatDateTime = (date: Date | string | null): string => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

interface FieldItem {
  value: string;
  label: string;
}

const defaultCategories: FieldItem[] = [
  { value: "tech", label: "Tech" },
  { value: "rh", label: "Recursos Humanos" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacoes", label: "Operações" },
  { value: "comercial", label: "Comercial" },
  { value: "outros", label: "Outros" },
];

const defaultTypes: FieldItem[] = [
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
  { value: "negocio", label: "Negócio" },
];

const defaultLocations: FieldItem[] = [
  { value: "RS", label: "RS" },
  { value: "RG", label: "RG" },
  { value: "Dash", label: "Dash" },
  { value: "One", label: "One" },
  { value: "Home", label: "Home" },
  { value: "Omie", label: "Omie" },
  { value: "Outros", label: "Outros" },
];

const editFormSchema = z.object({
  title: z.string().min(10, "Título deve ter no mínimo 10 caracteres"),
  description: z.string()
    .min(20, "Descrição deve ter no mínimo 20 caracteres")
    .max(5000, "Descrição deve ter no máximo 5.000 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
  type: z.string().min(1, "Selecione um tipo"),
  location: z.string().min(1, "Selecione um local"),
  priority: z.string().min(1, "Selecione uma prioridade"),
  impact: z.string().min(1, "Selecione o impacto"),
  assigneeId: z.string().optional(),
  status: z.string().min(1, "Selecione o status"),
});

type EditFormData = z.infer<typeof editFormSchema>;

export default function TicketDetailPage() {
  const params = useParams();
  const id = params.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [comment, setComment] = useState("");
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedAttachments, setEditedAttachments] = useState<{ name: string; url: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch ticket
  const { data: ticket, isLoading: ticketLoading } = useQuery<TicketWithNames>({
    queryKey: ["/api/tickets", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${id}`);
      if (!res.ok) throw new Error("Failed to fetch ticket");
      return res.json();
    },
  });

  // Fetch users only when editing (needed for UserSelect dropdown)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isEditing,
  });

  // Fetch comments
  const { data: comments = [] } = useQuery<TicketCommentWithUser[]>({
    queryKey: ["/api/tickets", id, "comments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${id}/comments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Settings for dropdowns
  const { data: categoriesSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_categories"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_categories");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: typesSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_types"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_types");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: locationsSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_locations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_locations");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helper function to safely parse JSON with fallback
  const safeParseJSON = (value: string | null | undefined, fallback: FieldItem[]): FieldItem[] => {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item: FieldItem) => item.value && item.value.trim() !== "");
      }
      return fallback;
    } catch (e) {
      console.error("Error parsing setting value:", e);
      return fallback;
    }
  };

  // Helper to parse settings with fallback to defaults
  const parseSettingWithFallback = (settingValue: string | null | undefined, defaults: FieldItem[]): FieldItem[] => {
    if (!settingValue) return defaults;
    try {
      const parsed = JSON.parse(settingValue);
      if (!Array.isArray(parsed) || parsed.length === 0) return defaults;
      const filtered = parsed.filter((item: FieldItem) => item.value && item.value.trim() !== "");
      return filtered.length > 0 ? filtered : defaults;
    } catch {
      return defaults;
    }
  };

  const categories = parseSettingWithFallback(categoriesSetting?.value, defaultCategories);
  const types = parseSettingWithFallback(typesSetting?.value, defaultTypes);
  const locations = parseSettingWithFallback(locationsSetting?.value, defaultLocations);

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      type: "",
      location: "",
      priority: "medium",
      impact: "medio",
      assigneeId: "",
      status: "open",
    },
  });

  // Reset form when ticket data loads
  useEffect(() => {
    if (ticket) {
      editForm.reset({
        title: ticket.title,
        description: ticket.description || "",
        category: ticket.category,
        type: ticket.type || "",
        location: ticket.location || "",
        priority: ticket.priority,
        impact: ticket.impact || "medio",
        assigneeId: ticket.assigneeId || "",
        status: ticket.status,
      });
      setEditedDescription(ticket.description || "");
      try {
        const rawAttachments = ticket.attachments ? JSON.parse(ticket.attachments) : [];
        // Convert old format (string URLs) to new format (objects with name and url)
        const attachments = rawAttachments.map((a: string | { name: string; url: string }, i: number) => {
          if (typeof a === 'string') {
            return { name: `Arquivo_${i + 1}`, url: a };
          }
          return a;
        });
        setEditedAttachments(attachments);
      } catch {
        setEditedAttachments([]);
      }
    }
  }, [ticket, editForm]);

  // Error handling for media preview
  const [mediaError, setMediaError] = useState<Record<number, boolean>>({});

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Ticket>) => {
      const res = await apiRequest("PATCH", `/api/tickets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Chamado atualizado com sucesso!" });
      setIsEditing(false);
    },
    onError: (error: { message?: string; error?: string }) => {
      const errorMessage = error?.message || error?.error || "Erro ao atualizar chamado";
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (data: { content: string; images?: string[] }) => {
      const res = await apiRequest("POST", `/api/tickets/${id}/comments`, {
        ...data,
        userId: currentUser?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id, "comments"] });
      setComment("");
      setCommentImages([]);
      toast({ title: "Comentário adicionado!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar comentário", variant: "destructive" });
    },
  });

  const handleSave = (data?: EditFormData) => {
    if (data) {
      // Validação client-side: verificar se tem responsável antes de mudar para resolved/closed/blocked
      const finalAssigneeId = data.assigneeId || ticket?.assigneeId;
      if (!finalAssigneeId && ["resolved", "closed", "blocked"].includes(data.status)) {
        toast({
          title: "Atenção",
          description: "Não é possível alterar o status para '" +
            (data.status === "resolved" ? "Resolvido" : data.status === "closed" ? "Fechado" : "Bloqueado") +
            "' sem um responsável atribuído ao chamado.",
          variant: "destructive",
        });
        return;
      }
      // Save details form
      updateMutation.mutate({
        ...data,
        description: editedDescription,
        // editedAttachments is already an array of objects with name and url
        attachments: editedAttachments.length > 0 ? JSON.stringify(editedAttachments) : null,
      });
    } else {
      // Save just description/attachments
      updateMutation.mutate({
        description: editedDescription,
        attachments: editedAttachments.length > 0 ? JSON.stringify(editedAttachments) : null,
      });
    }
    setIsEditing(false);
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    commentMutation.mutate({ content: comment, images: commentImages });
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const timeOpenInfo = ticket ? getTimeOpenInfo(ticket.createdAt) : { text: "-", colorClass: "" };

  if (ticketLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chamados")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2"></div>
            <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chamados")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader title="Chamado não encontrado" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">O chamado solicitado não foi encontrado.</p>
            <Button className="mt-4" onClick={() => setLocation("/chamados")}>
              Voltar para Chamados
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requesterName = ticket.requesterName || "N/A";
  const assigneeName = ticket.assigneeName || "Não atribuído";

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-ticket-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/chamados")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{ticket.code}</h1>
            <Badge className={statusColors[ticket.status]}>
              {statusLabels[ticket.status] || ticket.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Criado em {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <Button
          variant={isEditing ? "default" : "outline"}
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Chamado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleSave)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {types.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Local</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {locations.map(loc => (
                                  <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prioridade</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="critical">Crítica</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="impact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Impacto</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="baixo">Baixo</SelectItem>
                                <SelectItem value="medio">Médio</SelectItem>
                                <SelectItem value="alto">Alto</SelectItem>
                                <SelectItem value="critico">Crítico</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="open">Aberto</SelectItem>
                                <SelectItem value="in_progress">Em Andamento</SelectItem>
                                <SelectItem value="blocked">Bloqueado</SelectItem>
                                <SelectItem value="resolved">Resolvido</SelectItem>
                                <SelectItem value="closed">Fechado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="assigneeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsável</FormLabel>
                            <FormControl>
                              <UserSelect
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecione..."
                                emptyMessage="Nenhum usuário encontrado"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Description and Attachments in Edit Mode */}
                    <div className="space-y-3 pt-4 border-t">
                      <FormLabel>Descrição</FormLabel>
                      <RichTextarea
                        value={editedDescription}
                        onChange={setEditedDescription}
                        attachments={editedAttachments}
                        onAttachmentsChange={setEditedAttachments}
                        className="min-h-[200px]"
                      />
                    </div>
                    
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Salvar Alterações
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-semibold mb-2">{ticket.title}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline">{categories.find(c => c.value === ticket.category)?.label || ticket.category}</Badge>
                    <Badge variant="outline">{typeLabels[ticket.type as keyof typeof typeLabels] || ticket.type}</Badge>
                    <Badge variant="outline">{locations.find(l => l.value === ticket.location)?.label || ticket.location}</Badge>
                    <Badge variant="outline">{priorityLabels[ticket.priority as keyof typeof priorityLabels]}</Badge>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <RichContent content={ticket.description || "Sem descrição"} />
                  </div>
                  
                  {/* Attachments Display */}
                  {ticket.attachments && !isEditing && (
                    <div className="space-y-2 mt-4">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Anexos
                      </h4>
                      {(() => {
                        try {
                          const attachments = JSON.parse(ticket.attachments);
                          if (Array.isArray(attachments) && attachments.length > 0) {
                            return (
                              <div className="grid grid-cols-2 gap-2">
                                {attachments.map((attachment: string | { name: string; url: string }, i: number) => {
                                  // Handle both old format (string URL) and new format (object with name and url)
                                  const url = typeof attachment === 'string' ? attachment : attachment.url;
                                  const fileName = typeof attachment === 'object' && attachment.name ? attachment.name : null;
                                  if (!url || typeof url !== 'string') return null;
                                  const isVideo = url.startsWith("data:video/") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");
                                  const isImage = url.startsWith("data:image/") || url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".png") || url.endsWith(".gif") || url.endsWith(".webp");
                                  const isPdf = url.startsWith("data:application/pdf") || url.endsWith(".pdf");
                                  const isExcel = url.startsWith("data:application/vnd.ms-excel") || url.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheet") || url.startsWith("data:text/csv") || url.endsWith(".xlsx") || url.endsWith(".xls") || url.endsWith(".csv");
                                  
                                  if (isImage || isVideo) {
                                    return (
                                      <Dialog key={i}>
                                        <DialogTrigger asChild>
                                          <div className="relative group rounded-md overflow-hidden border aspect-video bg-muted/50 flex items-center justify-center cursor-pointer" data-testid={`attachment-media-${i}`}>
                                            {mediaError[i] ? (
                                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <FileText className="h-8 w-8" />
                                                <span className="text-xs">Erro ao carregar</span>
                                              </div>
                                            ) : isVideo ? (
                                              <video
                                                src={url}
                                                className="max-w-full max-h-full object-contain"
                                                onError={() => setMediaError(prev => ({ ...prev, [i]: true }))}
                                              />
                                            ) : (
                                              <img
                                                src={url}
                                                alt="Anexo"
                                                className="max-w-full max-h-full object-contain"
                                                onError={() => setMediaError(prev => ({ ...prev, [i]: true }))}
                                              />
                                            )}
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                              {isVideo ? <Video className="h-6 w-6 text-white" /> : <Maximize2 className="h-6 w-6 text-white" />}
                                            </div>
                                            {isVideo && !mediaError[i] && (
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
                                          {mediaError[i] ? (
                                            <div className="flex flex-col items-center gap-4 text-white">
                                              <FileText className="h-16 w-16" />
                                              <span>Erro ao carregar mídia</span>
                                            </div>
                                          ) : isVideo ? (
                                            <video
                                              src={url}
                                              controls
                                              autoPlay
                                              className="max-w-full max-h-full"
                                              onError={() => setMediaError(prev => ({ ...prev, [i]: true }))}
                                            />
                                          ) : (
                                            <img
                                              src={url}
                                              alt="Preview"
                                              className="max-w-full max-h-full object-contain"
                                              onError={() => setMediaError(prev => ({ ...prev, [i]: true }))}
                                            />
                                          )}
                                        </DialogContent>
                                      </Dialog>
                                    );
                                  }

                                  const getFileName = () => {
                                    // If we have the actual filename from the object format, use it
                                    if (fileName) return fileName;
                                    // Otherwise, extract from MIME type (backwards compatibility)
                                    const mimeMatch = url.match(/^data:([^;]+);/);
                                    if (mimeMatch) {
                                      const mime = mimeMatch[1];
                                      const extMap: Record<string, string> = {
                                        "application/pdf": "pdf",
                                        "application/vnd.ms-excel": "xls",
                                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
                                        "text/csv": "csv",
                                        "application/msword": "doc",
                                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
                                      };
                                      const ext = extMap[mime] || mime.split('/')[1] || "arquivo";
                                      return `arquivo_${i + 1}.${ext}`;
                                    }
                                    return `arquivo_${i + 1}`;
                                  };

                                  const getFileIcon = () => {
                                    if (isPdf) return <FileText className="h-8 w-8 text-red-500" />;
                                    if (isExcel) return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
                                    return <File className="h-8 w-8 text-blue-500" />;
                                  };

                                  return (
                                    <a
                                      key={i}
                                      href={url}
                                      download={getFileName()}
                                      className="flex items-center gap-2 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                                    >
                                      {getFileIcon()}
                                      <span className="text-sm truncate flex-1">{getFileName()}</span>
                                      <Download className="h-4 w-4 text-muted-foreground" />
                                    </a>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comentários ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum comentário ainda.</p>
              ) : (
                comments.map((c) => {
                  return (
                    <div key={c.id} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(c.author?.name || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.author?.name || "Usuário"}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert">
                          <RichContent content={c.content} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              
              <Separator />
              
              <div className="space-y-3">
                <Textarea
                  placeholder="Adicione um comentário..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={handleAddComment} 
                  disabled={!comment.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar Comentário
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={statusColors[ticket.status]}>
                  {statusLabels[ticket.status] || ticket.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tempo Aberto</span>
                <span className={`text-sm font-medium ${timeOpenInfo.colorClass}`}>
                  {timeOpenInfo.text}
                </span>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Solicitante</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {getInitials(requesterName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{requesterName}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Responsável</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {getInitials(assigneeName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{assigneeName}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Criado em</span>
                  <p className="text-sm mt-1">{formatDateTime(ticket.createdAt)}</p>
                </div>

                {ticket.dataResolucao && (
                  <div>
                    <span className="text-xs text-muted-foreground">Resolvido em</span>
                    <p className="text-sm mt-1">{formatDateTime(ticket.dataResolucao)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
