// Consulta ao banco para as regras de shared/user-type.ts (Worker e Express).
import { canBeAssignee } from "../../shared/user-type";
import type { IStorage } from "../storage";

/** O usuário existe, está ativo e é técnico (ou admin). */
export async function isTechnicianUserId(storage: IStorage, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return canBeAssignee(await storage.getUser(userId));
}
