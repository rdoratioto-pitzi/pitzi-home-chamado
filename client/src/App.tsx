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

const LoginPage = lazy(() => import("@/pages/login"));
const HomePage = lazy(() => import("@/pages/home"));
const RedefinirSenhaPage = lazy(() => import("@/pages/redefinir-senha"));
const ChamadosPage = lazy(() => import("@/pages/workspace/WorkspacePage"));
const NovoChamadoPage = lazy(() => import("@/pages/chamados/novo"));
const TicketDetailPage = lazy(() => import("@/pages/chamados/[id]"));
const CSATAnalytics = lazy(() => import("@/pages/chamados/csat-analytics"));
const ConfiguracoesPage = lazy(() => import("@/pages/configuracoes/index"));

function Router() {
  return (
    <Switch>
      <Route path="/login"><LoginPage /></Route>
      <Route path="/redefinir-senha"><RedefinirSenhaPage /></Route>
      <Route path="/">
        <ProtectedRoute><HomePage /></ProtectedRoute>
      </Route>
      <Route path="/chamados">
        <ProtectedRoute>
          <WorkspaceErrorBoundary><ChamadosPage /></WorkspaceErrorBoundary>
        </ProtectedRoute>
      </Route>
      <Route path="/chamados/novo">
        <ProtectedRoute requiredPermission="chamados"><NovoChamadoPage /></ProtectedRoute>
      </Route>
      <Route path="/chamados/csat-analytics">
        <ProtectedRoute requiredPermission="chamados"><CSATAnalytics /></ProtectedRoute>
      </Route>
      <Route path="/chamados/:id">
        <ProtectedRoute requiredPermission="chamados"><TicketDetailPage /></ProtectedRoute>
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
