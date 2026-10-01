// Tipo de usuário: Técnico atende chamados; Usuário só abre e acompanha os seus.
// Regra única para Worker, Express e telas. Admin sempre conta como técnico.

export const USER_TYPES = [
  { value: "tecnico", label: "Técnico" },
  { value: "usuario", label: "Usuário" },
] as const;

export const TECHNICIAN_REQUIRED_ERROR = "Responsável precisa ser um técnico";
export const TECHNICIAN_MEMBER_ERROR = "Só técnicos podem ser membros de grupos de atendimento";

export interface UserTypeLike {
  isAdmin?: boolean | null;
  isTechnician?: boolean | null;
  status?: string | null;
}

export function isTechnician(user: UserTypeLike | null | undefined): boolean {
  if (!user) return false;
  return user.isAdmin === true || user.isTechnician === true;
}

/** Técnico ativo: pode receber chamados e entrar em grupos de atendimento. */
export function canBeAssignee(user: UserTypeLike | null | undefined): boolean {
  return !!user && (user.status ?? "active") === "active" && isTechnician(user);
}

export function userTypeLabel(user: UserTypeLike | null | undefined): string {
  return isTechnician(user) ? "Técnico" : "Usuário";
}
