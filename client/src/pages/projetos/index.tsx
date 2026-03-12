import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  FolderKanban,
  Calendar,
  Users,
  Edit2,
  ChevronRight,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, User } from "@shared/schema";
import { ProjectDialog } from "./project-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stripHtml, isEmptyHtml, cn } from "@/lib/utils";
import { KanbanContent } from "./kanban";
import { apiRequest } from "@/lib/queryClient";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  sprint_active: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  planning: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  on_hold: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  completed: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  archived: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
};

const statusDotColors: Record<string, string> = {
  active: "bg-green-500",
  sprint_active: "bg-blue-500",
  planning: "bg-indigo-500",
  on_hold: "bg-yellow-500",
  completed: "bg-purple-500",
  archived: "bg-slate-400",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  sprint_active: "Em Andamento",
  planning: "Planejamento",
  on_hold: "Pausado",
  completed: "Concluído",
  archived: "Arquivado",
};

export default function ProjetosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/projects/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (deletingProject && selectedProjectId === deletingProject.id) {
        setSelectedProjectId(null);
      }
      setDeletingProject(null);
      toast({ title: "Projeto excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir projeto", variant: "destructive" });
    },
  });

  const filteredProjects = useMemo(() =>
    projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      // Comparar com nome e descrição sem HTML
      const descPlain = stripHtml(p.description).toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        descPlain.includes(q);
      const matchesStatus = filterStatus === "all" || p.status === filterStatus;
      const matchesOwner = filterOwner === "all" || p.ownerId === filterOwner;
      return matchesSearch && matchesStatus && matchesOwner;
    }),
    [projects, searchQuery, filterStatus, filterOwner]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Quando filtro de projeto muda, abre o projeto direto no painel
  const handleFilterProject = (projectId: string) => {
    if (projectId === "all") {
      // não altera a seleção — mantém o painel como está
    } else {
      setSelectedProjectId(projectId);
    }
  };

  const handleNewProject = () => {
    setEditingProject(undefined);
    setIsDialogOpen(true);
  };

  const handleEditProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setEditingProject(undefined);
  };

  // Owners únicos para o filtro
  const owners = useMemo(() =>
    users.filter((u) => projects.some((p) => p.ownerId === u.id)),
    [users, projects]
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: "Projetos" }]}
        actions={
          <Button onClick={handleNewProject} data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        }
      />

      {/* Layout: Sidebar + Painel Central */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Sidebar de Projetos ─────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/20 overflow-hidden">
          {/* Busca */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-projects"
              />
            </div>
          </div>

          {/* Filtros */}
          <div className="p-3 border-b space-y-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Responsáveis</SelectItem>
                {owners.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedProjectId ?? "all"}
              onValueChange={(val) => {
                if (val === "all") {
                  setSelectedProjectId(null);
                } else {
                  handleFilterProject(val);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="select-filter-project">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Projetos</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                          statusDotColors[p.status] ?? "bg-slate-400"
                        )}
                      />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contagem */}
          <div className="px-3 py-2 border-b">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              {filteredProjects.length} projeto{filteredProjects.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Lista de Projetos */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-4 text-center">
                <FolderKanban className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {projects.length === 0
                    ? "Nenhum projeto ainda"
                    : "Nenhum resultado"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredProjects.map((project) => {
                  const isSelected = selectedProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() =>
                        setSelectedProjectId(isSelected ? null : project.id)
                      }
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md flex items-start gap-2.5 transition-all duration-150 group relative",
                        isSelected
                          ? "bg-primary/10 border border-primary/20 text-primary"
                          : "hover:bg-muted/60 border border-transparent"
                      )}
                      data-testid={`sidebar-project-${project.id}`}
                    >
                      {/* Indicador de status */}
                      <span
                        className={cn(
                          "mt-1.5 w-2 h-2 rounded-full flex-shrink-0",
                          statusDotColors[project.status] ?? "bg-slate-400"
                        )}
                      />

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate leading-snug",
                            isSelected ? "text-primary" : "text-foreground"
                          )}
                        >
                          {project.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {statusLabels[project.status]}
                        </p>
                      </div>

                      {/* Botões de ação (hover) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => handleEditProject(e, project)}
                          className="p-0.5 rounded hover:bg-muted"
                          title="Editar projeto"
                          data-testid={`button-edit-project-${project.id}`}
                        >
                          <Edit2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingProject(project);
                          }}
                          className="p-0.5 rounded hover:bg-destructive/10"
                          title="Excluir projeto"
                          data-testid={`button-delete-project-${project.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer: novo projeto */}
          <div className="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs h-8"
              onClick={handleNewProject}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Projeto
            </Button>
          </div>
        </aside>

        {/* ─── Painel Central ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {selectedProject ? (
            <>
              {/* Mini-header do projeto selecionado */}
              <div className="flex items-center justify-between px-6 py-3 border-b bg-background flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      statusDotColors[selectedProject.status] ?? "bg-slate-400"
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-base truncate">
                        {selectedProject.name}
                      </h2>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-5 px-2 flex-shrink-0",
                          statusColors[selectedProject.status]
                        )}
                      >
                        {statusLabels[selectedProject.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      {selectedProject.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(selectedProject.startDate).toLocaleDateString("pt-BR")}
                          {selectedProject.endDate && (
                            <> — {new Date(selectedProject.endDate).toLocaleDateString("pt-BR")}</>
                          )}
                        </span>
                      )}
                      {selectedProject.ownerId && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {users.find((u) => u.id === selectedProject.ownerId)?.name ?? ""}
                        </span>
                      )}
                      {!isEmptyHtml(selectedProject.description) && (
                        <span className="truncate max-w-[280px]">
                          {stripHtml(selectedProject.description)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 gap-1.5 text-xs h-8"
                  onClick={(e) => handleEditProject(e, selectedProject)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar
                </Button>
              </div>

              {/* Kanban embarcado — ocupa o restante da altura */}
              <div className="flex-1 overflow-hidden">
                <KanbanContent embeddedProjectId={selectedProject.id} />
              </div>
            </>
          ) : filteredProjects.length === 0 ? (
            /* Empty state — sem projetos */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm px-4">
                <div className="relative mx-auto mb-6 w-20 h-20">
                  <div className="absolute inset-0 bg-primary/10 rounded-2xl rotate-6" />
                  <div className="absolute inset-0 bg-primary/5 rounded-2xl -rotate-3" />
                  <div className="relative flex items-center justify-center h-full">
                    <LayoutGrid className="h-10 w-10 text-primary/60" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Nenhum projeto encontrado
                </h3>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  Crie um novo projeto para começar a gerenciar cards e sprints.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button onClick={handleNewProject} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Projeto
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Overview: grade com todos os projetos filtrados */
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {filteredProjects.length} projeto{filteredProjects.length !== 1 ? "s" : ""}
                </h2>
                <Button size="sm" onClick={handleNewProject} className="gap-1.5 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Novo Projeto
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => {
                  const owner = users.find((u) => u.id === project.ownerId);
                  return (
                    <div
                      key={project.id}
                      className="text-left rounded-lg border bg-card hover:bg-accent/40 hover:border-primary/30 transition-all duration-150 p-4 flex flex-col gap-2 group cursor-pointer"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "mt-0.5 w-2 h-2 rounded-full flex-shrink-0",
                              statusDotColors[project.status] ?? "bg-slate-400"
                            )}
                          />
                          <p className="font-semibold text-sm truncate">{project.name}</p>
                        </div>
                        {/* Dropdown de status rápido */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={project.status || "active"}
                            onValueChange={(newStatus) =>
                              updateProjectStatusMutation.mutate({ id: project.id, status: newStatus })
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-5 text-[10px] px-2 border rounded-full w-auto gap-1 flex-shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5",
                                statusColors[project.status]
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value} className="text-xs">
                                  <span className="flex items-center gap-2">
                                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDotColors[value] ?? "bg-slate-400")} />
                                    {label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {!isEmptyHtml(project.description) && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {stripHtml(project.description)}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-auto pt-1 text-[11px] text-muted-foreground">
                        {project.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(project.startDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {owner && (
                          <span className="flex items-center gap-1 ml-auto">
                            <Users className="h-3 w-3" />
                            {owner.name.split(" ")[0]}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-primary/70 font-medium group-hover:text-primary transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Abrir projeto
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      <ProjectDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        project={editingProject}
      />

      <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto "{deletingProject?.name}"? Todos os cards, colunas e labels serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingProject && deleteProjectMutation.mutate(deletingProject.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
