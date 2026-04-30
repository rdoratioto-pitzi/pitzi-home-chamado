/**
* AppSidebar - Menu lateral principal do Renov Home
*/
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useWorkspaceCounts } from "@/hooks/use-workspace-counts";
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
  PenLine,
  ClipboardList,
  Sparkles,
  GitBranch,
  Warehouse,
  GitMerge,
  Clock,
  Route,
  LayoutGrid,
  Factory,
  AlertTriangle,
  ScanEye,
  Filter,
  TrendingUp,
  History,
  Boxes,
  Briefcase,
  Compass,
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
import { VersionBadge } from "./version-badge";
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
import { useAuth } from "@/contexts/auth-context";
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
    url: "/chat-ia",
    icon: Bot,
    module: null,
  },
];

const workspaceSubItems = [
  { title: "Todos", url: "/workspace", icon: LayoutGrid },
  { title: "Chamados", url: "/workspace/chamados", icon: Ticket },
  { title: "Projetos", url: "/workspace/projetos", icon: FolderKanban },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Reuniões", url: "/reunioes", icon: Video },
  { title: "Fluxogramas", url: "/fluxogramas", icon: Workflow },
  { title: "Diagramas", url: "/diagramas", icon: PenLine },
];

const metasSubItems = [
  { title: "Visão Geral", url: "/metas", icon: LayoutDashboard },
  { title: "Gestão de Metas", url: "/metas/gestao", icon: Target },
];

const okrsSubItems = [
  { title: "Visão Geral", url: "/okrs", icon: LayoutDashboard },
  { title: "Dashboard", url: "/okrs/dashboard", icon: PieChart },
];

// Logística — lista plana consolidada (achatada).
// Antes existiam 2 sub-collapsibles internos (Dashboard + Operações). Foram fundidos
// em uma única lista para nivelar todo o menu em no máximo 2 níveis colapsáveis.
const logisticaItems = [
  { title: "Visão Geral", url: "/logistica/dashboard", icon: LayoutDashboard },
  { title: "Dispositivos", url: "/logistica/dispositivos", icon: Warehouse },
  { title: "Coletas", url: "/logistica/coletas", icon: Truck },
  { title: "Consulta", url: "/logistica/consulta", icon: Search },
  { title: "Fechamentos", url: "/logistica/fechamentos", icon: Calculator },
  { title: "Simular Frete", url: "/logistica/simular-frete", icon: Calculator },
  { title: "Operadores", url: "/logistica/operadores", icon: Users },
  { title: "Solicitações", url: "/logistica/solicitacoes", icon: Package },
  { title: "Logística Reversa", url: "/logistica/reversa", icon: RotateCcw },
  { title: "Romaneios", url: "/logistica/romaneios", icon: ClipboardList },
];

const triagemSubItems = [
  { title: "Dashboard", url: "/triagem/dashboard", icon: LayoutDashboard },
  { title: "Recebimentos", url: "/triagem/recebimentos", icon: Package },
  { title: "Fila de Triagem", url: "/triagem/fila", icon: ClipboardList },
  { title: "Desvios", url: "/triagem/desvios", icon: AlertTriangle },
  { title: "Impressão Etiquetas", url: "/triagem/impressao-etiquetas", icon: Printer },
];

const avaliacoesSubItems = [
  { title: "Dashboard", url: "/avaliacoes/dashboard", icon: LayoutDashboard },
  { title: "Curadoria", url: "/avaliacoes/curadoria", icon: ClipboardList },
  { title: "Histórico", url: "/avaliacoes/historico", icon: History },
  { title: "Matriz de Confusão", url: "/avaliacoes/matriz", icon: FileSpreadsheet },
  { title: "Configurações", url: "/avaliacoes/configuracoes", icon: Settings2 },
];

const apisSubItems = [
  { title: "Visão Geral", url: "/apis", icon: Code2 },
  { title: "Correios - Logística Reversa", url: "/apis/correios-reversa", icon: RotateCcw },
  { title: "API RS - Logística", url: "/apis/rs-logistica", icon: Truck },
  { title: "Adm. Logística", url: "/apis/adm-logistica", icon: Settings2 },
  { title: "Relatório Pedidos", url: "/apis/relatorio-pedidos", icon: FileText },
  { title: "Avaliações IA", url: "/apis/avaliacoes-ia", icon: Bot },
  { title: "Estoque", url: "/apis/estoque", icon: Package },
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
  { title: "Dashboard", url: "/estoques/dashboard", icon: LayoutDashboard },
  { title: "Posição Estoques", url: "/estoques/posicao", icon: BarChart3 },
  { title: "Pipeline", url: "/estoques/pipeline", icon: Workflow },
  { title: "Lead Time", url: "/estoques/lead-time", icon: Clock },
  { title: "Aging Report", url: "/estoques/aging", icon: TrendingDown },
  { title: "Contagem Interna", url: "/estoques/contagem", icon: ClipboardList },
  { title: "Rastreabilidade", url: "/estoques/rastreabilidade", icon: Search },
];

const comercialSubItems = [
  { title: "Simulador CPD", url: "/comercial/simulador", icon: Calculator },
];

const apoioVendasSubItems = [
  { title: "Início", url: "/apoio-vendas", icon: LayoutDashboard },
  { title: "Gestão", url: "/apoio-vendas/gestao", icon: TrendingUp },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { theme } = useTheme();
  const { toast } = useToast();
  const { user: currentUser, logout } = useAuth();

  const isWorkspaceRoute = (loc: string) =>
    loc.startsWith("/workspace") || loc.startsWith("/tarefas") || loc.startsWith("/reunioes") || loc.startsWith("/fluxogramas") || loc.startsWith("/diagramas");
  const isMetasRoute = (loc: string) => loc.startsWith("/metas");
  const isOkrsRoute = (loc: string) => loc.startsWith("/okrs");

  const isOperacoesRoute = (loc: string) =>
    loc.startsWith("/logistica") || loc.startsWith("/triagem") || loc.startsWith("/avaliacoes") || loc.startsWith("/estoques");
  const isNegociosRoute = (loc: string) =>
    loc.startsWith("/pricing") || loc.startsWith("/comercial") || loc.startsWith("/apoio-vendas");
  const isGestaoRoute = (loc: string) =>
    loc.startsWith("/okrs") || loc.startsWith("/metas");
  const isAnalyticsRoute = (loc: string) =>
    loc.startsWith("/git-analytics");

  const [workspaceOpen, setWorkspaceOpen] = useState(isWorkspaceRoute(location));
  const [metasOpen, setMetasOpen] = useState(isMetasRoute(location));
  const [okrsOpen, setOkrsOpen] = useState(isOkrsRoute(location));
  const [logisticaOpen, setLogisticaOpen] = useState(location.startsWith("/logistica"));
  const [triagemOpen, setTriagemOpen] = useState(location.startsWith("/triagem"));
  const [avaliacoesOpen, setAvaliacoesOpen] = useState(location.startsWith("/avaliacoes"));
  const [apisOpen, setApisOpen] = useState(location.startsWith("/apis"));
  const [pricingOpen, setPricingOpen] = useState(location.startsWith("/pricing"));
  const [bibliotecaOpen, setBibliotecaOpen] = useState(location.startsWith("/biblioteca"));
  const [estoquesOpen, setEstoquesOpen] = useState(location.startsWith("/estoques"));
  const [comercialOpen, setComercialOpen] = useState(location.startsWith("/comercial"));
  const [apoioVendasOpen, setApoioVendasOpen] = useState(location.startsWith("/apoio-vendas"));

  // Novos collapsibles de primeiro nível (substituem os SidebarGroupLabel decorativos).
  const [operacoesOpen, setOperacoesOpen] = useState(isOperacoesRoute(location));
  const [negociosOpen, setNegociosOpen] = useState(isNegociosRoute(location));
  const [gestaoOpen, setGestaoOpen] = useState(isGestaoRoute(location));
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsRoute(location));

  const { data: workspaceCounts } = useWorkspaceCounts();
  const workspaceCount = workspaceCounts?.todos ?? null;

  useEffect(() => {
    if (location.startsWith("/estoques")) setEstoquesOpen(true);
    if (location.startsWith("/comercial")) setComercialOpen(true);
    if (location.startsWith("/avaliacoes")) setAvaliacoesOpen(true);
    if (location.startsWith("/apoio-vendas")) setApoioVendasOpen(true);
    if (location.startsWith("/logistica")) setLogisticaOpen(true);
    if (location.startsWith("/triagem")) setTriagemOpen(true);
    if (location.startsWith("/pricing")) setPricingOpen(true);
    if (isOperacoesRoute(location)) setOperacoesOpen(true);
    if (isNegociosRoute(location)) setNegociosOpen(true);
    if (isGestaoRoute(location)) setGestaoOpen(true);
    if (isAnalyticsRoute(location)) setAnalyticsOpen(true);
    if (isWorkspaceRoute(location)) setWorkspaceOpen(true);
    if (isMetasRoute(location)) setMetasOpen(true);
    if (isOkrsRoute(location)) setOkrsOpen(true);
  }, [location]);

  const isWorkspaceActive = isWorkspaceRoute(location);
  const isMetasActive = isMetasRoute(location);
  const isOkrsActive = isOkrsRoute(location);
  const isLogisticaActive = location.startsWith("/logistica");
  const isTriagemActive = location.startsWith("/triagem");
  const isApisActive = location.startsWith("/apis");
  const isPricingActive = location.startsWith("/pricing");
  const isBibliotecaActive = location.startsWith("/biblioteca");
  const isEstoquesActive = location.startsWith("/estoques");
  const isComercialActive = location.startsWith("/comercial");
  const isApoioVendasActive = location.startsWith("/apoio-vendas");
  const isAvaliacoesActive = location.startsWith("/avaliacoes");
  const isOperacoesActive = isOperacoesRoute(location);
  const isNegociosActive = isNegociosRoute(location);
  const isGestaoActive = isGestaoRoute(location);
  const isAnalyticsActive = isAnalyticsRoute(location);

  const permissions = useMemo(() => {
    try {
      if (currentUser?.isAdmin) {
        return {
          chamados: true,
          projetos: true,
          tarefas: true,
          okrs: true,
          fluxogramas: true,
          diagramas: true,
          logistica: true,
          triagem: true,
          pricing: true,
          conhecimento: true,
          apis: true,
          configuracoes: true,
          estoques: true,
          avaliacoes: true,
          comercial: true,
          apoio_vendas: true,
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
      diagramas: false,
      logistica: false,
      triagem: false,
      pricing: false,
      conhecimento: false,
      apis: false,
      configuracoes: false,
      estoques: false,
      avaliacoes: false,
      comercial: false,
      apoio_vendas: false,
    };
  }, [currentUser]);

  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (item.module === null) return true;
      return permissions[item.module] === true;
    });
  }, [permissions]);

  const hasMetasAccess = permissions.metas === true;
  const hasOkrsAccess = permissions.okrs === true;
  const hasLogisticaAccess = permissions.logistica === true;
  const hasTriagemAccess = permissions.triagem === true;
  const hasPricingAccess = permissions.pricing === true;
  const hasBibliotecaAccess = permissions.conhecimento === true;
  const hasApisAccess = permissions.apis === true;
  const hasConfiguracoesAccess = permissions.configuracoes === true;

  // Acesso ao módulo Estoques: admin, permissão explícita ou usuário já navegando dentro do módulo.
  const hasEstoquesPermission = permissions.estoques === true;
  const isInEstoquesPage = location.startsWith("/estoques");
  const hasEstoquesAccess = currentUser?.isAdmin || hasEstoquesPermission || isInEstoquesPage;
  const hasComercialAccess = permissions.comercial === true;
  const hasAvaliacoesAccess = permissions.avaliacoes === true;
  const hasApoioVendasAccess = permissions.apoio_vendas === true;
  const hasOperacoesAccess = hasEstoquesAccess || hasLogisticaAccess || hasTriagemAccess || hasAvaliacoesAccess;
  const hasNegociosVisible = hasPricingAccess || hasComercialAccess || hasApoioVendasAccess;
  const hasGestaoVisible = hasOkrsAccess || hasMetasAccess;
  const hasAnalyticsVisible = hasApisAccess;

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
    <Sidebar className="border-r" style={{ borderRightColor: 'var(--sep)' }}>
      <SidebarHeader className="h-14 flex items-center justify-center">
        <Link href="/" data-testid="link-home" className="flex items-center justify-center w-full px-6">
          <RenovLogo
            variant={theme === "dark" ? "dark" : "light"}
            className="h-8 w-auto mx-auto"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {/* ── Grupo principal: itens de primeiro nível (sem labels decorativos) ── */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
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
                      className="h-9 px-3"
                    >
                      <Link href={item.url} data-testid={`link-${item.url.slice(1)}`} onClick={handleClick}>
                        <item.icon className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Workspace */}
              <Collapsible open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="h-9 px-3"
                      isActive={isWorkspaceActive}
                      data-testid="link-workspace"
                    >
                      <LayoutGrid className="h-[20px] w-[20px]" />
                      <span className="text-[12px]">Workspace</span>
                      {workspaceCount !== null && (
                        <span className="ml-auto mr-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#00c853]/15 px-1.5 text-[10px] font-semibold text-[#00c853]">
                          {workspaceCount}
                        </span>
                      )}
                      {workspaceOpen ? (
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">
                      {workspaceSubItems.map((subItem) => {
                        const isSubActive = location === subItem.url ||
                          (subItem.url !== "/workspace" && location.startsWith(subItem.url + "/"));
                        return (
                          <SidebarMenuSubItem key={subItem.url}>
                            <SidebarMenuSubButton asChild isActive={isSubActive} className="h-8 px-2 rounded-md">
                              <Link href={subItem.url} data-testid={`link-workspace-${subItem.title.toLowerCase()}`}>
                                <subItem.icon className="h-4 w-4 mr-2" />
                                <span className="text-[12px]">{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Operações — collapsible de primeiro nível */}
              {hasOperacoesAccess && (
                <Collapsible open={operacoesOpen} onOpenChange={setOperacoesOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="h-9 px-3"
                        isActive={isOperacoesActive}
                        data-testid="link-operacoes"
                      >
                        <Boxes className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">Operações</span>
                        {operacoesOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">

                        {/* Logística — sub-collapsible com lista plana de 10 itens */}
                        {hasLogisticaAccess && (
                          <Collapsible open={logisticaOpen} onOpenChange={setLogisticaOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isLogisticaActive} className="h-8 px-2 rounded-md" data-testid="link-logistica">
                                  <Truck className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Logística</span>
                                  {logisticaOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {logisticaItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-logistica-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {/* Triagem — sub-collapsible */}
                        {hasTriagemAccess && (
                          <Collapsible open={triagemOpen} onOpenChange={setTriagemOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isTriagemActive} className="h-8 px-2 rounded-md" data-testid="link-triagem">
                                  <Filter className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Triagem</span>
                                  {triagemOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {triagemSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-triagem-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {/* Avaliações — sub-collapsible */}
                        {hasAvaliacoesAccess && (
                          <Collapsible open={avaliacoesOpen} onOpenChange={setAvaliacoesOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isAvaliacoesActive} className="h-8 px-2 rounded-md" data-testid="link-avaliacoes">
                                  <ScanEye className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Avaliações</span>
                                  {avaliacoesOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {avaliacoesSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-avaliacoes-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {/* Estoque — sub-collapsible */}
                        {hasEstoquesAccess && (
                          <Collapsible open={estoquesOpen} onOpenChange={setEstoquesOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isEstoquesActive} className="h-8 px-2 rounded-md" data-testid="link-estoques">
                                  <Warehouse className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Estoque</span>
                                  {estoquesOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {estoquesSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-estoques-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Negócios — collapsible de primeiro nível */}
              {hasNegociosVisible && (
                <Collapsible open={negociosOpen} onOpenChange={setNegociosOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="h-9 px-3"
                        isActive={isNegociosActive}
                        data-testid="link-negocios"
                      >
                        <Briefcase className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">Negócios</span>
                        {negociosOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">

                        {/* Pricing */}
                        {hasPricingAccess && (
                          <Collapsible open={pricingOpen} onOpenChange={setPricingOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isPricingActive} className="h-8 px-2 rounded-md" data-testid="link-pricing">
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Pricing</span>
                                  {pricingOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {pricingSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-pricing-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {/* Comercial */}
                        {hasComercialAccess && (
                          <Collapsible open={comercialOpen} onOpenChange={setComercialOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isComercialActive} className="h-8 px-2 rounded-md" data-testid="link-comercial">
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Comercial</span>
                                  {comercialOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {comercialSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-comercial-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {/* Apoio a Vendas */}
                        {hasApoioVendasAccess && (
                          <Collapsible open={apoioVendasOpen} onOpenChange={setApoioVendasOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isApoioVendasActive} className="h-8 px-2 rounded-md" data-testid="link-apoio-vendas">
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Apoio a Vendas</span>
                                  {apoioVendasOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {apoioVendasSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-apoio-vendas-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Gestão — collapsible de primeiro nível */}
              {hasGestaoVisible && (
                <Collapsible open={gestaoOpen} onOpenChange={setGestaoOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="h-9 px-3"
                        isActive={isGestaoActive}
                        data-testid="link-gestao"
                      >
                        <Compass className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">Gestão</span>
                        {gestaoOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">

                        {/* OKRs */}
                        {hasOkrsAccess && (
                          <Collapsible open={okrsOpen} onOpenChange={setOkrsOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isOkrsActive} className="h-8 px-2 rounded-md" data-testid="link-okrs">
                                  <Target className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">OKRs</span>
                                  {okrsOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {okrsSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url;
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-okrs-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {/* Metas */}
                        {hasMetasAccess && (
                          <Collapsible open={metasOpen} onOpenChange={setMetasOpen}>
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton isActive={isMetasActive} className="h-8 px-2 rounded-md" data-testid="link-metas">
                                  <BarChart3 className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">Metas</span>
                                  {metasOpen ? (
                                    <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                  ) : (
                                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                                  )}
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub className="ml-4 mt-1 border-l pl-1.5 gap-0.5">
                                  {metasSubItems.map((subItem) => {
                                    const isSubActive = location === subItem.url || location.startsWith(subItem.url + "/");
                                    return (
                                      <SidebarMenuSubItem key={subItem.url}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="h-7 px-2 rounded-md">
                                          <Link href={subItem.url} data-testid={`link-metas-${subItem.url.split("/").pop()}`}>
                                            <subItem.icon className="h-3.5 w-3.5 mr-2" />
                                            <span className="text-[11px]">{subItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Analytics — collapsible de primeiro nível */}
              {hasAnalyticsVisible && (
                <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="h-9 px-3"
                        isActive={isAnalyticsActive}
                        data-testid="link-analytics"
                      >
                        <BarChart3 className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">Analytics</span>
                        {analyticsOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === "/git-analytics" || location.startsWith("/git-analytics/")}
                            className="h-8 px-2 rounded-md"
                          >
                            <Link href="/git-analytics" data-testid="link-git-analytics">
                              <GitBranch className="h-4 w-4 mr-2" />
                              <span className="text-[12px]">Git Analytics</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Biblioteca */}
              {hasBibliotecaAccess && (
                <Collapsible open={bibliotecaOpen} onOpenChange={setBibliotecaOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="h-9 px-3"
                        isActive={isBibliotecaActive}
                        data-testid="link-biblioteca"
                      >
                        <BookOpen className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">Biblioteca</span>
                        {bibliotecaOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">
                        {bibliotecaSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-8 px-2 rounded-md">
                                <Link href={subItem.url} data-testid={`link-biblioteca-${subItem.url.split("/").pop()}`}>
                                  <subItem.icon className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">{subItem.title}</span>
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

              {/* Integrações */}
              {hasApisAccess && (
                <Collapsible open={apisOpen} onOpenChange={setApisOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="h-9 px-3"
                        isActive={isApisActive}
                        data-testid="link-integracoes"
                      >
                        <Code2 className="h-[20px] w-[20px]" />
                        <span className="text-[12px]">Integrações</span>
                        {apisOpen ? (
                          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-2 mt-1 border-l pl-1.5 gap-0.5">
                        {apisSubItems.map((subItem) => {
                          const isSubActive = location === subItem.url;
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive} className="h-8 px-2 rounded-md">
                                <Link href={subItem.url} data-testid={`link-${subItem.url.split("/").pop()}`}>
                                  <subItem.icon className="h-4 w-4 mr-2" />
                                  <span className="text-[12px]">{subItem.title}</span>
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

              {/* Configurações */}
              {hasConfiguracoesAccess && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/configuracoes" || location.startsWith("/configuracoes/")}
                    className="h-9 px-3"
                  >
                    <Link href="/configuracoes" data-testid="link-configuracoes">
                      <Settings className="h-[20px] w-[20px]" />
                      <span className="text-[12px]">Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-0 border-t border-border/40">
        <VersionBadge />
      </SidebarFooter>
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
