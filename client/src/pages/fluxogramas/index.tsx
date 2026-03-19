import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RichTextarea } from "@/components/rich-textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  Workflow,
  Clock,
  User as UserIcon,
  Lock,
  Globe,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Flowchart } from "@shared/schema";
import { useAuth } from "@/contexts/auth-context";

const createFlowchartSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  description: z.string().optional(),
  visibility: z.enum(["private", "shared", "public"]).default("private"),
});

type CreateFormData = z.infer<typeof createFlowchartSchema>;

export default function FluxogramasPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Flowchart | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: flowcharts, isLoading } = useQuery<Flowchart[]>({
    queryKey: ["/api/flowcharts"],
  });

  const { data: templates } = useQuery<Flowchart[]>({
    queryKey: ["/api/flowcharts/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
      });
      return res.json();
    },
    onSuccess: (newFlowchart: Flowchart) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      setIsCreateOpen(false);
      setSelectedTemplate(null);
      form.reset();
      toast({ title: "Fluxograma criado com sucesso!" });
      window.location.href = `/fluxogramas/${newFlowchart.id}`;
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar fluxograma", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/flowcharts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      toast({ title: "Fluxograma excluído com sucesso!" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (fc: Flowchart) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        title: `${fc.title} (Cópia)`,
        description: fc.description,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
        nodesData: fc.nodesData,
        edgesData: fc.edgesData,
        viewport: fc.viewport,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      toast({ title: "Fluxograma duplicado com sucesso!" });
    },
  });

  const createFromTemplate = useMutation({
    mutationFn: async (data: CreateFormData & { template: Flowchart }) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
        nodesData: data.template.nodesData,
        edgesData: data.template.edgesData,
        viewport: data.template.viewport,
      });
      return res.json();
    },
    onSuccess: (newFlowchart: Flowchart) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      setSelectedTemplate(null);
      form.reset();
      toast({ title: "Fluxograma criado a partir do template!" });
      window.location.href = `/fluxogramas/${newFlowchart.id}`;
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await apiRequest("PATCH", `/api/flowcharts/${id}`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      setEditingCardId(null);
      setEditingTitle("");
      toast({ title: "Título atualizado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar título", description: err.message, variant: "destructive" });
    },
  });

  const form = useForm<CreateFormData>({
    resolver: zodResolver(createFlowchartSchema),
    defaultValues: { title: "", description: "", visibility: "private" },
  });

  // Focus no input de edição quando abrir
  useEffect(() => {
    if (editingCardId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCardId]);

  const handleTemplateClick = (template: Flowchart) => {
    setSelectedTemplate(template);
    form.reset({
      title: `${template.title}`,
      description: template.description || "",
      visibility: "private",
    });
    setIsCreateOpen(true);
  };

  const handleFormSubmit = (data: CreateFormData) => {
    if (selectedTemplate) {
      createFromTemplate.mutate({ ...data, template: selectedTemplate });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStartEdit = (fc: Flowchart) => {
    setEditingCardId(fc.id);
    setEditingTitle(fc.title);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditingTitle("");
  };

  const handleSaveEdit = () => {
    if (editingCardId && editingTitle.trim().length >= 3) {
      updateTitleMutation.mutate({ id: editingCardId, title: editingTitle.trim() });
    } else if (editingTitle.trim().length < 3) {
      toast({ title: "Título deve ter pelo menos 3 caracteres", variant: "destructive" });
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const filteredFlowcharts = (flowcharts || []).filter((fc) =>
    fc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Fluxogramas" />

      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-flowcharts-title">Meus Fluxogramas</h2>
            <p className="text-muted-foreground mt-1">Crie e edite fluxogramas visuais para mapear processos</p>
          </div>
          <Button onClick={() => { form.reset(); setSelectedTemplate(null); setIsCreateOpen(true); }} data-testid="button-create-flowchart">
            <Plus className="h-4 w-4 mr-2" />
            Novo Fluxograma
          </Button>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fluxogramas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-flowcharts"
          />
        </div>

        {templates && templates.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Templates</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover-elevate border"
                  onClick={() => handleTemplateClick(template)}
                  data-testid={`card-template-${template.id}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{template.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{template.description || "Template"}</p>
                    <Badge variant="secondary" className="mt-2">{template.templateCategory || "Geral"}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : filteredFlowcharts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Workflow className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum fluxograma encontrado</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery
                ? "Nenhum resultado para sua busca. Tente outros termos."
                : "Crie seu primeiro fluxograma para começar a mapear seus processos."}
            </p>
            {!searchQuery && (
              <Button onClick={() => { form.reset(); setSelectedTemplate(null); setIsCreateOpen(true); }} data-testid="button-create-first-flowchart">
                <Plus className="h-4 w-4 mr-2" />
                Criar Fluxograma
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFlowcharts.map((fc) => (
              <Card
                key={fc.id}
                className="group relative hover-elevate border cursor-pointer"
                data-testid={`card-flowchart-${fc.id}`}
              >
                <Link href={`/fluxogramas/${fc.id}`} className="block">
                  <div className="h-32 bg-muted/50 rounded-t-md flex items-center justify-center">
                    <Workflow className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <CardHeader className="pb-2">
                    {editingCardId === fc.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                        <Input
                          ref={editInputRef}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="h-7 text-sm"
                          data-testid={`input-edit-title-${fc.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.preventDefault(); handleSaveEdit(); }}
                          disabled={updateTitleMutation.isPending}
                          data-testid={`button-save-title-${fc.id}`}
                        >
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.preventDefault(); handleCancelEdit(); }}
                          data-testid={`button-cancel-title-${fc.id}`}
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="text-sm font-semibold line-clamp-1" data-testid={`text-flowchart-title-${fc.id}`}>
                        {fc.title}
                      </CardTitle>
                    )}
                  </CardHeader>
                  <CardContent className="pb-4">
                    {fc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{fc.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(fc.updatedAt)}
                      </span>
                    </div>
                  </CardContent>
                </Link>
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.preventDefault()}
                        data-testid={`button-menu-flowchart-${fc.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartEdit(fc); }}
                        data-testid={`button-rename-flowchart-${fc.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.preventDefault(); duplicateMutation.mutate(fc); }}
                        data-testid={`button-duplicate-flowchart-${fc.id}`}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => { e.preventDefault(); deleteMutation.mutate(fc.id); }}
                        data-testid={`button-delete-flowchart-${fc.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setSelectedTemplate(null); form.reset(); } }}>
        <DialogContent data-testid="dialog-create-flowchart">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? "Criar a partir do Template" : "Novo Fluxograma"}</DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? `Crie um novo fluxograma baseado no template "${selectedTemplate.title}"`
                : "Crie um novo fluxograma para mapear seus processos"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fluxograma" {...field} data-testid="input-flowchart-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <RichTextarea placeholder="Descreva o objetivo deste fluxograma..." value={field.value || ""} onChange={field.onChange} data-testid="input-flowchart-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Visibilidade</FormLabel>
                      <div className="flex items-center gap-2">
                        {field.value === "private" ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Globe className="h-4 w-4 text-primary" />
                        )}
                        <Label htmlFor="fc-visibility-toggle" className="text-sm text-muted-foreground">
                          {field.value === "private" ? "Privado" : field.value === "shared" ? "Compartilhado" : "Público"}
                        </Label>
                        <Switch
                          id="fc-visibility-toggle"
                          data-testid="switch-flowchart-visibility"
                          checked={field.value !== "private"}
                          onCheckedChange={(checked) => field.onChange(checked ? "shared" : "private")}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {field.value === "private"
                        ? "Apenas você pode ver este fluxograma."
                        : "Outros usuários com permissão podem ver este fluxograma."}
                    </p>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setSelectedTemplate(null); form.reset(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || createFromTemplate.isPending} data-testid="button-submit-create-flowchart">
                  {(createMutation.isPending || createFromTemplate.isPending) ? "Criando..." : selectedTemplate ? "Criar a partir do Template" : "Criar Fluxograma"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
