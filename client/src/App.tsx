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
import ApisPage from "@/pages/apis/index";
import CorreiosReversaPage from "@/pages/apis/correios-reversa";
import LoginPage from "@/pages/login";
import ConfiguracoesPage from "@/pages/configuracoes/index";
import PricingOverviewPage from "@/pages/pricing/index";
import PricingAnalysisPage from "@/pages/pricing/analise";
import PricingDetailsPage from "@/pages/pricing/detalhes";
import PricingReportsPage from "@/pages/pricing/relatorios";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
        <ProtectedRoute requiredPermission="tarefas">
          <ReunioesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/reunioes/:id">
        <ProtectedRoute requiredPermission="tarefas">
          <MeetingDetailPage />
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
      <Route path="/login" component={LoginPage} />
      <Route path="/configuracoes">
        <ProtectedRoute requiredPermission="configuracoes">
          <ConfiguracoesPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";

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
