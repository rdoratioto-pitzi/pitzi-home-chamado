import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Ticket,
  FolderKanban,
  CheckSquare,
  Target,
  Truck,
  DollarSign,
  BookOpen,
  Video,
  BarChart3,
  Bot,
  ArrowRight,
  Workflow,
  Sparkles,
  GitBranch,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MacGyverIcon from "@/components/Chat/MacGyverIcon";
import { getUserPermissions, type UserPermissions } from "@/lib/permissions";
import { useAuth } from "@/contexts/auth-context";
import { useMemo } from "react";

interface ModuleCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
  permissionKey?: keyof UserPermissions;
}

const modules: ModuleCard[] = [
  {
    title: "Chat IA",
    description: "Assistente inteligente para ajudar em suas tarefas",
    icon: Bot,
    href: "/chat-ia",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Chamados",
    description: "Gerencie tickets de suporte interno",
    icon: Ticket,
    href: "/chamados",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    permissionKey: "chamados",
  },
  {
    title: "Projetos",
    description: "Acompanhe projetos com quadros Kanban",
    icon: FolderKanban,
    href: "/projetos",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    permissionKey: "projetos",
  },
  {
    title: "Tarefas",
    description: "Organize suas tarefas por área",
    icon: CheckSquare,
    href: "/tarefas",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    permissionKey: "tarefas",
  },
  {
    title: "Reuniões",
    description: "Agende e gerencie suas reuniões",
    icon: Video,
    href: "/reunioes",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    permissionKey: "reunioes",
  },
  {
    title: "Fluxogramas",
    description: "Crie e edite fluxogramas visuais",
    icon: Workflow,
    href: "/fluxogramas",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-100 dark:bg-teal-900/30",
    permissionKey: "fluxogramas",
  },
  {
    title: "Metas",
    description: "Acompanhe metas e indicadores",
    icon: BarChart3,
    href: "/metas",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    permissionKey: "metas",
  },
  {
    title: "OKRs",
    description: "Objetivos e Resultados-Chave",
    icon: Target,
    href: "/okrs",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    permissionKey: "okrs",
  },
  {
    title: "Logística",
    description: "Simule fretes e gerencie envios",
    icon: Truck,
    href: "/logistica/dashboard",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    permissionKey: "logistica",
  },
  {
    title: "Triagem",
    description: "Impressão de etiquetas para triagem",
    icon: Printer,
    href: "/triagem/impressao-etiquetas",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    permissionKey: "triagem",
  },
  {
    title: "Pricing",
    description: "Monitore preços de smartphones",
    icon: DollarSign,
    href: "/pricing/dashboard",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    permissionKey: "pricing",
  },
  {
    title: "Biblioteca",
    description: "Documentos e procedimentos internos",
    icon: BookOpen,
    href: "/biblioteca",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    permissionKey: "conhecimento",
  },
  {
    title: "Git Analytics",
    description: "Governança de código e produtividade",
    icon: GitBranch,
    href: "/git-analytics",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    permissionKey: "gitAnalytics"
  },
];

export default function Home() {
  const { user: currentUser } = useAuth();
  const permissions = getUserPermissions(currentUser);

  const visibleModules = useMemo(() => {
    return modules.filter((mod) => {
      if (!mod.permissionKey) return true;
      return permissions[mod.permissionKey];
    });
  }, [permissions]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Início" />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-[22px] font-bold tracking-tight">Bem-vindo ao Renov Home</h1>
          <p className="text-muted-foreground mt-2">
            Acesse rapidamente os módulos da plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleModules.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card 
                className={cn(
                  "h-full cursor-pointer transition-all duration-200 hover-elevate group",
                  "border hover:border-primary/30"
                )}
                data-testid={`card-module-${module.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-2.5 rounded-lg", module.bgColor)}>
                        {module.title === "Chat IA" ? (
                          <MacGyverIcon size={24} />
                        ) : (
                        <module.icon className={cn("h-6 w-6", module.color)} />
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="text-lg mt-3">{module.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm">
                    {module.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
