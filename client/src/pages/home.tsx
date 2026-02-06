import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
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
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import MacGyverIcon from "@/components/Chat/MacGyverIcon";

interface ModuleCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
}

const modules: ModuleCard[] = [
  {
    title: "Macgyver IA",
    description: "Assistente inteligente para ajudar em suas tarefas",
    icon: Bot,
    href: "/macgyver-ia",
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
  },
  {
    title: "Projetos",
    description: "Acompanhe projetos com quadros Kanban",
    icon: FolderKanban,
    href: "/projetos",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    title: "Tarefas",
    description: "Organize suas tarefas por área",
    icon: CheckSquare,
    href: "/tarefas",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    title: "Reuniões",
    description: "Agende e gerencie suas reuniões",
    icon: Video,
    href: "/reunioes",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    title: "Metas",
    description: "Acompanhe metas e indicadores",
    icon: BarChart3,
    href: "/metas",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
  },
  {
    title: "OKRs",
    description: "Objetivos e Resultados-Chave",
    icon: Target,
    href: "/okrs",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  {
    title: "Logística",
    description: "Simule fretes e gerencie envios",
    icon: Truck,
    href: "/logistica/dashboard",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    title: "Pricing",
    description: "Monitore preços de smartphones",
    icon: DollarSign,
    href: "/pricing/dashboard",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  {
    title: "Base de Conhecimento",
    description: "Documentos e procedimentos internos",
    icon: BookOpen,
    href: "/conhecimento",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle-home" className="h-9 w-9 rounded-lg hover:bg-muted" />
            <div className="h-6 w-px bg-border/60 mx-1" />
            <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-tight">Início</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Renov Home</h1>
          <p className="text-muted-foreground mt-2">
            Acesse rapidamente os módulos da plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {modules.map((module) => (
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
                      {module.title === "Macgyver IA" ? (
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
