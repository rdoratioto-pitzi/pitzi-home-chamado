import { useAuth } from "@/contexts/auth-context";
import { isTechnician } from "@shared/user-type";

/** O usuário logado é técnico (ou admin): atende chamados, vê a fila e escreve notas internas. */
export function useIsTechnician(): boolean {
  const { user } = useAuth();
  return isTechnician({ isAdmin: user?.isAdmin === true, isTechnician: user?.isTechnician === true });
}

/** Filtra a lista de usuários para os que podem ser responsáveis (técnicos/admins ativos). */
export function onlyTechnicians<T extends { isAdmin?: boolean | null; isTechnician?: boolean | null; status?: string | null }>(
  users: readonly T[],
): T[] {
  return users.filter((u) => (u.status ?? "active") === "active" && isTechnician(u));
}
