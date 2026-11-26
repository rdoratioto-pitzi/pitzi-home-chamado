// Quem é quem: usuário do Slack → usuário dos chamados, pelo e-mail do perfil do Slack.
// Quem ainda não tem cadastro e é de um domínio liberado (ALLOWED_GOOGLE_DOMAINS) entra como
// "Usuário", igual ao primeiro login com Google.
import { hasModulePermission } from "../../../shared/permissions";
import { eq } from "drizzle-orm";
import { users, type User } from "../../../shared/schema";
import { findOrProvisionGoogleUser } from "../../../server/services/google-login.service";
import { slackApi } from "./slack-api";
import { pickRequesterSlackId, type SlackThreadMessage } from "../../../shared/slack-ticket";

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

/** Quantas mensagens do canal são olhadas para adivinhar o solicitante. */
const HISTORY_LIMIT = 20;

/**
 * O palpite pode mesmo ser solicitante? Confere SEM criar cadastro.
 *
 * `resolveSlackPerson` provisiona quem ainda não tem conta — correto no envio da janela, errado
 * aqui: palpite não pode deixar conta nova para trás quando o técnico troca o nome. Sem esta
 * conferência, um convidado externo falando no canal viraria sugestão e o chamado só quebraria
 * no envio, com a janela já fechada.
 */
async function canBeRequester(
  db: any,
  env: { SLACK_BOT_TOKEN?: string; ALLOWED_GOOGLE_DOMAINS?: string },
  slackUserId: string,
): Promise<boolean> {
  const [known] = await db.select().from(users).where(eq(users.slackUserId, slackUserId)).limit(1);
  if (known) return known.status === "active" && hasModulePermission(known, "chamados");
  const info = await slackApi(env.SLACK_BOT_TOKEN!, "users.info", { user: slackUserId });
  if (!info.ok || info.user?.is_bot || info.user?.deleted) return false;
  const email = String(info.user?.profile?.email ?? "").trim().toLowerCase();
  if (!email) return false;
  return allowedDomains(env.ALLOWED_GOOGLE_DOMAINS).includes(email.split("@")[1] ?? "");
}

/**
 * Palpite de solicitante a partir da conversa do canal onde o /chamado foi digitado.
 *
 * Só funciona onde o app está: em DM entre duas pessoas o bot não é membro e nem enxerga quem
 * é o outro lado — por isso DM (canal "D...") nem chega a ser consultada. Devolver null não é
 * falha: a janela abre com quem digitou, e o seletor continua lá para escolher na mão.
 */
export async function suggestRequesterFromChannel(
  db: any,
  env: { SLACK_BOT_TOKEN?: string; ALLOWED_GOOGLE_DOMAINS?: string },
  channelId: string | null | undefined,
  clickerSlackId: string,
  nowMs: number = Date.now(),
): Promise<{ slackUserId: string; atMs: number } | null> {
  const token = env.SLACK_BOT_TOKEN;
  if (!token || !channelId || channelId.startsWith("D")) return null;
  const page = await slackApi(token, "conversations.history", { channel: channelId, limit: HISTORY_LIMIT });
  if (!page.ok) return null;
  const palpite = pickRequesterSlackId((page.messages ?? []) as SlackThreadMessage[], clickerSlackId, nowMs);
  if (!palpite) return null;
  return (await canBeRequester(db, env, palpite.slackUserId)) ? palpite : null;
}
