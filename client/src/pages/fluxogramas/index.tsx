import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
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
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import type { Flowchart } from "@shared/schema";

function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) return JSON.parse(userStr);
  } catch {}
  return null;
}

const createFlowchartSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
});

type CreateFormData = z.infer<typeof createFlowchartSchema>;

export default function FluxogramasPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const currentUser = getCurrentUser();

  const { data: flowcharts, isLoading } = useQuery<Flowchart[]>({
    queryKey: ["/api/flowcharts"],
  });

  const { data: templates } = useQuery<Flowchart[]>({
    queryKey: ["/api/flowcharts/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        ...data,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
      });
      return res.json();
    },
    onSuccess: (newFlowchart: Flowchart) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      setIsCreateOpen(false);
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
    mutationFn: async (template: Flowchart) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        title: `${template.title}`,
        description: template.description,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
        nodesData: template.nodesData,
        edgesData: template.edgesData,
        viewport: template.viewport,
      });
      return res.json();
    },
    onSuccess: (newFlowchart: Flowchart) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts"] });
      toast({ title: "Fluxograma criado a partir do template!" });
      window.location.href = `/fluxogramas/${newFlowchart.id}`;
    },
  });

  const form = useForm<CreateFormData>({
    resolver: zodResolver(createFlowchartSchema),
    defaultValues: { title: "", description: "" },
  });

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
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-6 gap-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle-fluxogramas" />
            <div className="h-6 w-px bg-border/60 mx-1" />
            <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-tight">Fluxogramas</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-flowcharts-title">Meus Fluxogramas</h2>
            <p className="text-muted-foreground mt-1">Crie e edite fluxogramas visuais para mapear processos</p>
          </div>
          <Button onClick={() => { form.reset(); setIsCreateOpen(true); }} data-testid="button-create-flowchart">
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
                  onClick={() => createFromTemplate.mutate(template)}
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
              <Button onClick={() => { form.reset(); setIsCreateOpen(true); }} data-testid="button-create-first-flowchart">
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
                    <CardTitle className="text-sm font-semibold line-clamp-1" data-testid={`text-flowchart-title-${fc.id}`}>
                      {fc.title}
                    </CardTitle>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent data-testid="dialog-create-flowchart">
          <DialogHeader>
            <DialogTitle>Novo Fluxograma</DialogTitle>
            <DialogDescription>Crie um novo fluxograma para mapear seus processos</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
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
                      <Textarea placeholder="Descreva o objetivo deste fluxograma..." {...field} data-testid="input-flowchart-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create-flowchart">
                  {createMutation.isPending ? "Criando..." : "Criar Fluxograma"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
