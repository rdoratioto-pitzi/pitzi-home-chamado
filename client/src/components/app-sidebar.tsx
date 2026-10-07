import { Link, useLocation } from "wouter";
import { Home, Ticket, Plus, FileText, Settings, User, LogOut, ChevronDown, BookOpen, Laptop } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { VersionBadge } from "./version-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { getUserPermissions } from "@/lib/permissions";
import { useIsTechnician } from "@/hooks/use-is-technician";

// Logo do topo do menu: azul no tema claro, branco no escuro (troca pela classe "dark").
const LOGO_BASE = `${import.meta.env.BASE_URL}brand/`;
function MenuLogo() {
  return (
    <>
      <img src={`${LOGO_BASE}pitzi-logo-menu.png`} alt="Pitzi" className="block h-9 w-auto dark:hidden" />
      <img src={`${LOGO_BASE}pitzi-logo-menu-white.png`} alt="Pitzi" className="hidden h-9 w-auto dark:block" />
    </>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const permissions = getUserPermissions(user);
  const isTech = useIsTechnician();
  if (!isTech) return <RequesterSidebar location={location} />;
  const items = [
    { title: "Início", url: "/", icon: Home, visible: true },
    { title: "Chamados", url: "/chamados", icon: Ticket, visible: true },
    { title: "Novo chamado", url: "/chamados/novo", icon: Plus, visible: permissions.chamados },
    { title: "Base de Conhecimento", url: "/conhecimento", icon: BookOpen, visible: true },
    { title: "Equipamentos", url: "/equipamentos", icon: Laptop, visible: true },
    { title: "Markdown", url: "/markdown", icon: FileText, visible: true },
    { title: "Configurações", url: "/configuracoes", icon: Settings, visible: permissions.configuracoes || permissions.campos_chamado },
  ];
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border/40">
        <Link href="/" aria-label="Pitzi — Início"><MenuLogo /></Link>
        <span className="text-xs text-muted-foreground">Central de chamados</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup><SidebarGroupContent><SidebarMenu>
          {items.filter(item => item.visible).map(item => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={location === item.url} className="h-9 px-3">
                <Link href={item.url} data-testid={`link-${item.url.slice(1).replaceAll("/", "-")}`}>
                  <item.icon className="h-5 w-5" /><span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu></SidebarGroupContent></SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-0 border-t border-border/40"><VersionBadge /></SidebarFooter>
    </Sidebar>
  );
}

/** Menu do solicitante ("Usuário"): só os seus chamados e o botão de abrir chamado. */
function RequesterSidebar({ location }: { location: string }) {
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border/40">
        <Link href="/chamados" aria-label="Pitzi — Meus chamados"><MenuLogo /></Link>
        <span className="text-xs text-muted-foreground">Central de chamados</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup><SidebarGroupContent className="flex flex-col gap-3">
          <Link
            href="/chamados/novo"
            className="flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#3B42DE" }}
            data-testid="link-abrir-chamado"
          >
            <Plus className="h-4 w-4" /> Abrir chamado
          </Link>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/chamados"} className="h-9 px-3">
                <Link href="/chamados" data-testid="link-meus-chamados">
                  <Ticket className="h-5 w-5" /><span>Meus chamados</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent></SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-0 border-t border-border/40"><VersionBadge /></SidebarFooter>
    </Sidebar>
  );
}

export function UserProfileMenu() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user: currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted transition-colors max-w-[200px]"
          data-testid="button-user-menu"
        >
          <Avatar className="h-8 w-8 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left overflow-hidden hidden sm:block">
            <p className="text-[13px] font-semibold truncate leading-none mb-0.5">{currentUser?.name || "Usuário"}</p>
            <p className="text-[11px] text-muted-foreground truncate leading-none">{currentUser?.email || ""}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-50 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 mt-1">
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
  );
}
