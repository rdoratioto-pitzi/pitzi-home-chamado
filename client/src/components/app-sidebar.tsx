import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { 
  Ticket, 
  FolderKanban, 
  Target, 
  Truck, 
  Settings,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  LayoutDashboard,
  Users,
  Package,
  RotateCcw,
  Calculator,
  Code2,
  User,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { RenovLogo } from "./renov-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import type { ModulePermissions } from "@shared/schema";

const allMenuItems = [
  {
    title: "Início",
    url: "/",
    icon: LayoutDashboard,
    module: null,
  },
  {
    title: "Chamados",
    url: "/chamados",
    icon: Ticket,
    module: "chamados" as keyof ModulePermissions,
  },
  {
    title: "Projetos",
    url: "/projetos",
    icon: FolderKanban,
    module: "projetos" as keyof ModulePermissions,
  },
  {
    title: "Tarefas",
    url: "/tarefas",
    icon: CheckSquare,
    module: "tarefas" as keyof ModulePermissions,
  },
  {
    title: "OKRs",
    url: "/okrs",
    icon: Target,
    module: "okrs" as keyof ModulePermissions,
  },
];

const logisticaSubItems = [
  { title: "Visão Geral", url: "/logistica/dashboard", icon: LayoutDashboard },
  { title: "Simular Frete", url: "/logistica/simular-frete", icon: Calculator },
  { title: "Operadores", url: "/logistica/operadores", icon: Users },
  { title: "Solicitações", url: "/logistica/solicitacoes", icon: Package },
  { title: "Logística Reversa", url: "/logistica/reversa", icon: RotateCcw },
];

function getCurrentUser() {
  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (e) {
    console.error("Error parsing user from session:", e);
  }
  return null;
}

function getUserPermissions(): ModulePermissions {
  try {
    const user = getCurrentUser();
    if (user?.modulePermissions) {
      const perms = typeof user.modulePermissions === "string" 
        ? JSON.parse(user.modulePermissions) 
        : user.modulePermissions;
      return perms;
    }
  } catch (e) {
    console.error("Error parsing permissions:", e);
  }
  return {
    chamados: false,
    projetos: false,
    tarefas: false,
    okrs: false,
    logistica: false,
    apis: false,
    configuracoes: false,
  };
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [logisticaOpen, setLogisticaOpen] = useState(location.startsWith("/logistica"));
  
  const isLogisticaActive = location.startsWith("/logistica");
  
  const currentUser = useMemo(() => getCurrentUser(), []);
  const permissions = useMemo(() => getUserPermissions(), []);
  
  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (item.module === null) return true;
      return permissions[item.module] === true;
    });
  }, [permissions]);
  
  const hasLogisticaAccess = permissions.logistica === true;
  const hasApisAccess = permissions.apis === true;
  const hasConfiguracoesAccess = permissions.configuracoes === true;

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("modulePermissions");
    localStorage.removeItem("user");
    localStorage.removeItem("modulePermissions");
    toast({
      title: "Saindo...",
      description: "Você foi desconectado com sucesso.",
    });
    setLocation("/login");
  };
  
  const userInitials = currentUser?.name 
    ? currentUser.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "US";

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-sidebar-border">
        <Link href="/" data-testid="link-home" className="flex items-center justify-center w-full px-6">
          <RenovLogo 
            variant={theme === "dark" ? "dark" : "light"} 
            className="h-8 w-auto mx-auto" 
          />
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-3">
            Módulos Principais
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {menuItems.map((item) => {
                const isActive = location === item.url || location.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      className={`h-11 px-3 transition-all duration-200 rounded-lg ${isActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                    >
                      <Link href={item.url} data-testid={`link-${item.url.slice(1)}`}>
                        <item.icon className={`h-[20px] w-[20px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {hasLogisticaAccess && (
                <Collapsible open={logisticaOpen} onOpenChange={setLogisticaOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        className={`h-11 px-3 transition-all duration-200 rounded-lg ${isLogisticaActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                        isActive={isLogisticaActive}
                        data-testid="link-logistica"
                      >
                        <Truck className={`h-[20px] w-[20px] ${isLogisticaActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">Logística</span>
                        {logisticaOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-1.5 border-l border-sidebar-border/50 pl-2 gap-1">
                        {logisticaSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-10 px-3 rounded-md">
                                <Link href={subItem.url} data-testid={`link-${subItem.url.split("/").pop()}`}>
                                  <subItem.icon className="h-4 w-4 mr-2" />
                                  <span className="text-[13.5px]">{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {hasApisAccess && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === "/apis" || location.startsWith("/apis/")}
                    className={`h-11 px-3 transition-all duration-200 rounded-lg ${location.startsWith("/apis") ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                  >
                    <Link href="/apis" data-testid="link-apis">
                      <Code2 className={`h-[20px] w-[20px] ${location.startsWith("/apis") ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-[14px]">APIs Log</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasConfiguracoesAccess && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === "/configuracoes" || location.startsWith("/configuracoes/")}
                    className={`h-11 px-3 transition-all duration-200 rounded-lg ${location.startsWith("/configuracoes") ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                  >
                    <Link href="/configuracoes" data-testid="link-configuracoes">
                      <Settings className={`h-[20px] w-[20px] ${location.startsWith("/configuracoes") ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-[14px]">Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors"
              data-testid="button-user-menu"
            >
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-[13px] font-semibold truncate">{currentUser?.name || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{currentUser?.email || ""}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild data-testid="menu-item-profile">
              <Link href="/configuracoes" className="flex w-full items-center gap-2">
                <User className="h-4 w-4" />
                <span>Meu Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
              data-testid="menu-item-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
