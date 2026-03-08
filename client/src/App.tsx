// Renov Home - Sistema de Gestão Operacional
import React, { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
const SidebarProvider = lazy(() => import("@/components/ui/sidebar").then(m => ({ default: m.SidebarProvider })));
import { useAuthSync } from "@/hooks/useAuthSync";

const AppSidebar    = lazy(() => import("@/components/app-sidebar").then(m => ({ default: m.AppSidebar })));
const ProtectedRoute = lazy(() => import("@/components/protected-route").then(m => ({ default: m.ProtectedRoute })));

// Lazy-loaded pages — cada módulo só carrega quando a rota é acessada.
// Isso reduz as requisições iniciais de ~800 para apenas as dependências
// da página atual (tipicamente < 30 chunks no login).
const NotFound                         = lazy(() => import("@/pages/not-found"));
const Home                             = lazy(() => import("@/pages/home"));
const LoginPage                        = lazy(() => import("@/pages/login"));
const ChatIAPage                       = lazy(() => import("@/pages/macgyver-ia/index"));
const ChamadosPage                     = lazy(() => import("@/pages/chamados/index"));
const CSATAnalytics                    = lazy(() => import("@/pages/chamados/csat-analytics"));
const ProjetosPage                     = lazy(() => import("@/pages/projetos/index"));
const KanbanPage                       = lazy(() => import("@/pages/projetos/kanban"));
const TarefasPage                      = lazy(() => import("@/pages/tarefas/index"));
const TaskDetailPage                   = lazy(() => import("@/pages/tarefas/detail"));
const ReunioesPage                     = lazy(() => import("@/pages/reunioes/index"));
const MeetingDetailPage                = lazy(() => import("@/pages/reunioes/detail"));
const OKRsPage                         = lazy(() => import("@/pages/okrs/index"));
const LogisticaPage                    = lazy(() => import("@/pages/logistica/index"));
const LogisticsDashboard               = lazy(() => import("@/pages/logistica/dashboard"));
const OperadoresPage                   = lazy(() => import("@/pages/logistica/operadores"));
const SolicitacoesPage                 = lazy(() => import("@/pages/logistica/solicitacoes"));
const LogisticaReversaPage             = lazy(() => import("@/pages/logistica/logistica-reversa"));
const SimularFretePage                 = lazy(() => import("@/pages/logistica/simular-frete"));
const ImpressaoEtiquetasPage           = lazy(() => import("@/pages/logistica/impressao-etiquetas"));
const RomaneiosPage                    = lazy(() => import("@/pages/logistica/romaneios"));
const EficienciaAvaliacoesIaPage       = lazy(() => import("@/pages/logistica/avaliacoes-ia"));
const ApisPage                         = lazy(() => import("@/pages/apis/index"));
const CorreiosReversaPage              = lazy(() => import("@/pages/apis/correios-reversa"));
const ApiRsLogisticaPage               = lazy(() => import("@/pages/apis/api-rs-logistica"));
const ApiAdmLogisticaPage              = lazy(() => import("@/pages/apis/api-adm-logistica"));
const ApiAvaliacoesIaPage              = lazy(() => import("@/pages/apis/api-avaliacoes-ia"));
const ApiRelatorioPedidosPage          = lazy(() => import("@/pages/apis/api-relatorio-pedidos"));
const ConfiguracoesPage                = lazy(() => import("@/pages/configuracoes/index"));
const PricingOverviewPage              = lazy(() => import("@/pages/pricing/index"));
const PricingAnalysisPage              = lazy(() => import("@/pages/pricing/analise"));
const PricingDetailsPage               = lazy(() => import("@/pages/pricing/detalhes"));
const PricingReportsPage               = lazy(() => import("@/pages/pricing/relatorios"));
const PricingGraficosPage              = lazy(() => import("@/pages/pricing/graficos"));
const PricingIndicadoresPage           = lazy(() => import("@/pages/pricing/indicadores"));
const PricingAlertasPage               = lazy(() => import("@/pages/pricing/alertas"));
const PricingDashboardPage             = lazy(() => import("@/pages/pricing/dashboard"));
const MetasVisaoGeralPage              = lazy(() => import("@/pages/metas/index"));
const MetasGestaoPage                  = lazy(() => import("@/pages/metas/gestao"));
const BibliotecaPage                   = lazy(() => import("@/pages/biblioteca/index"));
const BibliotecaNovoPage               = lazy(() => import("@/pages/biblioteca/novo"));
const BibliotecaDocumentoPage          = lazy(() => import("@/pages/biblioteca/documento"));
const BibliotecaFavoritosPage          = lazy(() => import("@/pages/biblioteca/favoritos"));
const BibliotecaPromptsPage            = lazy(() => import("@/pages/biblioteca/prompts"));
const FluxogramasPage                  = lazy(() => import("@/pages/fluxogramas/index"));
const FlowchartEditorPage              = lazy(() => import("@/pages/fluxogramas/editor"));
const UpdatesPage                      = lazy(() => import("@/pages/updates/index"));
const GitAnalyticsPage                 = lazy(() => import("@/pages/git-analytics/index"));
const EstoquesPosicaoPage              = lazy(() => import("@/pages/estoques/posicao"));
const EstoquesContagemPage             = lazy(() => import("@/pages/estoques/contagem"));
const EstoquesRelatorioContagensPage   = lazy(() => import("@/pages/estoques/relatorio-contagens"));
const EstoquesRelatorioContagemDetalhePage = lazy(() => import("@/pages/estoques/relatorio-contagens/[id]"));
const EstoquesDashboardPage            = lazy(() => import("@/pages/estoques/dashboard"));
const EstoquesPipelinePage             = lazy(() => import("@/pages/estoques/pipeline"));
const EstoquesLeadTimePage             = lazy(() => import("@/pages/estoques/lead-time"));
const OmieIntegration                  = lazy(() => import("@/pages/integrations/omie/OmieIntegration"));
const NovoChamadoPage                  = lazy(() => import("@/pages/chamados/novo"));
const TicketDetailPage                 = lazy(() => import("@/pages/chamados/[id]"));
const EstoquesPage                     = lazy(() => import("@/pages/estoques/index"));

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/chat-ia">
        <ProtectedRoute>
          <ChatIAPage />
        </ProtectedRoute>
      </Route>
      <Route path="/chamados">
        <ProtectedRoute requiredPermission="chamados">
          <ChamadosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/chamados/csat-analytics">
        <ProtectedRoute requiredPermission="chamados">
          <CSATAnalytics />
        </ProtectedRoute>
      </Route>
      <Route path="/chamados/novo">
        <ProtectedRoute requiredPermission="chamados">
          <NovoChamadoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/chamados/:id">
        <ProtectedRoute requiredPermission="chamados">
          <TicketDetailPage />
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
      <Route path="/logistica/avaliacoes-ia">
        <ProtectedRoute requiredPermission="logistica">
          <EficienciaAvaliacoesIaPage />
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
      <Route path="/apis/avaliacoes-ia">
        <ProtectedRoute requiredPermission="apis">
          <ApiAvaliacoesIaPage />
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
      <Route path="/biblioteca">
        <ProtectedRoute requiredPermission="conhecimento">
          <BibliotecaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/biblioteca/novo">
        <ProtectedRoute requiredPermission="conhecimento">
          <BibliotecaNovoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/biblioteca/documentos">
        <ProtectedRoute requiredPermission="conhecimento">
          <BibliotecaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/biblioteca/favoritos">
        <ProtectedRoute requiredPermission="conhecimento">
          <BibliotecaFavoritosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/biblioteca/prompts">
        <ProtectedRoute requiredPermission="conhecimento">
          <BibliotecaPromptsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/biblioteca/:id">
        <ProtectedRoute requiredPermission="conhecimento">
          <BibliotecaDocumentoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/login">
        <LoginPage />
      </Route>
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
          <EstoquesPosicaoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/posicao">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesPosicaoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/contagem">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesContagemPage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/relatorio-contagens">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesRelatorioContagensPage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/relatorio-contagens/:id">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesRelatorioContagemDetalhePage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/dashboard">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/pipeline">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesPipelinePage />
        </ProtectedRoute>
      </Route>
      <Route path="/estoques/lead-time">
        <ProtectedRoute requiredPermission="estoques">
          <EstoquesLeadTimePage />
        </ProtectedRoute>
      </Route>
      <Route path="/integrations/omie">
        <ProtectedRoute>
          <OmieIntegration />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";

  // Hook para sincronização de autenticação entre abas
  useAuthSync();

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
                <Suspense fallback={null}>
                  <Router />
                </Suspense>
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
          <Suspense fallback={null}>
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <Suspense fallback={null}>
                    <Router />
                  </Suspense>
                </main>
              </div>
            </SidebarProvider>
          </Suspense>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
