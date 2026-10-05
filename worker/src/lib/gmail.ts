// Envio pela API do Gmail com conta de serviço + delegação em todo o domínio (Google Workspace).
// A conta de serviço assina um JWT (RS256, WebCrypto) em nome do remetente (`sub`), troca por
// um access token e envia a mensagem MIME já montada. A leitura da caixa (respostas por e-mail,
// worker/src/lib/inbound-email.ts) usa outro token, com escopo gmail.modify: se esse escopo não
// estiver autorizado na delegação, só a leitura falha; o envio continua com gmail.send.
// Configuração passo a passo: docs/emails-gmail-setup.md.

export interface GmailEnv {
  GOOGLE_SA_CLIENT_EMAIL?: string;
  GOOGLE_SA_PRIVATE_KEY?: string;
  GMAIL_SENDER?: string;
}

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
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

// Cache por isolate e por escopo: reaproveita o token enquanto o isolate estiver quente.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function clearGmailTokenCache(): void {
  tokenCache.clear();
}

export async function getGmailAccessToken(
  env: GmailEnv,
  fetchImpl: FetchLike = fetch,
  scope: string = GMAIL_SEND_SCOPE,
): Promise<string> {
  if (!isGmailConfigured(env)) throw new Error("not_configured");
  const cacheKey = `${env.GOOGLE_SA_CLIENT_EMAIL}|${env.GMAIL_SENDER}|${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const assertion = await signServiceAccountJwt(
    env.GOOGLE_SA_CLIENT_EMAIL!, env.GOOGLE_SA_PRIVATE_KEY!, env.GMAIL_SENDER!, scope,
  );
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  if (!res.ok) throw new Error(`Gmail auth falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000 });
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

// ============== LEITURA DA CAIXA (gmail.modify) ==============

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailScopeError extends Error {}

async function gmailFetch<T>(env: GmailEnv, path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch): Promise<T> {
  let token: string;
  try {
    token = await getGmailAccessToken(env, fetchImpl, GMAIL_MODIFY_SCOPE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // unauthorized_client / access_denied: escopo gmail.modify não autorizado na delegação.
    if (/unauthorized_client|access_denied|invalid_scope/i.test(message)) throw new GmailScopeError(message);
    throw error;
  }
  const res = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    if (res.status === 401) clearGmailTokenCache();
    const body = (await res.text()).slice(0, 300);
    if (res.status === 403 && /insufficient|scope/i.test(body)) throw new GmailScopeError(body);
    throw new Error(`Gmail ${path} falhou (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
}

export async function listGmailMessages(
  env: GmailEnv,
  query: string,
  maxResults: number,
  fetchImpl: FetchLike = fetch,
): Promise<Array<{ id: string }>> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const data = await gmailFetch<{ messages?: Array<{ id: string }> }>(env, `/messages?${params}`, {}, fetchImpl);
  return data.messages ?? [];
}

export function getGmailMessage(env: GmailEnv, id: string, fetchImpl: FetchLike = fetch): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(env, `/messages/${encodeURIComponent(id)}?format=full`, {}, fetchImpl);
}

export async function getGmailAttachment(
  env: GmailEnv,
  messageId: string,
  attachmentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<Uint8Array> {
  const data = await gmailFetch<{ data?: string }>(
    env, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, {}, fetchImpl,
  );
  return base64UrlToBytes(data.data ?? "");
}

/** Garante os marcadores e devolve { nome → id }. */
export async function ensureGmailLabels(
  env: GmailEnv,
  names: readonly string[],
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, string>> {
  const existing = await gmailFetch<{ labels?: Array<{ id: string; name: string }> }>(env, "/labels", {}, fetchImpl);
  const ids: Record<string, string> = {};
  for (const label of existing.labels ?? []) ids[label.name] = label.id;
  for (const name of names) {
    if (ids[name]) continue;
    const created = await gmailFetch<{ id: string }>(env, "/labels", {
      method: "POST",
      body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
    }, fetchImpl);
    ids[name] = created.id;
  }
  return ids;
}

export async function modifyGmailMessage(
  env: GmailEnv,
  id: string,
  change: { addLabelIds?: string[]; removeLabelIds?: string[] },
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await gmailFetch(env, `/messages/${encodeURIComponent(id)}/modify`, {
    method: "POST",
    body: JSON.stringify(change),
  }, fetchImpl);
}

export function base64UrlToBytes(data: string): Uint8Array {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeBase64UrlText(data: string | undefined): string {
  if (!data) return "";
  return new TextDecoder("utf-8").decode(base64UrlToBytes(data));
}
