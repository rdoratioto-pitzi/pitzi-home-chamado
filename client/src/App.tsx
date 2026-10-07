// Pitzi Home - Sistema de Gestão Operacional
import React, { lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
const SidebarProvider = lazy(() => import("@/components/ui/sidebar").then(m => ({ default: m.SidebarProvider })));
import { useAuthSync } from "@/hooks/useAuthSync";
import { AuthProvider } from "@/contexts/auth-context";
import { WorkspaceErrorBoundary } from "@/components/workspace/WorkspaceErrorBoundary";

const AppSidebar    = lazy(() => import("@/components/app-sidebar").then(m => ({ default: m.AppSidebar })));
const ProtectedRoute = lazy(() => import("@/components/protected-route").then(m => ({ default: m.ProtectedRoute })));
const ByUserType = lazy(() => import("@/components/user-type-route").then(m => ({ default: m.ByUserType })));
const TechnicianOnly = lazy(() => import("@/components/user-type-route").then(m => ({ default: m.TechnicianOnly })));

const LoginPage = lazy(() => import("@/pages/login"));
const HomePage = lazy(() => import("@/pages/home"));
const RedefinirSenhaPage = lazy(() => import("@/pages/redefinir-senha"));
const ChamadosPage = lazy(() => import("@/pages/workspace/WorkspacePage"));
const NovoChamadoPage = lazy(() => import("@/pages/chamados/novo"));
const TicketDetailPage = lazy(() => import("@/pages/chamados/[id]"));
// Versão simplificada para o solicitante ("Usuário", quem não é técnico).
const MeusChamadosPage = lazy(() => import("@/pages/chamados/meus-chamados"));
const RequesterTicketPage = lazy(() => import("@/pages/chamados/requester-ticket"));
const CSATAnalytics = lazy(() => import("@/pages/chamados/csat-analytics"));
const ConfiguracoesPage = lazy(() => import("@/pages/configuracoes/index"));
const MarkdownPage = lazy(() => import("@/pages/markdown"));
const ConhecimentoPage = lazy(() => import("@/pages/conhecimento/index"));
const ArtigoPage = lazy(() => import("@/pages/conhecimento/artigo"));
const EquipamentosPage = lazy(() => import("@/pages/equipamentos/index"));
const NovoArtigoPage = lazy(() => import("@/pages/conhecimento/artigo").then(m => ({ default: m.NovoArtigoPage })));

function Router() {
  return (
    <Switch>
      <Route path="/login"><LoginPage /></Route>
      <Route path="/redefinir-senha"><RedefinirSenhaPage /></Route>
      <Route path="/">
        <ProtectedRoute><ByUserType technician={<HomePage />} requester={<Redirect to="/chamados" />} /></ProtectedRoute>
      </Route>
      <Route path="/chamados">
        <ProtectedRoute>
          <ByUserType
            technician={<WorkspaceErrorBoundary><ChamadosPage /></WorkspaceErrorBoundary>}
            requester={<MeusChamadosPage />}
          />
        </ProtectedRoute>
      </Route>
      <Route path="/chamados/novo">
        <ProtectedRoute requiredPermission="chamados"><NovoChamadoPage /></ProtectedRoute>
      </Route>
      <Route path="/chamados/csat-analytics">
        <ProtectedRoute requiredPermission="chamados"><TechnicianOnly><CSATAnalytics /></TechnicianOnly></ProtectedRoute>
      </Route>
      <Route path="/chamados/:id">
        <ProtectedRoute requiredPermission="chamados">
          <ByUserType technician={<TicketDetailPage />} requester={<RequesterTicketPage />} />
        </ProtectedRoute>
      </Route>
      <Route path="/markdown">
        <ProtectedRoute><TechnicianOnly><MarkdownPage /></TechnicianOnly></ProtectedRoute>
      </Route>
      {/* Base de Conhecimento: só para a equipe nas telas (o Usuário vai para os seus chamados);
          criar e editar é validado na API. */}
      <Route path="/conhecimento">
        <ProtectedRoute><TechnicianOnly><ConhecimentoPage /></TechnicianOnly></ProtectedRoute>
      </Route>
      <Route path="/conhecimento/novo">
        <ProtectedRoute><TechnicianOnly><NovoArtigoPage /></TechnicianOnly></ProtectedRoute>
      </Route>
      <Route path="/conhecimento/:id">
        <ProtectedRoute><TechnicianOnly><ArtigoPage /></TechnicianOnly></ProtectedRoute>
      </Route>
      {/* Equipamentos (inventário do OCS): só para a equipe; a API também exige técnico. */}
      <Route path="/equipamentos">
        <ProtectedRoute><TechnicianOnly><EquipamentosPage /></TechnicianOnly></ProtectedRoute>
      </Route>
      <Route path="/configuracoes">
        <ProtectedRoute requiredPermission="configuracoes"><ConfiguracoesPage /></ProtectedRoute>
      </Route>
      {/* URLs antigas do workspace e de módulos desativados levam ao início. */}
      <Route><Redirect to="/" /></Route>
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  // Telas públicas, sem sidebar nem verificação de sessão.
  const isLoginPage = location === "/login" || location === "/redefinir-senha";

  // Hook para sincronização de autenticação entre abas
  useAuthSync();

  const sidebarStyle = {
    "--sidebar-width": "15.5rem",
    "--sidebar-width-icon": "3.375rem",
  };

  if (isLoginPage) {
    return (
      <ThemeProvider>
        <TooltipProvider>
          <div className="flex h-screen w-full overflow-hidden bg-background">
            <main className="flex-1 overflow-auto bg-background">
              <Suspense fallback={null}>
                <Router />
              </Suspense>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <TooltipProvider>
        <Suspense fallback={null}>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full bg-background">
              <AppSidebar />
              <main className="flex-1 overflow-auto bg-background">
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
