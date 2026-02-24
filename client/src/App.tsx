import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import NotFound from "@/pages/not-found";
import { useAuthSync } from "@/hooks/useAuthSync";
import Home from "@/pages/home";
import ChamadosPage from "@/pages/chamados/index";
import ProjetosPage from "@/pages/projetos/index";
import KanbanPage from "@/pages/projetos/kanban";
import TarefasPage from "@/pages/tarefas/index";
import TaskDetailPage from "@/pages/tarefas/detail";
import ReunioesPage from "@/pages/reunioes/index";
import MeetingDetailPage from "@/pages/reunioes/detail";
import OKRsPage from "@/pages/okrs/index";
import LogisticaPage from "@/pages/logistica/index";
import LogisticsDashboard from "@/pages/logistica/dashboard";
import OperadoresPage from "@/pages/logistica/operadores";
import SolicitacoesPage from "@/pages/logistica/solicitacoes";
import LogisticaReversaPage from "@/pages/logistica/logistica-reversa";
import SimularFretePage from "@/pages/logistica/simular-frete";
import ImpressaoEtiquetasPage from "@/pages/logistica/impressao-etiquetas";
import RomaneiosPage from "@/pages/logistica/romaneios";
import ApisPage from "@/pages/apis/index";
import CorreiosReversaPage from "@/pages/apis/correios-reversa";
import ApiRsLogisticaPage from "@/pages/apis/api-rs-logistica";
import ApiAdmLogisticaPage from "@/pages/apis/api-adm-logistica";
import ApiRelatorioPedidosPage from "@/pages/apis/api-relatorio-pedidos";
import LoginPage from "@/pages/login";
import ConfiguracoesPage from "@/pages/configuracoes/index";
import PricingOverviewPage from "@/pages/pricing/index";
import PricingAnalysisPage from "@/pages/pricing/analise";
import PricingDetailsPage from "@/pages/pricing/detalhes";
import PricingReportsPage from "@/pages/pricing/relatorios";
import PricingGraficosPage from "@/pages/pricing/graficos";
import PricingIndicadoresPage from "@/pages/pricing/indicadores";
import PricingAlertasPage from "@/pages/pricing/alertas";
import PricingDashboardPage from "@/pages/pricing/dashboard";
import MetasVisaoGeralPage from "@/pages/metas/index";
import MetasGestaoPage from "@/pages/metas/gestao";
import ConhecimentoPage from "@/pages/conhecimento/index";
import ConhecimentoNovoPage from "@/pages/conhecimento/novo";
import ConhecimentoDocumentoPage from "@/pages/conhecimento/documento";
import ConhecimentoFavoritosPage from "@/pages/conhecimento/favoritos";
import PromptsPage from "@/pages/conhecimento/prompts";
import MacgyverIAPage from "@/pages/macgyver-ia/index";
import FluxogramasPage from "@/pages/fluxogramas/index";
import FlowchartEditorPage from "@/pages/fluxogramas/editor";
import UpdatesPage from "@/pages/updates/index";
import GitAnalyticsPage from "@/pages/git-analytics/index";
import EstoquesPage from "@/pages/estoques/index";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/macgyver-ia">
        <ProtectedRoute>
          <MacgyverIAPage />
        </ProtectedRoute>
      </Route>
      <Route path="/chamados">
        <ProtectedRoute requiredPermission="chamados">
          <ChamadosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/projetos">
        <ProtectedRoute requiredPermission="projetos">
          <ProjetosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/projetos/:id">
        <ProtectedRoute requiredPermission="projetos">
          <KanbanPage />
        </ProtectedRoute>
      </Route>
      <Route path="/tarefas">
        <ProtectedRoute requiredPermission="tarefas">
          <TarefasPage />
        </ProtectedRoute>
      </Route>
      <Route path="/tarefas/:id">
        <ProtectedRoute requiredPermission="tarefas">
          <TaskDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/reunioes">
        <ProtectedRoute requiredPermission="reunioes">
          <ReunioesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/reunioes/:id">
        <ProtectedRoute requiredPermission="reunioes">
          <MeetingDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/fluxogramas">
        <ProtectedRoute requiredPermission="fluxogramas">
          <FluxogramasPage />
        </ProtectedRoute>
      </Route>
      <Route path="/fluxogramas/:id">
        <ProtectedRoute requiredPermission="fluxogramas">
          <FlowchartEditorPage />
        </ProtectedRoute>
      </Route>
      <Route path="/metas">
        <ProtectedRoute requiredPermission="okrs">
          <MetasVisaoGeralPage />
        </ProtectedRoute>
      </Route>
      <Route path="/metas/gestao">
        <ProtectedRoute requiredPermission="okrs">
          <MetasGestaoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/okrs">
        <ProtectedRoute requiredPermission="okrs">
          <OKRsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica">
        <ProtectedRoute requiredPermission="logistica">
          <LogisticaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/dashboard">
        <ProtectedRoute requiredPermission="logistica">
          <LogisticsDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/simular-frete">
        <ProtectedRoute requiredPermission="logistica">
          <SimularFretePage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/operadores">
        <ProtectedRoute requiredPermission="logistica">
          <OperadoresPage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/solicitacoes">
        <ProtectedRoute requiredPermission="logistica">
          <SolicitacoesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/reversa">
        <ProtectedRoute requiredPermission="logistica">
          <LogisticaReversaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/impressao-etiquetas">
        <ProtectedRoute requiredPermission="logistica">
          <ImpressaoEtiquetasPage />
        </ProtectedRoute>
      </Route>
      <Route path="/logistica/romaneios">
        <ProtectedRoute requiredPermission="logistica">
          <RomaneiosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/apis">
        <ProtectedRoute requiredPermission="apis">
          <ApisPage />
        </ProtectedRoute>
      </Route>
      <Route path="/apis/correios-reversa">
        <ProtectedRoute requiredPermission="apis">
          <CorreiosReversaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/apis/rs-logistica">
        <ProtectedRoute requiredPermission="apis">
          <ApiRsLogisticaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/apis/adm-logistica">
        <ProtectedRoute requiredPermission="apis">
          <ApiAdmLogisticaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/apis/relatorio-pedidos">
        <ProtectedRoute requiredPermission="apis">
          <ApiRelatorioPedidosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing">
        <ProtectedRoute requiredPermission="pricing">
          <PricingOverviewPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/analise">
        <ProtectedRoute requiredPermission="pricing">
          <PricingAnalysisPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/detalhes">
        <ProtectedRoute requiredPermission="pricing">
          <PricingDetailsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/relatorios">
        <ProtectedRoute requiredPermission="pricing">
          <PricingReportsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/graficos">
        <ProtectedRoute requiredPermission="pricing">
          <PricingGraficosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/indicadores">
        <ProtectedRoute requiredPermission="pricing">
          <PricingIndicadoresPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/alertas">
        <ProtectedRoute requiredPermission="pricing">
          <PricingAlertasPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pricing/dashboard">
        <ProtectedRoute requiredPermission="pricing">
          <PricingDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/conhecimento">
        <ProtectedRoute requiredPermission="conhecimento">
          <ConhecimentoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/conhecimento/novo">
        <ProtectedRoute requiredPermission="conhecimento">
          <ConhecimentoNovoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/conhecimento/documentos">
        <ProtectedRoute requiredPermission="conhecimento">
          <ConhecimentoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/conhecimento/favoritos">
        <ProtectedRoute requiredPermission="conhecimento">
          <ConhecimentoFavoritosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/conhecimento/prompts">
        <ProtectedRoute requiredPermission="conhecimento">
          <PromptsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/conhecimento/:id">
        <ProtectedRoute requiredPermission="conhecimento">
          <ConhecimentoDocumentoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/configuracoes">
        <ProtectedRoute requiredPermission="configuracoes">
          <ConfiguracoesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/updates">
        <ProtectedRoute>
          <UpdatesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/git-analytics">
        <ProtectedRoute>
          <GitAnalyticsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location, setLocation] = useLocation();
  const isLoginPage = location === "/login";
  
  // Hook para sincronização de autenticação entre abas
  const { isAuthenticated } = useAuthSync();

  useEffect(() => {
    // Verifica autenticação usando localStorage (novo sistema)
    const user = localStorage.getItem("user_data") || sessionStorage.getItem("user");
    if (!user && !isLoginPage) {
      setLocation("/login");
    }
  }, [location, isLoginPage, setLocation, isAuthenticated]);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  if (isLoginPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <div className="flex h-screen w-full overflow-hidden">
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
// teste workflow
// teste workflow
