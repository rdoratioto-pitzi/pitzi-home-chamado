import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, CheckCircle2, AlertCircle, Info, Calendar, Plus, Pencil, Trash2, Loader2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Update {
    id: string;
    version: string;
    title: string;
    content: string;
    category: 'feature' | 'bugfix' | 'improvement' | 'announcement';
    isPublished: boolean;
    publishedAt: string | null;
    createdAt: string;
}

const categoryConfig = {
    feature: {
        label: "Nova Funcionalidade",
        color: "bg-primary/10 text-primary border-primary/20",
        icon: Sparkles,
    },
    bugfix: {
        label: "Correção de Erro",
        color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
        icon: AlertCircle,
    },
    improvement: {
        label: "Melhoria",
        color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        icon: CheckCircle2,
    },
    announcement: {
        label: "Anúncio",
        color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        icon: Info,
    },
};

function getCurrentUser() {
    try {
        const userStr = sessionStorage.getItem("user");
        return userStr ? JSON.parse(userStr) : null;
    } catch { return null; }
}

export default function UpdatesPage() {
    const { toast } = useToast();
    const currentUser = getCurrentUser();
    const isAdmin = currentUser?.isAdmin === true || currentUser?.isAdmin === "true" || currentUser?.perfilAcesso === "diretor";

    const [open, setOpen] = useState(false);
    const [editingUpdate, setEditingUpdate] = useState<Update | null>(null);

    // Check database health
    const { data: dbHealth } = useQuery<{ connected: boolean }>({
        queryKey: ["/api/health/db"],
        queryFn: async () => {
            try {
                const res = await apiRequest("GET", "/api/health/db");
                if (!res.ok) return { connected: false };
                return res.json();
            } catch {
                return { connected: false };
            }
        },
        refetchInterval: 30000, // Check every 30 seconds
    });

    const isMockMode = !dbHealth?.connected;

    const { data: updates, isLoading } = useQuery<Update[]>({
        queryKey: ["/api/updates", isAdmin],
        queryFn: async () => {
            const url = isAdmin ? "/api/updates?includeUnpublished=true" : "/api/updates";
            const res = await apiRequest("GET", url);
            if (!res.ok) throw new Error("Erro ao carregar novidades");
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/updates", data);
            if (!res.ok) {
                const error = await res.json().catch(() => ({ error: "Erro ao criar novidade" }));
                throw new Error(error.error || "Erro ao criar novidade");
            }
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/updates"], refetchType: 'all' });
            await queryClient.refetchQueries({ queryKey: ["/api/updates"] });
            setOpen(false);
            toast({ title: "Sucesso", description: "Novidade criada com sucesso!" });
        },
        onError: (error: any) => {
            toast({ 
                title: "Erro", 
                description: error.message || "Não foi possível criar a novidade. Verifique sua conexão.",
                variant: "destructive"
            });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const res = await apiRequest("PATCH", `/api/updates/${id}`, data);
            if (!res.ok) {
                const error = await res.json().catch(() => ({ error: "Erro ao atualizar novidade" }));
                throw new Error(error.error || "Erro ao atualizar novidade");
            }
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/updates"], refetchType: 'all' });
            await queryClient.refetchQueries({ queryKey: ["/api/updates"] });
            setOpen(false);
            setEditingUpdate(null);
            toast({ title: "Sucesso", description: "Novidade atualizada com sucesso!" });
        },
        onError: (error: any) => {
            toast({ 
                title: "Erro", 
                description: error.message || "Não foi possível atualizar a novidade.",
                variant: "destructive"
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("DELETE", `/api/updates/${id}`);
            if (!res.ok) {
                const error = await res.json().catch(() => ({ error: "Erro ao remover novidade" }));
                throw new Error(error.error || "Erro ao remover novidade");
            }
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/updates"], refetchType: 'all' });
            await queryClient.refetchQueries({ queryKey: ["/api/updates"] });
            toast({ title: "Sucesso", description: "Novidade removida com sucesso!" });
        },
        onError: (error: any) => {
            toast({ 
                title: "Erro", 
                description: error.message || "Não foi possível remover a novidade.",
                variant: "destructive"
            });
        }
    });

    const syncGitMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/updates/sync-git");
            if (!res.ok) {
                const error = await res.json().catch(() => ({ error: "Erro ao sincronizar commits" }));
                throw new Error(error.error || "Erro ao sincronizar commits");
            }
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/updates"], refetchType: 'all' });
            await queryClient.refetchQueries({ queryKey: ["/api/updates"] });
            toast({ title: "Sucesso", description: "Commits sincronizados com sucesso!" });
        },
        onError: (error: any) => {
            toast({ 
                title: "Erro", 
                description: error.message || "Não foi possível sincronizar os commits.",
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const isNew = !editingUpdate;
        const shouldPublish = formData.get("isPublished") === "on";
        
        // Dados para criar/editar - NÃO enviar publishedAt, o backend gerencia isso
        const data: any = {
            title: formData.get("title") as string,
            version: formData.get("version") as string,
            content: formData.get("content") as string,
            category: formData.get("category") as string,
            source: "Manual",
        };
        
        if (isNew) {
            // Novos updates: sempre publicados automaticamente
            data.isPublished = true;
        } else {
            // Edição: respeitar o toggle
            data.isPublished = shouldPublish;
        }

        if (editingUpdate) {
            updateMutation.mutate({ id: editingUpdate.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-slate-50/50 dark:bg-transparent">
            <PageHeader
                title="Novidades do Sistema"
                breadcrumbs={[{ label: "Novidades" }]}
                actions={isAdmin && (
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => syncGitMutation.mutate()}
                            disabled={syncGitMutation.isPending}
                            className="gap-2"
                        >
                            {syncGitMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Sincronizar Git
                        </Button>
                        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingUpdate(null); }}>
                            <DialogTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm">
                                    <Plus className="h-4 w-4" />
                                    Novo Update
                                </Button>
                            </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{editingUpdate ? "Editar Novidade" : "Criar Nova Novidade"}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="version">Versão</Label>
                                        <Input id="version" name="version" defaultValue={editingUpdate?.version} placeholder="v1.2.0" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Categoria</Label>
                                        <Select name="category" defaultValue={editingUpdate?.category || "feature"}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="feature">Nova Funcionalidade</SelectItem>
                                                <SelectItem value="improvement">Melhoria</SelectItem>
                                                <SelectItem value="bugfix">Correção de Erro</SelectItem>
                                                <SelectItem value="announcement">Anúncio</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="title">Título</Label>
                                    <Input id="title" name="title" defaultValue={editingUpdate?.title} placeholder="O que há de novo?" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="content">Conteúdo</Label>
                                    <Textarea id="content" name="content" defaultValue={editingUpdate?.content} placeholder="Descreva as mudanças..." className="min-h-[150px]" required />
                                </div>
                                {editingUpdate && (
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch id="isPublished" name="isPublished" defaultChecked={editingUpdate?.isPublished} />
                                        <Label htmlFor="isPublished">
                                            {editingUpdate?.isPublished 
                                                ? "Publicado (visível para todos os usuários)" 
                                                : "Publicar agora (tornar visível para todos os usuários)"}
                                        </Label>
                                    </div>
                                )}
                                <DialogFooter className="pt-4">
                                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingUpdate ? "Salvar Alterações" : "Criar Novidade"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                    </div>
                )}
            />

            <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
                {isMockMode && isAdmin && (
                    <Alert className="mb-6 border-red-500/50 bg-red-50/50 dark:bg-red-900/10">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 dark:text-red-200">
                            <strong>⚠️ Atenção:</strong> O banco de dados não está conectado em produção. 
                            Entre em contato com o administrador do sistema. As alterações não serão persistidas.
                        </AlertDescription>
                    </Alert>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    </div>
                ) : (
                    <div className="relative pl-8 sm:pl-48 py-4">
                        <div className="absolute left-[11px] sm:left-[47px] top-0 bottom-0 w-0.5 bg-border/60"></div>

                        <div className="space-y-12">
                            <AnimatePresence mode="popLayout">
                                {updates?.map((update, index) => {
                                    const config = categoryConfig[update.category] || categoryConfig.feature;
                                    const date = update.publishedAt ? new Date(update.publishedAt) : new Date(update.createdAt);

                                    if (!isAdmin && !update.isPublished) return null;

                                    return (
                                        <motion.div
                                            key={update.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="relative group"
                                        >
                                            <div className="absolute -left-[30px] sm:-left-[110px] mt-1 flex items-center justify-center">
                                                <div className="h-6 w-6 rounded-full bg-white dark:bg-slate-900 border-2 border-primary flex items-center justify-center z-10 shadow-sm">
                                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                                                </div>
                                            </div>

                                            <div className="hidden sm:block absolute -left-[220px] top-0 text-right w-24">
                                                <p className="text-sm font-bold text-foreground leading-tight">{update.version}</p>
                                                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
                                                    {format(date, "dd MMM yyyy", { locale: ptBR })}
                                                </p>
                                            </div>

                                            <Card className={`border-border/40 shadow-sm hover:shadow-md transition-all duration-300 ${!update.isPublished ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                                                <CardContent className="p-5 sm:p-6">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 sm:hidden mb-1">
                                                                <span className="text-sm font-bold text-primary">{update.version}</span>
                                                                <span className="text-muted-foreground">•</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {format(date, "dd/MM/yyyy", { locale: ptBR })}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                                                    {update.title}
                                                                </h3>
                                                                {!update.isPublished && (
                                                                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-dashed">Rascunho</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isAdmin && (
                                                                <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingUpdate(update); setOpen(true); }}>
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Remover este update?")) deleteMutation.mutate(update.id); }}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            <Badge className={`${config.color} border font-medium px-3 py-1 shrink-0`}>
                                                                <config.icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                                                {config.label}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                                        <div className="whitespace-pre-line text-slate-600 dark:text-slate-400 leading-relaxed">
                                                            {update.content}
                                                        </div>
                                                    </div>

                                                    <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                                                        <div className="flex items-center text-[11px] text-muted-foreground uppercase tracking-widest gap-2">
                                                            <Calendar className="h-3 w-3" />
                                                            {update.isPublished ? `Publicado em ${format(date, "PPPP", { locale: ptBR })}` : `Criado em ${format(date, "PPPP", { locale: ptBR })}`}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {!isLoading && updates?.length === 0 && (
                    <div className="py-20 text-center">
                        <Sparkles className="h-12 w-12 text-primary/20 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Nenhuma novidade ainda</h3>
                        <p className="text-slate-500">As atualizações do sistema aparecerão aqui.</p>
                    </div>
                )}

                <div className="mt-16 text-center text-muted-foreground">
                    <p className="text-sm">Você está atualizado com as últimas novidades! ✨</p>
                </div>
            </main>
        </div>
    );
}
