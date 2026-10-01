// Política de login: somente Google quando GOOGLE_LOGIN_CLIENT_ID está configurado.
// - Sem client id (transição): login por senha continua valendo para todos.
// - Com client id: senha recusada para todos, exceto admins quando a chave de emergência
//   PASSWORD_LOGIN_ENABLED="true" estiver ligada (docs/login-google-setup.md).
import { parseAllowedDomains } from "./google-id-token";

export interface AuthPolicyEnv {
  GOOGLE_LOGIN_CLIENT_ID?: string;
  ALLOWED_GOOGLE_DOMAINS?: string;
  PASSWORD_LOGIN_ENABLED?: string;
}

/** "all" = todos entram com senha; "admins" = só admins (emergência); "off" = só Google. */
export type PasswordLoginMode = "all" | "admins" | "off";

export function googleLoginClientId(env: AuthPolicyEnv): string {
  return (env.GOOGLE_LOGIN_CLIENT_ID ?? "").trim();
}

export function allowedGoogleDomains(env: AuthPolicyEnv): string[] {
  const domains = parseAllowedDomains(env.ALLOWED_GOOGLE_DOMAINS);
  return domains.length > 0 ? domains : ["pitzi.com.br"];
}

export function passwordLoginMode(env: AuthPolicyEnv): PasswordLoginMode {
  if (!googleLoginClientId(env)) return "all";
  return (env.PASSWORD_LOGIN_ENABLED ?? "").trim().toLowerCase() === "true" ? "admins" : "off";
}

export function canUsePasswordLogin(env: AuthPolicyEnv, user: { isAdmin?: boolean | null }): boolean {
  const mode = passwordLoginMode(env);
  return mode === "all" || (mode === "admins" && user.isAdmin === true);
}

/** Resposta pública de GET /api/auth/config (o client id do Google não é segredo). */
export function publicAuthConfig(env: AuthPolicyEnv) {
  return {
    googleClientId: googleLoginClientId(env) || null,
    allowedDomains: allowedGoogleDomains(env),
    passwordLogin: passwordLoginMode(env),
  };
}

export const USE_GOOGLE_MESSAGE = "Entre com a sua conta Google da Pitzi.";
export const INACTIVE_ACCOUNT_MESSAGE = "Sua conta está desativada. Fale com um administrador.";
