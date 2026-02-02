import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  MessageSquare, 
  LayoutDashboard, 
  CheckSquare, 
  Target, 
  Truck, 
  DollarSign, 
  BookOpen, 
  Settings,
  Bot
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/permissions";

const modules = [
  {
    title: "Chamados",
    description: "Gestão de tickets e suporte interno",
    icon: MessageSquare,
    href: "/chamados",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    permission: "chamados"
  },
  {
    title: "Projetos",
    description: "Gestão de projetos e quadros Kanban",
    icon: LayoutDashboard,
    href: "/projetos",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    permission: "projetos"
  },
  {
    title: "Tarefas",
    description: "Controle de atividades e prazos",
    icon: CheckSquare,
    href: "/tarefas",
    color: "text-green-500",
    bg: "bg-green-500/10",
    permission: "tarefas"
  },
  {
    title: "Metas & OKRs",
    description: "Acompanhamento de objetivos corporativos",
    icon: Target,
    href: "/metas",
    color: "text-red-500",
    bg: "bg-red-500/10",
    permission: "okrs"
  },
  {
    title: "Logística",
    description: "Fretes, rastreamento e reversa",
    icon: Truck,
    href: "/logistica",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    permission: "logistica"
  },
  {
    title: "Pricing",
    description: "Monitoramento e análise de preços",
    icon: DollarSign,
    href: "/pricing",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    permission: "pricing"
  },
  {
    title: "Base de Conhecimento",
    description: "Documentação e tutoriais internos",
    icon: BookOpen,
    href: "/conhecimento",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    permission: "conhecimento"
  },
  {
    title: "Macgyver IA",
    description: "Assistente inteligente Renov",
    icon: Bot,
    href: "/macgyver",
    color: "text-primary",
    bg: "bg-primary/10",
    permission: null
  },
  {
    title: "Configurações",
    description: "Ajustes do sistema e permissões",
    icon: Settings,
    href: "/configuracoes",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    permission: "configuracoes"
  }
];

export default function Dashboard() {
  const user = getCurrentUser();

  const filteredModules = modules.filter(m => 
    !m.permission || (user?.modulePermissions as any)?.[m.permission]
  );

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="max-w-4xl mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Bem-vindo ao Renov Home
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          O Renov Home é a plataforma central da Renov, projetada para conectar processos, 
          equipes e dados em um único lugar. Aqui você gerencia desde o suporte técnico 
          até a logística complexa e análise de mercado, tudo potencializado por 
          inteligência artificial para maximizar sua produtividade.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="cursor-pointer hover-elevate transition-all border-muted/40 overflow-hidden group">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className={cn("p-2.5 rounded-xl shrink-0 transition-colors", module.bg)}>
                  <module.icon className={cn("h-6 w-6", module.color)} />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {module.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {module.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
