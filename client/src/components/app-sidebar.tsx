import { Link, useLocation } from "wouter";
import { 
  Ticket, 
  FolderKanban, 
  Target, 
  Truck, 
  Settings,
  ChevronDown,
  CheckSquare
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
import { useTheme } from "@/hooks/use-theme";

const menuItems = [
  {
    title: "Gestão de Chamados",
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
  {
    title: "Logística",
    url: "/logistica",
    icon: Truck,
  },
  {
    title: "Configurações",
    url: "/configuracoes",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme } = useTheme();

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
            <DropdownMenuItem data-testid="menu-item-profile">
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="menu-item-logout">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
