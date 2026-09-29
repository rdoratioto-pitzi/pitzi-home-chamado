import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Ticket, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
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

// Produto ativo: central de chamados. Os demais módulos estão desativados.
const modules: ModuleCard[] = [
  {
    title: "Chamados",
    description: "Gerencie tickets de suporte interno",
    icon: Ticket,
    href: "/chamados",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    permissionKey: "chamados",
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
          <h1 className="text-[22px] font-bold tracking-tight">Bem-vindo ao Pitzi Home</h1>
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
                      <module.icon className={cn("h-6 w-6", module.color)} />
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
