// Envio pela API do Gmail com conta de serviço + delegação em todo o domínio (Google Workspace).
// A conta de serviço assina um JWT (RS256, WebCrypto) em nome do remetente (`sub`), troca por
// um access token com escopo gmail.send e envia a mensagem MIME já montada.
// Configuração passo a passo: docs/emails-gmail-setup.md.

export interface GmailEnv {
  GOOGLE_SA_CLIENT_EMAIL?: string;
  GOOGLE_SA_PRIVATE_KEY?: string;
  GMAIL_SENDER?: string;
}

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

type FetchLike = typeof fetch;

export function isGmailConfigured(env: GmailEnv): boolean {
  return !!(env.GOOGLE_SA_CLIENT_EMAIL && env.GOOGLE_SA_PRIVATE_KEY && env.GMAIL_SENDER);
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlJson(value: unknown): string {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

/** Aceita a chave com quebras reais ou com "\n" literais (como vem no JSON da conta de serviço). */
export function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function signServiceAccountJwt(
  clientEmail: string,
  privateKeyPem: string,
  subject: string,
  scope: string,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: clientEmail, sub: subject, scope, aud: TOKEN_URL, iat, exp: iat + 3600 };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
}

// Cache por isolate: reaproveita o token enquanto o isolate estiver quente.
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

export function clearGmailTokenCache(): void {
  tokenCache = null;
}

export async function getGmailAccessToken(env: GmailEnv, fetchImpl: FetchLike = fetch): Promise<string> {
  if (!isGmailConfigured(env)) throw new Error("not_configured");
  const cacheKey = `${env.GOOGLE_SA_CLIENT_EMAIL}|${env.GMAIL_SENDER}`;
  if (tokenCache && tokenCache.key === cacheKey && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const assertion = await signServiceAccountJwt(
    env.GOOGLE_SA_CLIENT_EMAIL!, env.GOOGLE_SA_PRIVATE_KEY!, env.GMAIL_SENDER!, GMAIL_SEND_SCOPE,
  );
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  if (!res.ok) throw new Error(`Gmail auth falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = { key: cacheKey, token: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000 };
  return data.access_token;
}

/** Envia a mensagem MIME (já em base64url). Devolve o id da mensagem no Gmail. */
export async function sendGmailRaw(
  env: GmailEnv,
  rawBase64Url: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ id: string; threadId?: string }> {
  const token = await getGmailAccessToken(env, fetchImpl);
  const res = await fetchImpl(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: rawBase64Url }),
  });
  if (!res.ok) {
    if (res.status === 401) clearGmailTokenCache();
    throw new Error(`Gmail envio falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as { id: string; threadId?: string };
}
