import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FolderKanban, Calendar, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Project, User } from "@shared/schema";
import { ProjectDialog } from "./project-dialog";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400",
  sprint_active: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  planning: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  on_hold: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  completed: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  archived: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  sprint_active: "Em Andamento",
  planning: "Planejamento",
  on_hold: "Pausado",
  completed: "Sprint Finalizada",
  archived: "Arquivado",
};

export default function ProjetosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeProjects = projects.filter(p => p.status === "active").length;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Projetos" 
        breadcrumbs={[{ label: "Projetos" }]}
        actions={
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Seus Projetos</h2>
            <p className="text-muted-foreground">
              {activeProjects} projeto{activeProjects !== 1 ? "s" : ""} ativo{activeProjects !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar projetos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-[250px]"
              data-testid="input-search-projects"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhum projeto encontrado</h3>
              <p className="text-muted-foreground mt-1">
                {projects.length === 0 
                  ? "Crie seu primeiro projeto clicando no botão acima"
                  : "Tente ajustar sua busca"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const owner = users.find(u => u.id === project.ownerId);
              return (
                <Link key={project.id} href={`/projetos/${project.id}`}>
                  <Card 
                    className="shadow-sm border-border/60 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 h-full"
                    data-testid={`card-project-${project.id}`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-[18px] font-bold">{project.name}</CardTitle>
                          <CardDescription className="text-[13px] mt-1 line-clamp-2">
                            {project.description || "Sem descrição"}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={statusColors[project.status]}>
                          {statusLabels[project.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {project.startDate 
                                ? new Date(project.startDate).toLocaleDateString("pt-BR") 
                                : "Sem data"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{owner?.name || "1 membro"}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <ProjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
