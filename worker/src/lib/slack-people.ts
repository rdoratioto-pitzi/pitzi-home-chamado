// Quem é quem: usuário do Slack → usuário dos chamados, pelo e-mail do perfil do Slack.
// Quem ainda não tem cadastro e é de um domínio liberado (ALLOWED_GOOGLE_DOMAINS) entra como
// "Usuário", igual ao primeiro login com Google.
import { hasModulePermission } from "../../../shared/permissions";
import { eq } from "drizzle-orm";
import { users, type User } from "../../../shared/schema";
import { findOrProvisionGoogleUser } from "../../../server/services/google-login.service";
import { slackApi } from "./slack-api";

export type SlackPersonResult =
  | { ok: true; user: User }
  | { ok: false; message: string };

export function allowedDomains(raw: string | undefined): string[] {
  return (raw || "pitzi.com.br").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

/**
 * Resolve (e cria, se preciso) o usuário dos chamados de um usuário do Slack.
 * Guarda o slack_user_id para as próximas vezes.
 */
export async function resolveSlackPerson(
  db: any,
  env: { SLACK_BOT_TOKEN?: string; ALLOWED_GOOGLE_DOMAINS?: string },
  slackUserId: string,
): Promise<SlackPersonResult> {
  if (!slackUserId) return { ok: false, message: "Usuário do Slack inválido." };
  const [known] = await db.select().from(users).where(eq(users.slackUserId, slackUserId)).limit(1);
  if (known) {
    if (known.status !== "active") return { ok: false, message: "Sua conta nos chamados está desativada." };
    if (!hasModulePermission(known, "chamados")) return { ok: false, message: "Sua conta não tem permissão para acessar chamados." };
    return { ok: true, user: known };
  }

  const info = await slackApi(env.SLACK_BOT_TOKEN!, "users.info", { user: slackUserId });
  const profile = info.user?.profile ?? {};
  const email = String(profile.email ?? "").trim().toLowerCase();
  if (!info.ok || !email) {
    return { ok: false, message: "Não consegui ler o e-mail desse usuário no Slack." };
  }
  if (info.user?.is_bot) return { ok: false, message: "Mensagens de bots não viram chamado." };
  const domain = email.split("@")[1] ?? "";
  if (!allowedDomains(env.ALLOWED_GOOGLE_DOMAINS).includes(domain)) {
    return { ok: false, message: `O e-mail ${email} não é de um domínio liberado para os chamados.` };
  }

  const name = String(profile.real_name || profile.display_name || info.user?.real_name || "").trim() || null;
  const result = await findOrProvisionGoogleUser(db, {
    email, name, picture: profile.image_192 ?? null, domain, subject: `slack:${slackUserId}`,
  });
  if (!result.ok) return { ok: false, message: "Sua conta nos chamados está desativada." };

  if (!hasModulePermission(result.user, "chamados")) return { ok: false, message: "Sua conta não tem permissão para acessar chamados." };
  if (result.user.slackUserId !== slackUserId) {
    await db.update(users).set({ slackUserId }).where(eq(users.id, result.user.id));
  }
  return { ok: true, user: { ...result.user, slackUserId } };
}
