import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  PenLine,
  Clock,
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

const createDiagramSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  description: z.string().optional(),
  visibility: z.enum(["private", "shared", "public"]).default("private"),
});

type CreateFormData = z.infer<typeof createDiagramSchema>;

export default function DiagramasPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: diagramas, isLoading } = useQuery<Flowchart[]>({
    queryKey: ["/api/flowcharts", "excalidraw"],
    queryFn: async () => {
      const res = await fetch("/api/flowcharts?source=excalidraw", { credentials: "include" });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
        source: "excalidraw",
        nodesData: "[]",
      });
      return res.json();
    },
    onSuccess: (newDiagram: Flowchart) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", "excalidraw"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Diagrama criado com sucesso!" });
      window.location.href = `/diagramas/${newDiagram.id}`;
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar diagrama", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/flowcharts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", "excalidraw"] });
      toast({ title: "Diagrama excluído com sucesso!" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (d: Flowchart) => {
      const res = await apiRequest("POST", "/api/flowcharts", {
        title: `${d.title} (Cópia)`,
        description: d.description,
        ownerId: currentUser?.id,
        tenantId: currentUser?.tenantId,
        source: "excalidraw",
        nodesData: d.nodesData,
        viewport: d.viewport,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", "excalidraw"] });
      toast({ title: "Diagrama duplicado com sucesso!" });
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await apiRequest("PATCH", `/api/flowcharts/${id}`, { title });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flowcharts", "excalidraw"] });
      setEditingCardId(null);
      setEditingTitle("");
      toast({ title: "Título atualizado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar título", description: err.message, variant: "destructive" });
    },
  });

  const form = useForm<CreateFormData>({
    resolver: zodResolver(createDiagramSchema),
    defaultValues: { title: "", description: "", visibility: "private" },
  });

  useEffect(() => {
    if (editingCardId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCardId]);

  const handleStartEdit = (d: Flowchart) => {
    setEditingCardId(d.id);
    setEditingTitle(d.title);
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
    if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); }
    else if (e.key === "Escape") { handleCancelEdit(); }
  };

  const filteredDiagramas = (diagramas || []).filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Diagramas" />

      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Meus Diagramas</h2>
            <p className="text-muted-foreground mt-1">Crie diagramas, mapas mentais e esboços visuais com Excalidraw</p>
          </div>
          <Button onClick={() => { form.reset(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Diagrama
          </Button>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar diagramas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : filteredDiagramas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PenLine className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum diagrama encontrado</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery
                ? "Nenhum resultado para sua busca. Tente outros termos."
                : "Crie seu primeiro diagrama para começar a organizar ideias visualmente."}
            </p>
            {!searchQuery && (
              <Button onClick={() => { form.reset(); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Diagrama
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDiagramas.map((d) => (
              <Card
                key={d.id}
                className="group relative hover-elevate border cursor-pointer"
              >
                <Link href={`/diagramas/${d.id}`} className="block">
                  <div className="h-32 bg-muted/50 rounded-t-md flex items-center justify-center">
                    <PenLine className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <CardHeader className="pb-2">
                    {editingCardId === d.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                        <Input
                          ref={editInputRef}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="h-7 text-sm"
                        />
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.preventDefault(); handleSaveEdit(); }}
                          disabled={updateTitleMutation.isPending}
                        >
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                          onClick={(e) => { e.preventDefault(); handleCancelEdit(); }}
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="text-sm font-semibold line-clamp-1">
                        {d.title}
                      </CardTitle>
                    )}
                  </CardHeader>
                  <CardContent className="pb-4">
                    {d.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{d.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(d.updatedAt)}
                      </span>
                    </div>
                  </CardContent>
                </Link>
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon" variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartEdit(d); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); duplicateMutation.mutate(d); }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => { e.preventDefault(); deleteMutation.mutate(d.id); }}
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

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) form.reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Diagrama</DialogTitle>
            <DialogDescription>Crie um novo diagrama para organizar ideias, processos ou fluxos visualmente</DialogDescription>
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
                      <Input placeholder="Nome do diagrama" {...field} />
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
                      <RichTextarea placeholder="Descreva o objetivo deste diagrama..." value={field.value || ""} onChange={field.onChange} />
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
                        <Label htmlFor="diag-visibility-toggle" className="text-sm text-muted-foreground">
                          {field.value === "private" ? "Privado" : field.value === "shared" ? "Compartilhado" : "Público"}
                        </Label>
                        <Switch
                          id="diag-visibility-toggle"
                          checked={field.value !== "private"}
                          onCheckedChange={(checked) => field.onChange(checked ? "shared" : "private")}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {field.value === "private"
                        ? "Apenas você pode ver este diagrama."
                        : "Outros usuários com permissão podem ver este diagrama."}
                    </p>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); form.reset(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Diagrama"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
