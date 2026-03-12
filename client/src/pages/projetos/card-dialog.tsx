import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextarea } from "@/components/rich-textarea";
import { RichContent } from "@/components/rich-content";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon, Tag, User as UserIcon, Clock, Paperclip, MessageSquare, Plus, Trash2, X, FileIcon, Image, Loader2, GitBranch, ListTree, CheckSquare, Palette, Link2, Lock, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User, KanbanCard, KanbanComment, KanbanCommentWithUser, KanbanLabel, KanbanCardDependency } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState, useRef } from "react";
import { useUpload } from "@/hooks/use-upload";

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  objectives: z.string().optional(),
  development: z.string().optional(),
  assigneeId: z.string().optional(),
  reporterId: z.string().optional(),
  priority: z.string().default("normal"),
  estimation: z.preprocess((val) => Number(val), z.number().optional()),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tag: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columnId: string;
  cardId?: string;
  parentCardId?: string;
  readOnly?: boolean;
}

interface Attachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export function CardDialog({ open, onOpenChange, projectId, columnId, cardId, parentCardId, readOnly = false }: CardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [objectivesImages, setObjectivesImages] = useState<string[]>([]);
  const [developmentImages, setDevelopmentImages] = useState<string[]>([]);


  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const activeUsers = users.filter(u => u.status === "active");
  const filteredUsers = activeUsers
    .filter(u => u.name.toLowerCase().includes(mentionFilter.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    
    const lastAtPos = value.lastIndexOf("@");
    if (lastAtPos !== -1 && (lastAtPos === 0 || value[lastAtPos - 1] === " ")) {
      const query = value.slice(lastAtPos + 1);
      if (!query.includes(" ")) {
        setMentionFilter(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (userName: string) => {
    const lastAtPos = newComment.lastIndexOf("@");
    const prefix = newComment.slice(0, lastAtPos);
    setNewComment(`${prefix}@${userName} `);
    setShowMentions(false);
  };
  const [availableTags, setAvailableTags] = useState(["Tech", "Design", "Bug", "Feature"]);
  const [newTag, setNewTag] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Labels state
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");

  // Card status state
  const [cardStatus, setCardStatus] = useState<"todo" | "doing" | "done">("todo");

  // Dependencies state
  const [depBlockingCardId, setDepBlockingCardId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setAttachments(prev => [...prev, {
        name: response.metadata.name,
        path: response.objectPath,
        size: response.metadata.size,
        type: response.metadata.contentType,
      }]);
      toast({ title: "Arquivo anexado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao anexar arquivo", description: error.message, variant: "destructive" });
    },
  });


  const { data: cardData } = useQuery<KanbanCard>({
    queryKey: ["/api/cards", cardId],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${cardId}`);
      if (!res.ok) throw new Error("Failed to fetch card");
      return res.json();
    },
    enabled: !!cardId,
  });

  const { data: allProjectCards = [] } = useQuery<KanbanCard[]>({
    queryKey: ["/api/projects", projectId, "cards"],
    enabled: !!projectId,
  });

  const subtasks = allProjectCards.filter(c => c.parentCardId === cardId);
  const parentOptions = allProjectCards.filter(c => !c.parentCardId && c.id !== cardId);

  const { data: comments = [] } = useQuery<KanbanCommentWithUser[]>({
    queryKey: ["/api/cards", cardId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!cardId,
  });

  const { data: projectLabels = [] } = useQuery<KanbanLabel[]>({
    queryKey: ["/api/projects", projectId, "labels"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/labels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: cardDependencies } = useQuery<{ blockedBy: KanbanCardDependency[]; blocks: KanbanCardDependency[] }>({
    queryKey: ["/api/cards", cardId, "dependencies"],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/dependencies`);
      if (!res.ok) return { blockedBy: [], blocks: [] };
      return res.json();
    },
    enabled: !!cardId,
  });

  const createLabelMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) =>
      apiRequest("POST", `/api/projects/${projectId}/labels`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "labels"] });
      setNewLabelName("");
    },
  });

  const addDependencyMutation = useMutation({
    mutationFn: async (blockingCardId: string) =>
      apiRequest("POST", `/api/cards/${cardId}/dependencies`, { blockingCardId, blockedCardId: cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", cardId, "dependencies"] });
      setDepBlockingCardId("");
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: async (depId: string) => apiRequest("DELETE", `/api/card-dependencies/${depId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cards", cardId, "dependencies"] }),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      objectives: "",
      development: "",
      assigneeId: "",
      reporterId: "",
      priority: "normal",
      estimation: 0,
      startDate: "",
      endDate: "",
      tag: "",
    },
  });

  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentCardId || null);

  // Função para extrair imagens base64 do HTML
  const extractImagesFromHtml = (html: string): string[] => {
    if (!html) return [];
    const imgRegex = /<img[^>]+src="(data:image\/[^"]+)"/g;
    const images: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    return images;
  };

  // Consolidado em um único useEffect com dependência apenas [cardId] para evitar loops
  useEffect(() => {
    if (open) {
      if (cardId && cardData) {
        form.reset({
          title: cardData.title,
          objectives: cardData.objectives ? String(cardData.objectives) : "",
          development: cardData.development ? String(cardData.development) : "",
          assigneeId: cardData.assigneeId || "",
          reporterId: cardData.reporterId || "",
          priority: cardData.priority,
          estimation: cardData.estimation || 0,
          startDate: cardData.startDate ? new Date(cardData.startDate).toISOString().split('T')[0] : "",
          endDate: cardData.endDate ? new Date(cardData.endDate).toISOString().split('T')[0] : "",
          tag: cardData.tags?.[0] || "",
        });
        
        // Extrair imagens dos campos HTML
        setObjectivesImages(extractImagesFromHtml(cardData.objectives ? String(cardData.objectives) : ""));
        setDevelopmentImages(extractImagesFromHtml(cardData.development ? String(cardData.development) : ""));
        
        if (cardData.attachments && cardData.attachments.length > 0) {
          setAttachments(cardData.attachments.map((path: string) => ({
            name: path.split("/").pop() || "Arquivo",
            path,
          })));
        } else {
          setAttachments([]);
        }
        // Inicializar checklist
        try {
          setChecklist(cardData.checklist ? JSON.parse(cardData.checklist as unknown as string) : []);
        } catch { setChecklist([]); }
        // Inicializar labels selecionadas
        try {
          setSelectedLabelIds(cardData.labelIds ? JSON.parse(cardData.labelIds as unknown as string) : []);
        } catch { setSelectedLabelIds([]); }
        // Inicializar status do card
        setCardStatus((cardData.status as "todo" | "doing" | "done") || "todo");
        // Configurar parent card id
        if (cardData.parentCardId) {
          setSelectedParentId(cardData.parentCardId);
        } else if (parentCardId) {
          setSelectedParentId(parentCardId);
        } else {
          setSelectedParentId(null);
        }
      } else if (!cardId) {
        form.reset({
          title: "",
          objectives: "",
          development: "",
          assigneeId: "",
          reporterId: "",
          priority: "normal",
          estimation: 0,
          startDate: "",
          endDate: "",
          tag: "",
        });
        setAttachments([]);
        setObjectivesImages([]);
        setDevelopmentImages([]);
        setChecklist([]);
        setSelectedLabelIds([]);
        setCardStatus("todo");
        setSelectedParentId(parentCardId || null);
      }
    }
  }, [cardId, open, cardData]); // Apenas cardId como dependência para evitar loop de re-renders

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        title: data.title,
        objectives: data.objectives || "",
        development: data.development || "",
        assigneeId: data.assigneeId || "",
        reporterId: data.reporterId || "",
        priority: data.priority,
        estimation: data.estimation || 0,
        projectId,
        columnId,
        code: cardData?.code || `REN-${Math.floor(Math.random() * 1000)}`,
        tags: data.tag ? [data.tag] : [],
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        order: cardData?.order || 0,
        attachments: attachments.map(a => a.path),
        parentCardId: selectedParentId || null,
        checklist: JSON.stringify(checklist),
        labelIds: JSON.stringify(selectedLabelIds),
        status: cardStatus,
      };

      if (cardId) {
        return apiRequest("PATCH", `/api/cards/${cardId}`, payload);
      } else {
        return apiRequest("POST", "/api/cards", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "cards"] });
      toast({
        title: cardId ? "Card atualizado" : "Card criado",
        description: cardId ? "As alterações foram salvas." : "O card foi adicionado ao quadro.",
      });
      if (!cardId) form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o card.",
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/cards/${cardId}/comments`, {
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", cardId, "comments"] });
      setNewComment("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/cards/${cardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "cards"] });
      toast({ title: "Card excluído", description: "O card foi removido do quadro." });
      onOpenChange(false);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const handleAddTag = () => {
    if (newTag && !availableTags.includes(newTag)) {
      setAvailableTags([...availableTags, newTag]);
      form.setValue("tag", newTag);
      setNewTag("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono uppercase">
                {cardData?.code || "NOVO-CARD"}
              </Badge>
              <DialogTitle>{cardId ? (readOnly ? "Visualizar Card" : "Editar Card") : "Novo Card"}</DialogTitle>
              {readOnly && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                  Somente Leitura
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription>
            {readOnly 
              ? "Visualize os detalhes desta tarefa. Sprint finalizada - edição não permitida." 
              : (cardId ? "Visualize e edite os detalhes desta tarefa." : "Adicione uma nova tarefa ou item ao quadro.")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-6">
              <div className="grid grid-cols-3 gap-6 py-4">
                <div className="col-span-2 space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Implementar funcionalidade X" 
                            data-testid="input-card-title"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="objectives"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objetivos</FormLabel>
                        <FormControl>
                          <RichTextarea
                            key={`objectives-${cardId || 'new'}`}
                            placeholder="Descreva os objetivos deste card..."
                            className="min-h-[100px] card-editor"
                            data-testid="input-card-objectives"
                            value={field.value || ''}
                            onChange={(val) => field.onChange(val)}
                            images={objectivesImages}
                            onImagesChange={setObjectivesImages}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* CHECKLIST — entre Objetivos e Desenvolvimento */}
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">Checklist</h4>
                      {checklist.length > 0 && (
                        <span className={`ml-auto text-xs font-semibold ${checklist.filter(i=>i.done).length === checklist.length ? "text-green-600" : "text-muted-foreground"}`}>
                          {checklist.filter(i=>i.done).length}/{checklist.length}
                        </span>
                      )}
                    </div>
                    {checklist.length > 0 && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${(checklist.filter(i=>i.done).length / checklist.length) * 100}%` }}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {checklist.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group">
                          <Checkbox
                            checked={item.done}
                            disabled={readOnly}
                            onCheckedChange={(checked) =>
                              setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, done: !!checked } : i))
                            }
                          />
                          <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100"
                              onClick={() => setChecklist(prev => prev.filter(i => i.id !== item.id))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Novo item..."
                          value={newChecklistItem}
                          onChange={e => setNewChecklistItem(e.target.value)}
                          className="h-8 text-sm"
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newChecklistItem.trim()) {
                                setChecklist(prev => [...prev, { id: crypto.randomUUID(), text: newChecklistItem.trim(), done: false }]);
                                setNewChecklistItem("");
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => {
                            if (newChecklistItem.trim()) {
                              setChecklist(prev => [...prev, { id: crypto.randomUUID(), text: newChecklistItem.trim(), done: false }]);
                              setNewChecklistItem("");
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="development"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desenvolvimento</FormLabel>
                        <FormControl>
                          <RichTextarea
                            key={`development-${cardId || 'new'}`}
                            placeholder="Descreva o desenvolvimento técnico..."
                            className="min-h-[100px] card-editor-development"
                            data-testid="input-card-development"
                            value={field.value || ''}
                            onChange={(val) => field.onChange(val)}
                            images={developmentImages}
                            onImagesChange={setDevelopmentImages}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {cardId && (
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold">Comentários</h4>
                      </div>
                      {!readOnly && (
                        <div className="space-y-2">
                          <div className="flex gap-2 relative">
                            <RichTextarea
                              placeholder="Adicionar um comentário... Use @ para mencionar"
                              value={newComment}
                              onChange={handleCommentChange}
                              images={commentImages}
                              onImagesChange={setCommentImages}
                              className="min-h-[80px]"
                            />
                            {showMentions && filteredUsers.length > 0 && (
                              <div className="absolute bottom-full left-0 w-64 bg-popover border rounded-md shadow-md z-50 mb-1 max-h-48 overflow-y-auto">
                                {filteredUsers.map(user => (
                                  <button
                                    key={user.id}
                                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
                                    onClick={() => insertMention(user.name)}
                                  >
                                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                      <UserIcon className="h-3 w-3 text-primary" />
                                    </div>
                                    {user.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => commentMutation.mutate(newComment)}
                              disabled={!newComment.trim() || commentMutation.isPending}
                            >
                              Enviar
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-3 max-h-[200px] overflow-y-auto">
                        {[...comments].sort((a, b) => 
                          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
                        ).map((comment) => {
                          return (
                            <div key={comment.id} className="bg-muted/30 p-3 rounded-lg text-sm border-l-2 border-primary/50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                    <UserIcon className="h-3 w-3 text-primary" />
                                  </div>
                                  <span className="font-semibold text-sm">{comment.author?.name || "Usuário"}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(comment.createdAt!).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                              </div>
                              <RichContent content={comment.content || ''} />
                            </div>
                          );
                        })}
                        {comments.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum comentário ainda. Seja o primeiro a comentar!
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-l pl-6">
                  <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <UserIcon className="h-3 w-3" /> Responsável
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Responsável" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.filter(u => u.status === "active").sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reporterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relator</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Relator" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.filter(u => u.status === "active").sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={cardStatus} onValueChange={(v) => setCardStatus(v as "todo" | "doing" | "done")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">⬜ A Fazer</SelectItem>
                        <SelectItem value="doing">🔵 Em Andamento</SelectItem>
                        <SelectItem value="done">✅ Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Prioridade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="muito_urgente">Muito Urgente</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-3 w-3" /> Estimativa (Horas)
                        </FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data Início</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="date-picker-full"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data Fim</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="date-picker-full"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Tag className="h-3 w-3" /> Tag
                        </FormLabel>
                        <div className="flex gap-2 mb-2">
                          <Input 
                            placeholder="Nova tag..." 
                            value={newTag} 
                            onChange={(e) => setNewTag(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleAddTag}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar Tag" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTags.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-2">
                      <GitBranch className="h-3 w-3" /> Tarefa Pai
                    </label>
                    <Select
                      value={selectedParentId || "none"}
                      onValueChange={(val) => setSelectedParentId(val === "none" ? null : val)}
                      disabled={readOnly}
                    >
                      <SelectTrigger data-testid="select-parent-card">
                        <SelectValue placeholder="Nenhuma (tarefa principal)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma (tarefa principal)</SelectItem>
                        {parentOptions.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} - {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {cardId && subtasks.length > 0 && (
                    <Collapsible defaultOpen={subtasks.length <= 3}>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-medium hover:bg-muted/50 rounded px-1 py-1 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
                        <ListTree className="h-3 w-3" />
                        Subtarefas ({subtasks.length})
                        <ChevronDown className="chevron h-3 w-3 ml-auto transition-transform duration-200" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1 mt-2">
                        {subtasks.map(sub => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-xs cursor-pointer hover-elevate"
                            data-testid={`subtask-item-${sub.id}`}
                          >
                            <div className={`w-1.5 h-4 rounded-full flex-shrink-0 ${
                              sub.priority === "muito_urgente" ? "bg-red-500" : sub.priority === "urgente" ? "bg-orange-500" : "bg-blue-500"
                            }`} />
                            <span className="font-mono text-muted-foreground">{sub.code}</span>
                            <span className="flex-1 truncate">{sub.title}</span>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <Separator />

                  {/* LABELS */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-2">
                      <Palette className="h-3 w-3" /> Labels
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {projectLabels.map(label => {
                        const isSelected = selectedLabelIds.includes(label.id);
                        return (
                          <button
                            key={label.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() =>
                              setSelectedLabelIds(prev =>
                                isSelected ? prev.filter(id => id !== label.id) : [...prev, label.id]
                              )
                            }
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                              isSelected ? "opacity-100 ring-1 ring-offset-1 ring-current" : "opacity-60 hover:opacity-90"
                            }`}
                            style={{ backgroundColor: label.color + "22", borderColor: label.color, color: label.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                            {label.name}
                          </button>
                        );
                      })}
                    </div>
                    {!readOnly && (
                      <div className="flex gap-1 items-center">
                        <input
                          type="color"
                          value={newLabelColor}
                          onChange={e => setNewLabelColor(e.target.value)}
                          className="h-7 w-7 rounded border p-0.5 cursor-pointer"
                        />
                        <Input
                          placeholder="Nome da label..."
                          value={newLabelName}
                          onChange={e => setNewLabelName(e.target.value)}
                          className="h-7 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={!newLabelName.trim() || createLabelMutation.isPending}
                          onClick={() => createLabelMutation.mutate({ name: newLabelName.trim(), color: newLabelColor })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* DEPENDÊNCIAS */}
                  {cardId && (
                    <>
                      <Separator />
                      <Collapsible defaultOpen={((cardDependencies?.blockedBy ?? []).length + (cardDependencies?.blocks ?? []).length) <= 2}>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-medium hover:bg-muted/50 rounded px-1 py-1 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
                          <Lock className="h-3 w-3" />
                          Dependências ({(cardDependencies?.blockedBy ?? []).length + (cardDependencies?.blocks ?? []).length})
                          <ChevronDown className="chevron h-3 w-3 ml-auto transition-transform duration-200" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {(cardDependencies?.blockedBy ?? []).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bloqueado por:</p>
                              {cardDependencies!.blockedBy.map(dep => {
                                const blocker = allProjectCards.find(c => c.id === dep.blockingCardId);
                                return (
                                  <div key={dep.id} className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                                    <Lock className="h-2.5 w-2.5 text-red-500" />
                                    <span className="font-mono text-muted-foreground">{blocker?.code}</span>
                                    <span className="flex-1 truncate">{blocker?.title}</span>
                                    {!readOnly && (
                                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => removeDependencyMutation.mutate(dep.id)}>
                                        <X className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(cardDependencies?.blocks ?? []).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bloqueia:</p>
                              {cardDependencies!.blocks.map(dep => {
                                const blocked = allProjectCards.find(c => c.id === dep.blockedCardId);
                                return (
                                  <div key={dep.id} className="flex items-center gap-1 text-xs bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded px-2 py-1">
                                    <Link2 className="h-2.5 w-2.5 text-orange-500" />
                                    <span className="font-mono text-muted-foreground">{blocked?.code}</span>
                                    <span className="flex-1 truncate">{blocked?.title}</span>
                                    {!readOnly && (
                                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => removeDependencyMutation.mutate(dep.id)}>
                                        <X className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!readOnly && (
                            <div className="flex gap-1">
                              <Select value={depBlockingCardId} onValueChange={setDepBlockingCardId}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Bloqueado por..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {allProjectCards
                                    .filter(c => c.id !== cardId && !cardDependencies?.blockedBy.some(d => d.blockingCardId === c.id))
                                    .map(c => (
                                      <SelectItem key={c.id} value={c.id} className="text-xs">
                                        {c.code} — {c.title}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!depBlockingCardId || addDependencyMutation.isPending}
                                onClick={() => addDependencyMutation.mutate(depBlockingCardId)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  )}

                  <div className="pt-4 space-y-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadFile(file);
                          e.target.value = "";
                        }
                      }}
                      disabled={readOnly || isUploading}
                      data-testid="input-file-upload"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full justify-start gap-2 h-9"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={readOnly || isUploading}
                      data-testid="button-attach-file"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      {isUploading ? "Enviando..." : "Anexar arquivos"}
                    </Button>
                    
                    {attachments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Anexos ({attachments.length})</p>
                        <div className="space-y-1">
                          {attachments.map((att, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs">
                              {att.type?.startsWith("image/") ? (
                                <Image className="h-3 w-3 text-blue-500" />
                              ) : (
                                <FileIcon className="h-3 w-3 text-gray-500" />
                              )}
                              <span className="flex-1 truncate">{att.name}</span>
                              {!readOnly && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                  data-testid={`button-remove-attachment-${idx}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/20">
              <div className="flex items-center justify-between w-full">
                <div>
                  {cardId && !readOnly && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate()}
                      data-testid="button-delete-card"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir Card
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => onOpenChange(false)}
                  >
                    {readOnly ? "Fechar" : "Cancelar"}
                  </Button>
                  {!readOnly && (
                    <Button 
                      type="submit" 
                      disabled={mutation.isPending}
                      data-testid="button-submit-card"
                    >
                      {mutation.isPending ? "Salvando..." : (cardId ? "Salvar Alterações" : "Criar Card")}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
