import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useIsTechnician } from "@/hooks/use-is-technician";

/**
 * Escolhe a tela pelo tipo de usuário: técnicos (e admins) veem a central completa;
 * o solicitante ("Usuário") vê a versão simplificada. Use dentro de ProtectedRoute.
 */
export function ByUserType({ technician, requester }: { technician: ReactNode; requester: ReactNode }) {
  return <>{useIsTechnician() ? technician : requester}</>;
}

/** Telas só da equipe (Início, Markdown, Base de Conhecimento): o Usuário vai para os seus chamados. */
export function TechnicianOnly({ children }: { children: ReactNode }) {
  return useIsTechnician() ? <>{children}</> : <Redirect to="/chamados" />;
}
