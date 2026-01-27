import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Ticket, FolderKanban, Target, Truck, ArrowRight, CheckSquare, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { data: stats, isLoading } = useQuery<{
    tickets: number;
    projects: number;
    tasks: number;
    objectives: number;
    logistica: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const modules = [
    {
      title: "Chamados",
      description: "Gerencie tickets de suporte interno, acompanhe status e prioridades",
      icon: Ticket,
      href: "/chamados",
      stats: { label: "Chamados abertos", value: stats?.tickets ?? 0 },
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Projetos",
      description: "Planeje e execute projetos com visualização Kanban",
      icon: FolderKanban,
      href: "/projetos",
      stats: { label: "Projetos ativos", value: stats?.projects ?? 0 },
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      title: "Tarefas",
      description: "Gerencie tarefas individuais e notas de reunião",
      icon: CheckSquare,
      href: "/tarefas",
      stats: { label: "Tarefas pendentes", value: stats?.tasks ?? 0 },
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    {
      title: "OKRs",
      description: "Defina objetivos e acompanhe resultados-chave",
      icon: Target,
      href: "/okrs",
      stats: { label: "Objetivos ativos", value: stats?.objectives ?? 0 },
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Logística",
      description: "Rastreie envios e gerencie entregas",
      icon: Truck,
      href: "/logistica",
      stats: { label: "Em trânsito", value: stats?.logistica ?? 0 },
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Início" />
      
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight">Bem-vindo ao Renov Home</h2>
            <p className="text-[16px] text-muted-foreground mt-1">
              Plataforma interna de gestão da Renov
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <Link key={module.href} href={module.href}>
                <Card 
                  className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 shadow-sm border-border/60"
                  data-testid={`card-module-${module.href.slice(1)}`}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${module.color}`}>
                        <module.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-[18px] font-bold leading-tight">
                          {module.title}
                        </CardTitle>
                        <CardDescription className="text-[13px] mt-1.5 leading-relaxed">
                          {module.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        {isLoading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-2xl font-bold">{module.stats.value}</p>
                        )}
                        <p className="text-sm text-muted-foreground">{module.stats.label}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
