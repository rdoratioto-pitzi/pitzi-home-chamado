import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ChamadosPage from "@/pages/chamados/index";
import ProjetosPage from "@/pages/projetos/index";
import KanbanPage from "@/pages/projetos/kanban";
import TarefasPage from "@/pages/tarefas/index";
import TaskDetailPage from "@/pages/tarefas/detail";
import OKRsPage from "@/pages/okrs/index";
import LogisticaPage from "@/pages/logistica/index";
import LogisticsDashboard from "@/pages/logistica/dashboard";
import OperadoresPage from "@/pages/logistica/operadores";
import SolicitacoesPage from "@/pages/logistica/solicitacoes";
import LogisticaReversaPage from "@/pages/logistica/logistica-reversa";
import SimularFretePage from "@/pages/logistica/simular-frete";
import ApisPage from "@/pages/apis/index";
import LoginPage from "@/pages/login";
import ConfiguracoesPage from "@/pages/configuracoes/index";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chamados" component={ChamadosPage} />
      <Route path="/projetos" component={ProjetosPage} />
      <Route path="/projetos/:id" component={KanbanPage} />
      <Route path="/tarefas" component={TarefasPage} />
      <Route path="/tarefas/:id" component={TaskDetailPage} />
      <Route path="/okrs" component={OKRsPage} />
      <Route path="/logistica" component={LogisticaPage} />
      <Route path="/logistica/dashboard" component={LogisticsDashboard} />
      <Route path="/logistica/simular-frete" component={SimularFretePage} />
      <Route path="/logistica/operadores" component={OperadoresPage} />
      <Route path="/logistica/solicitacoes" component={SolicitacoesPage} />
      <Route path="/logistica/reversa" component={LogisticaReversaPage} />
      <Route path="/apis" component={ApisPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/configuracoes" component={ConfiguracoesPage} />
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
