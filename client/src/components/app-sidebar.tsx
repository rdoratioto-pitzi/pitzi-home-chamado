/**
* AppSidebar - Menu lateral principal do Renov Home
*/
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
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
  LogOut,
  Video,
  DollarSign,
  BarChart3,
  Search,
  FileSpreadsheet,
  LineChart,
  PieChart,
  TrendingDown,
  Bell,
  BookOpen,
  FileText,
  Star,
  Bot,
  Printer,
  Settings2,
  Workflow,
  ClipboardList,
  Sparkles,
  GitBranch,
  Warehouse,
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
title: "Chat IA",
    url: "/macgyver-ia",
    icon: Bot,
    module: null,
  },
  {
    title: "Chamados",
    url: "/chamados",
    icon: Ticket,
    module: "chamados" as keyof ModulePermissions,
  },
  {
    title: "Tarefas",
    url: "/tarefas",
    icon: CheckSquare,
    module: "tarefas" as keyof ModulePermissions,
  },
  {
    title: "Reuniões",
    url: "/reunioes",
    icon: Video,
    module: "tarefas" as keyof ModulePermissions,
  },
  {
    title: "Projetos",
    url: "/projetos",
    icon: FolderKanban,
    module: "projetos" as keyof ModulePermissions,
  },
  {
    title: "Fluxogramas",
    url: "/fluxogramas",
    icon: Workflow,
    module: "fluxogramas" as keyof ModulePermissions,
  },
];

const metasSubItems = [
  { title: "Visão Geral", url: "/metas", icon: LayoutDashboard },
  { title: "Gestão de Metas", url: "/metas/gestao", icon: Target },
];

const logisticaSubItems = [
  { title: "Visão Geral", url: "/logistica/dashboard", icon: LayoutDashboard },
  { title: "Simular Frete", url: "/logistica/simular-frete", icon: Calculator },
  { title: "Operadores", url: "/logistica/operadores", icon: Users },
  { title: "Solicitações", url: "/logistica/solicitacoes", icon: Package },
  { title: "Logística Reversa", url: "/logistica/reversa", icon: RotateCcw },
  { title: "Romaneios", url: "/logistica/romaneios", icon: ClipboardList },
  { title: "Impressão Etiquetas", url: "/logistica/impressao-etiquetas", icon: Printer },
  { title: "Eficiência Avaliações IA", url: "/logistica/avaliacoes-ia", icon: Bot },
];

const apisSubItems = [
  { title: "Visão Geral", url: "/apis", icon: Code2 },
  { title: "Correios - Logística Reversa", url: "/apis/correios-reversa", icon: RotateCcw },
  { title: "API RS - Logística", url: "/apis/rs-logistica", icon: Truck },
  { title: "Adm. Logística", url: "/apis/adm-logistica", icon: Settings2 },
  { title: "Relatório Pedidos", url: "/apis/relatorio-pedidos", icon: FileText },
  { title: "Avaliações IA", url: "/apis/avaliacoes-ia", icon: Bot },
];

const pricingSubItems = [
  { title: "Dashboard", url: "/pricing/dashboard", icon: LayoutDashboard },
  { title: "Visão Geral", url: "/pricing", icon: Search },
  { title: "Análise de Produtos", url: "/pricing/analise", icon: BarChart3 },
  { title: "Gráficos Evolutivos", url: "/pricing/graficos", icon: LineChart },
  { title: "Indicadores de Deflação", url: "/pricing/indicadores", icon: TrendingDown },
  { title: "Alertas de Preço", url: "/pricing/alertas", icon: Bell },
  { title: "Detalhes de Produtos", url: "/pricing/detalhes", icon: Search },
  { title: "Relatórios", url: "/pricing/relatorios", icon: FileSpreadsheet },
];

const bibliotecaSubItems = [
{ title: "Biblioteca", url: "/biblioteca", icon: LayoutDashboard },
  { title: "Meus Favoritos", url: "/biblioteca/favoritos", icon: Star },
  { title: "Prompts", url: "/biblioteca/prompts", icon: Sparkles },
];

const estoquesSubItems = [
  { title: "Posição Estoques", url: "/estoques/posicao", icon: BarChart3 },
  { title: "Contagem Interna", url: "/estoques/contagem", icon: ClipboardList },
  { title: "Relatório Contagens", url: "/estoques/relatorio-contagens", icon: FileSpreadsheet },
  { title: "Dashboard", url: "/estoques/dashboard", icon: PieChart },
];

function getCurrentUser() {
  try {
    // Primeiro tenta buscar do localStorage (novo sistema de auth)
    const localStorageUser = localStorage.getItem("user_data");
    if (localStorageUser) {
      const user = JSON.parse(localStorageUser);
      // Padroniza verificação de isAdmin
      if (user) {
        const adminValue = user.isAdmin ?? user.is_admin;
        user.isAdmin = adminValue === true || adminValue === 'true' || adminValue === 1;
      }
      return user;
    }
    
    // Fallback para sessionStorage (compatibilidade com sistema antigo)
    const sessionUserStr = sessionStorage.getItem("user");
    if (sessionUserStr) {
      const user = JSON.parse(sessionUserStr);
      if (user) {
        const adminValue = user.isAdmin ?? user.is_admin;
        user.isAdmin = adminValue === true || adminValue === 'true' || adminValue === 1;
      }
      return user;
    }
  } catch (e) {
    console.error("Error parsing user from storage:", e);
  }
  return null;
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { theme } = useTheme();
  const { toast } = useToast();

  // State to force re-render when user data changes
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  useEffect(() => {
    const handleStorageChange = () => {
      const newUser = getCurrentUser();
      // Only update if user data actually changed to prevent unnecessary re-renders
      setCurrentUser(prevUser => {
        if (!prevUser && !newUser) return prevUser;
        if (prevUser && newUser && prevUser.id === newUser.id
          && prevUser.isAdmin === newUser.isAdmin
          && prevUser.modulePermissions === newUser.modulePermissions) return prevUser;
        return newUser;
      });
    };
    window.addEventListener("storage", handleStorageChange);
    // Poll to catch updates within the same tab - increased to 5 seconds to reduce server load
    const interval = setInterval(handleStorageChange, 5000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const [metasOpen, setMetasOpen] = useState(location.startsWith("/metas"));
  const [logisticaOpen, setLogisticaOpen] = useState(location.startsWith("/logistica"));
  const [apisOpen, setApisOpen] = useState(location.startsWith("/apis"));
  const [pricingOpen, setPricingOpen] = useState(location.startsWith("/pricing"));
  const [bibliotecaOpen, setBibliotecaOpen] = useState(location.startsWith("/biblioteca"));
  const [estoquesOpen, setEstoquesOpen] = useState(location.startsWith("/estoques"));

  useEffect(() => {
    if (location.startsWith("/estoques")) setEstoquesOpen(true);
  }, [location]);

  const isMetasActive = location.startsWith("/metas");
  const isLogisticaActive = location.startsWith("/logistica");
  const isApisActive = location.startsWith("/apis");
  const isPricingActive = location.startsWith("/pricing");
  const isBibliotecaActive = location.startsWith("/biblioteca");
  const isEstoquesActive = location.startsWith("/estoques");

  const permissions = useMemo(() => {
    try {
      if (currentUser?.isAdmin === true || currentUser?.isAdmin === "true") {
        return {
          chamados: true,
          projetos: true,
          tarefas: true,
          okrs: true,
          fluxogramas: true,
          logistica: true,
          pricing: true,
          biblioteca: true,
          apis: true,
          configuracoes: true,
          estoques: true,
        };
      }
      if (currentUser?.modulePermissions) {
        return typeof currentUser.modulePermissions === "string"
          ? JSON.parse(currentUser.modulePermissions)
          : currentUser.modulePermissions;
      }
    } catch (e) {
      console.error("Error parsing permissions:", e);
    }
    return {
      chamados: false,
      projetos: false,
      tarefas: false,
      okrs: false,
      fluxogramas: false,
      logistica: false,
      pricing: false,
      biblioteca: false,
      apis: false,
      configuracoes: false,
      estoques: false,
    };
  }, [currentUser]);

  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (item.module === null) return true;
      return permissions[item.module] === true;
    });
  }, [permissions]);

  const hasMetasAccess = permissions.okrs === true;
  const hasLogisticaAccess = permissions.logistica === true;
  const hasPricingAccess = permissions.pricing === true;
  const hasBibliotecaAccess = permissions.biblioteca === true;
  const hasApisAccess = permissions.apis === true;
  const hasConfiguracoesAccess = permissions.configuracoes === true;
  
  // CORREÇÃO: Verificação mais robusta para acesso ao módulo Estoques
  // Garante que o menu apareça se:
  // 1. O usuário for admin (tem acesso total)
  // 2. As permissões incluírem explicitamente estoques: true
  // 3. O usuário estiver em uma página do módulo Estoques (indicação de acesso)
  const hasEstoquesPermission = permissions.estoques === true;
  const isInEstoquesPage = location.startsWith("/estoques");
  const hasEstoquesAccess = currentUser?.isAdmin === true || currentUser?.isAdmin === "true" || hasEstoquesPermission || isInEstoquesPage;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch { }
    // Usa clearAuth do novo sistema de autenticação
    const { clearAuth } = await import("@/lib/auth");
    clearAuth();
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("modulePermissions");
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
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {menuItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));

                const handleClick = () => {
                  if (item.url === "/" && location === "/") {
                    window.location.reload();
                  }
                };

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-11 px-3 transition-all duration-200 rounded-lg ${isActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                    >
                      <Link href={item.url} data-testid={`link-${item.url.slice(1)}`} onClick={handleClick}>
                        <item.icon className={`h-[20px] w-[20px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {hasEstoquesAccess && (
                <Collapsible open={estoquesOpen} onOpenChange={setEstoquesOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={`h-11 px-3 transition-all duration-200 rounded-lg ${isEstoquesActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                        isActive={isEstoquesActive}
                        data-testid="link-estoques"
                      >
                        <Warehouse className={`h-[20px] w-[20px] ${isEstoquesActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">Estoques</span>
                        {estoquesOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-1.5 border-l border-sidebar-border/50 pl-2 gap-1">
                        {estoquesSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-10 px-3 rounded-md">
                                <Link href={subItem.url} data-testid={`link-estoques-${subItem.url.split("/").pop()}`}>
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

              {hasMetasAccess && (
                <Collapsible open={metasOpen} onOpenChange={setMetasOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={`h-11 px-3 transition-all duration-200 rounded-lg ${isMetasActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                        isActive={isMetasActive}
                        data-testid="link-metas"
                      >
                        <BarChart3 className={`h-[20px] w-[20px] ${isMetasActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">Metas</span>
                        {metasOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-1.5 border-l border-sidebar-border/50 pl-2 gap-1">
                        {metasSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-10 px-3 rounded-md">
                                <Link href={subItem.url} data-testid={`link-metas-${subItem.url.split("/").pop()}`}>
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

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/okrs"}
                  className={`h-11 px-3 transition-all duration-200 rounded-lg ${location === "/okrs" ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                >
                  <Link href="/okrs" data-testid="link-okrs">
                    <Target className={`h-[20px] w-[20px] ${location === "/okrs" ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-[14px]">OKRs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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

              {hasPricingAccess && (
                <Collapsible open={pricingOpen} onOpenChange={setPricingOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={`h-11 px-3 transition-all duration-200 rounded-lg ${isPricingActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                        isActive={isPricingActive}
                        data-testid="link-pricing"
                      >
                        <DollarSign className={`h-[20px] w-[20px] ${isPricingActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">Pricing</span>
                        {pricingOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-1.5 border-l border-sidebar-border/50 pl-2 gap-1">
                        {pricingSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-10 px-3 rounded-md">
                                <Link href={subItem.url} data-testid={`link-pricing-${subItem.url.split("/").pop()}`}>
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

              {hasBibliotecaAccess && (
                <Collapsible open={bibliotecaOpen} onOpenChange={setBibliotecaOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={`h-11 px-3 transition-all duration-200 rounded-lg ${isBibliotecaActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                        isActive={isBibliotecaActive}
                        data-testid="link-biblioteca"
                      >
                        <BookOpen className={`h-[20px] w-[20px] ${isBibliotecaActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">Biblioteca</span>
                        {bibliotecaOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-1.5 border-l border-sidebar-border/50 pl-2 gap-1">
                        {bibliotecaSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-10 px-3 rounded-md">
                                <Link href={subItem.url} data-testid={`link-biblioteca-${subItem.url.split("/").pop()}`}>
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
                <Collapsible open={apisOpen} onOpenChange={setApisOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={`h-11 px-3 transition-all duration-200 rounded-lg ${isApisActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                        isActive={isApisActive}
                        data-testid="link-integracoes"
                      >
                        <Code2 className={`h-[20px] w-[20px] ${isApisActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[14px]">Integrações</span>
                        {apisOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-1.5 border-l border-sidebar-border/50 pl-2 gap-1">
                        {apisSubItems.map((subItem) => {
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

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/git-analytics"}
                  className={`h-11 px-3 transition-all duration-200 rounded-lg ${location === "/git-analytics" ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'}`}
                >
                  <Link href="/git-analytics" data-testid="link-git-analytics">
                    <GitBranch className={`h-[20px] w-[20px] ${location === "/git-analytics" ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-[14px]">Git Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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
    </Sidebar>
  );
}

export function UserProfileMenu() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 5000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch { }
    // Usa clearAuth do novo sistema de autenticação
    const { clearAuth } = await import("@/lib/auth");
    clearAuth();
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("modulePermissions");
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
