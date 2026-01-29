import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import type { User, Setting, Ticket } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { HelpCircle, CheckCircle2, Plus, Eye } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(10, "Título deve ter no mínimo 10 caracteres"),
  description: z.string().min(20, "Descrição deve ter no mínimo 20 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
  type: z.string().min(1, "Selecione um tipo"),
  location: z.string().min(1, "Selecione um local"),
  priority: z.string().min(1, "Selecione uma prioridade"),
  impact: z.string().min(1, "Selecione o impacto"),
  assigneeId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FieldItem {
  value: string;
  label: string;
}

const defaultCategories: FieldItem[] = [
  { value: "ti", label: "TI / Infraestrutura" },
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

export function TicketDialog({ open, onOpenChange }: TicketDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

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

  const { data: locationsSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_locations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_locations");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const categories: FieldItem[] = (categoriesSetting?.value 
    ? JSON.parse(categoriesSetting.value) 
    : defaultCategories).filter((item: FieldItem) => item.value && item.value.trim() !== "");

  const types: FieldItem[] = (typesSetting?.value 
    ? JSON.parse(typesSetting.value) 
    : defaultTypes).filter((item: FieldItem) => item.value && item.value.trim() !== "");

  const locations: FieldItem[] = (locationsSetting?.value 
    ? JSON.parse(locationsSetting.value) 
    : defaultLocations).filter((item: FieldItem) => item.value && item.value.trim() !== "");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      type: "",
      location: "",
      priority: "medium",
      impact: "medio",
      assigneeId: "auto",
    },
  });

  const [attachments, setAttachments] = useState<string[]>([]);
  const descriptionValue = form.watch("description") || "";
  const titleValue = form.watch("title") || "";

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: Record<string, unknown> = {
        ...data,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        requesterId: "admin",
        status: "open",
        code: "",
      };
      if (!data.assigneeId || data.assigneeId === "auto") {
        delete payload.assigneeId;
      }
      const res = await apiRequest("POST", "/api/tickets", payload);
      return res.json();
    },
    onSuccess: (ticket: Ticket) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setCreatedTicket(ticket);
      setShowSuccess(true);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o chamado.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setCreatedTicket(null);
    form.reset();
    onOpenChange(false);
  };

  const handleCreateAnother = () => {
    setShowSuccess(false);
    setCreatedTicket(null);
    form.reset();
  };

  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      setCreatedTicket(null);
    }
  }, [open]);

  if (showSuccess && createdTicket) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px]">
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl mb-2">Chamado Criado com Sucesso!</DialogTitle>
            <DialogDescription className="mb-4">
              Seu chamado foi registrado e será analisado pela equipe responsável.
            </DialogDescription>
            <div className="bg-muted/50 px-4 py-3 rounded-lg mb-6">
              <span className="text-sm text-muted-foreground">Código do chamado</span>
              <p className="text-2xl font-bold font-mono text-primary">{createdTicket.code}</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCreateAnother}
                data-testid="button-create-another"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Outro
              </Button>
              <Button 
                className="flex-1"
                onClick={handleCloseSuccess}
                data-testid="button-view-ticket"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver Chamado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Chamado</DialogTitle>
          <DialogDescription>
            Preencha as informações para abrir um novo chamado de suporte. Campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Título <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Problema com acesso ao sistema (mínimo 10 caracteres)" 
                      data-testid="input-ticket-title"
                      aria-label="Título do chamado"
                      {...field} 
                    />
                  </FormControl>
                  <div className="flex justify-between items-center">
                    <FormMessage />
                    <span className={`text-xs ${titleValue.length >= 10 ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {titleValue.length}/10 caracteres
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Descrição <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <RichTextarea
                      placeholder="Descreva detalhadamente o problema ou solicitação... (mínimo 20 caracteres)"
                      value={field.value}
                      onChange={field.onChange}
                      images={attachments}
                      onImagesChange={setAttachments}
                      maxLength={1000}
                      data-testid="input-ticket-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Categoria <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-category" aria-label="Categoria">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Tipo <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-type" aria-label="Tipo">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {types.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Local <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-location" aria-label="Local">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.value} value={loc.value}>
                            {loc.label}
                          </SelectItem>
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
                    <FormLabel className="flex items-center gap-1">
                      Prioridade <span className="text-destructive">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[250px]">
                          <p className="text-xs">
                            <strong>Prioridade</strong> define a ordem de atendimento baseada na urgência do solicitante.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-priority" aria-label="Prioridade">
                          <SelectValue placeholder="Selecione" />
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="impact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Impacto <span className="text-destructive">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <p className="text-xs">
                            <strong>Impacto</strong> mede quantas pessoas ou processos são afetados pelo problema.<br/><br/>
                            <strong>Crítico:</strong> Toda a empresa<br/>
                            <strong>Alto:</strong> Departamento inteiro<br/>
                            <strong>Médio:</strong> Equipe ou grupo<br/>
                            <strong>Baixo:</strong> Apenas você
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-impact" aria-label="Impacto">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixo">Baixo - Apenas eu</SelectItem>
                        <SelectItem value="medio">Médio - Minha equipe</SelectItem>
                        <SelectItem value="alto">Alto - Meu departamento</SelectItem>
                        <SelectItem value="critico">Crítico - Toda a empresa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-assignee" aria-label="Responsável">
                          <SelectValue placeholder="Atribuição automática" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="auto">Atribuição automática</SelectItem>
                        {users.filter(u => u.status === "active").map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-ticket"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-submit-ticket"
              >
                {mutation.isPending ? "Criando..." : "Criar Chamado"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
