import { Link, useLocation } from "wouter";
import { useState } from "react";
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

const menuItems = [
  {
    title: "Chamados",
    url: "/chamados",
    icon: Ticket,
  },
  {
    title: "Projetos",
    url: "/projetos",
    icon: FolderKanban,
  },
  {
    title: "Tarefas",
    url: "/tarefas",
    icon: CheckSquare,
  },
  {
    title: "OKRs",
    url: "/okrs",
    icon: Target,
  },
];

const logisticaSubItems = [
  { title: "Visão Geral", url: "/logistica/dashboard", icon: LayoutDashboard },
  { title: "Simular Frete", url: "/logistica/simular-frete", icon: Calculator },
  { title: "Operadores", url: "/logistica/operadores", icon: Users },
  { title: "Solicitações", url: "/logistica/solicitacoes", icon: Package },
  { title: "Logística Reversa", url: "/logistica/reversa", icon: RotateCcw },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [logisticaOpen, setLogisticaOpen] = useState(location.startsWith("/logistica"));
  
  const isLogisticaActive = location.startsWith("/logistica");

  const handleLogout = () => {
    toast({
      title: "Saindo...",
      description: "Você foi desconectado com sucesso.",
    });
    setLocation("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" data-testid="link-home">
          <RenovLogo 
            variant={theme === "dark" ? "dark" : "light"} 
            className="h-12 w-auto" 
          />
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || location.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      className="mx-2"
                    >
                      <Link href={item.url} data-testid={`link-${item.url.slice(1)}`}>
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              <Collapsible open={logisticaOpen} onOpenChange={setLogisticaOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      className="mx-2"
                      isActive={isLogisticaActive}
                      data-testid="link-logistica"
                    >
                      <Truck className="h-5 w-5" />
                      <span className="font-medium">Logística</span>
                      {logisticaOpen ? (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {logisticaSubItems.map((subItem) => {
                        const isSubActive = location === subItem.url;
                        return (
                          <SidebarMenuSubItem key={subItem.url}>
                            <SidebarMenuSubButton asChild isActive={isSubActive}>
                              <Link href={subItem.url} data-testid={`link-${subItem.url.split("/").pop()}`}>
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={location === "/apis" || location.startsWith("/apis/")}
                  className="mx-2"
                >
                  <Link href="/apis" data-testid="link-apis">
                    <Code2 className="h-5 w-5" />
                    <span className="font-medium">APIs Log</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={location === "/configuracoes" || location.startsWith("/configuracoes/")}
                  className="mx-2"
                >
                  <Link href="/configuracoes" data-testid="link-configuracoes">
                    <Settings className="h-5 w-5" />
                    <span className="font-medium">Configurações</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center gap-3 w-full p-2 rounded-md hover-elevate"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-muted-foreground">admin@renov.com</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
