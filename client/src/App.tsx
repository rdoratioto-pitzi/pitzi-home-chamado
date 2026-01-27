import { Switch, Route } from "wouter";
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
import OKRsPage from "@/pages/okrs/index";
import LogisticaPage from "@/pages/logistica/index";
import ConfiguracoesPage from "@/pages/configuracoes/index";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chamados" component={ChamadosPage} />
      <Route path="/projetos" component={ProjetosPage} />
      <Route path="/projetos/:id" component={KanbanPage} />
      <Route path="/okrs" component={OKRsPage} />
      <Route path="/logistica" component={LogisticaPage} />
      <Route path="/configuracoes" component={ConfiguracoesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

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
