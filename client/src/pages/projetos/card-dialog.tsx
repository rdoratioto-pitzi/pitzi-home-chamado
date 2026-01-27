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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon, Tag, User as UserIcon, Clock, Paperclip, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User, KanbanCard, KanbanComment } from "@shared/schema";
import { useEffect, useState } from "react";

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
  readOnly?: boolean;
}

export function CardDialog({ open, onOpenChange, projectId, columnId, cardId, readOnly = false }: CardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [availableTags, setAvailableTags] = useState(["Tech", "Design", "Bug", "Feature"]);
  const [newTag, setNewTag] = useState("");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: cardData } = useQuery<KanbanCard>({
    queryKey: ["/api/cards", cardId],
    enabled: !!cardId,
  });

  const { data: comments = [] } = useQuery<KanbanComment[]>({
    queryKey: ["/api/cards", cardId, "comments"],
    enabled: !!cardId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      objectives: "",
      development: "",
      assigneeId: "admin",
      reporterId: "admin",
      priority: "normal",
      estimation: 0,
      startDate: "",
      endDate: "",
      tag: "",
    },
  });

  useEffect(() => {
    if (cardData) {
      form.reset({
        title: cardData.title,
        objectives: cardData.objectives || "",
        development: cardData.development || "",
        assigneeId: cardData.assigneeId || "admin",
        reporterId: cardData.reporterId || "admin",
        priority: cardData.priority,
        estimation: cardData.estimation || 0,
        startDate: cardData.startDate ? new Date(cardData.startDate).toISOString().split('T')[0] : "",
        endDate: cardData.endDate ? new Date(cardData.endDate).toISOString().split('T')[0] : "",
        tag: cardData.tags?.[0] || "",
      });
    } else {
      form.reset({
        title: "",
        objectives: "",
        development: "",
        assigneeId: "admin",
        reporterId: "admin",
        priority: "normal",
        estimation: 0,
        startDate: "",
        endDate: "",
        tag: "",
      });
    }
  }, [cardData, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        projectId,
        columnId,
        code: cardData?.code || `REN-${Math.floor(Math.random() * 1000)}`,
        tags: data.tag ? [data.tag] : [],
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        order: cardData?.order || 0,
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
        userId: "admin",
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
            {cardId && !readOnly && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive hover:bg-destructive/10"
                onClick={() => deleteMutation.mutate()}
                data-testid="button-delete-card"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
                          <Textarea
                            placeholder="Descreva os objetivos deste card..."
                            className="min-h-[100px]"
                            data-testid="input-card-objectives"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="development"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desenvolvimento</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva o desenvolvimento técnico..."
                            className="min-h-[100px]"
                            data-testid="input-card-development"
                            {...field}
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
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Adicionar um comentário..." 
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                          />
                          <Button 
                            type="button" 
                            size="sm" 
                            onClick={() => commentMutation.mutate(newComment)}
                            disabled={!newComment || commentMutation.isPending}
                          >
                            Enviar
                          </Button>
                        </div>
                      )}
                      <div className="space-y-3 max-h-[200px] overflow-y-auto">
                        {[...comments].sort((a, b) => 
                          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
                        ).map((comment) => {
                          const user = users.find(u => u.id === comment.userId);
                          return (
                            <div key={comment.id} className="bg-muted/30 p-3 rounded-lg text-sm border-l-2 border-primary/50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                    <UserIcon className="h-3 w-3 text-primary" />
                                  </div>
                                  <span className="font-semibold text-sm">{user?.name || "Usuário"}</span>
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
                              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
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
                            {users.map(u => (
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
                            {users.map(u => (
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
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full justify-start text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(new Date(field.value), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full justify-start text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(new Date(field.value), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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

                  <div className="pt-4">
                    <Button type="button" variant="outline" className="w-full justify-start gap-2 h-9">
                      <Paperclip className="h-4 w-4" /> Anexar arquivos
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/20">
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
