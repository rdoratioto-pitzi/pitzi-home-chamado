import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Setting, Ticket } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextarea } from "@/components/rich-textarea";
import { UserSelect } from "@/components/ui/user-select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { HelpCircle, CheckCircle2, ArrowLeft, Plus, Eye, Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";

const formSchema = z.object({
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
});

type FormData = z.infer<typeof formSchema>;

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

export default function NovoChamadoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);

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
      assigneeId: undefined,
    },
  });

  const descriptionValue = form.watch("description") || "";
  const titleValue = form.watch("title") || "";

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!currentUser?.id) {
        throw new Error("Usuário não autenticado");
      }
      const payload: Record<string, unknown> = {
        ...data,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        requesterId: currentUser.id,
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
      toast({
        title: "Sucesso!",
        description: `Chamado ${ticket.code} criado com sucesso.`,
      });
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

  const handleCreateAnother = () => {
    setShowSuccess(false);
    setCreatedTicket(null);
    setAttachments([]);
    form.reset();
  };

  const handleViewTicket = () => {
    if (createdTicket?.id) {
      setLocation(`/chamados/${createdTicket.id}`);
    }
  };

  if (showSuccess && createdTicket) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-xl mb-2">Chamado Criado com Sucesso!</CardTitle>
                <CardDescription className="mb-4">
                  Seu chamado foi registrado e será analisado pela equipe responsável.
                </CardDescription>
                <div className="bg-muted/50 px-4 py-3 rounded-lg mb-6">
                  <span className="text-sm text-muted-foreground">Código do chamado</span>
                  <p className="text-2xl font-bold font-mono text-primary">{createdTicket.code}</p>
                </div>
                <div className="flex gap-3 w-full max-w-md">
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
                    onClick={handleViewTicket}
                    data-testid="button-view-ticket"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Chamado
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  className="mt-4"
                  onClick={() => setLocation("/chamados")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para Chamados
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-novo-chamado">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/chamados")} data-testid="button-voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="Novo Chamado"
          description="Preencha as informações para abrir um novo chamado de suporte. Campos marcados com * são obrigatórios."
        />
      </div>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Chamado</CardTitle>
            <CardDescription>Preencha todos os campos obrigatórios para criar um novo chamado</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          images={attachments.map(a => a.url)}
                          onImagesChange={(urls) => setAttachments(urls.map((url, i) => ({ name: `Arquivo_${i + 1}`, url })))}
                          data-testid="input-ticket-description"
                          className="min-h-[180px]"
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
                            <SelectTrigger data-testid="select-ticket-category">
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
                            <SelectTrigger data-testid="select-ticket-type">
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
                        <FormLabel className="flex items-center gap-1">
                          Local <span className="text-destructive">*</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">
                              <p className="text-xs">
                                <strong>Local</strong> indica o sistema ou ambiente onde o problema ocorreu.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ticket-location">
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
                            <SelectTrigger data-testid="select-ticket-priority">
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
                                <strong>Impacto</strong> mede quantas pessoas ou processos são afetados pelo problema.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ticket-impact">
                              <SelectValue placeholder="Selecione" />
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

                  <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Responsável (opcional)
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[280px]">
                              <p className="text-xs">
                                <strong>Responsável</strong> define quem irá atender o chamado. Deixe vazio para atribuição automática.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <UserSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Atribuição automática"
                            emptyMessage="Nenhum usuário encontrado"
                            showAutoOption={true}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation("/chamados")}
                    data-testid="button-cancel-ticket"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={mutation.isPending}
                    data-testid="button-submit-ticket"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar Chamado"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
