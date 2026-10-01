// Verificação do ID token do "Entrar com Google" (Google Identity Services), sem client secret:
// assinatura RS256 com as chaves públicas do Google (JWKS) e as declarações do token.
// Usado pelo Worker e pelo Express (WebCrypto + fetch existem nos dois).

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const CLOCK_SKEW_SECONDS = 60;

export interface GoogleIdentity {
  email: string;
  name: string | null;
  picture: string | null;
  /** Domínio do Google Workspace (declaração `hd`). */
  domain: string;
  subject: string;
}

export type GoogleTokenError =
  | "malformed"
  | "unknown_key"
  | "bad_signature"
  | "wrong_audience"
  | "wrong_issuer"
  | "expired"
  | "email_not_verified"
  | "domain_not_allowed";

export class GoogleTokenInvalid extends Error {
  constructor(public readonly reason: GoogleTokenError) {
    super(`ID token do Google inválido: ${reason}`);
  }
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

type FetchLike = (url: string) => Promise<Response>;

// Cache por isolate/processo, respeitando o max-age do Google.
let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

/** Só para testes: esquece as chaves em cache. */
export function resetGoogleJwksCache(): void {
  jwksCache = null;
}

async function loadJwks(fetchFn: FetchLike, force: boolean): Promise<Jwk[]> {
  if (!force && jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const res = await fetchFn(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS do Google respondeu ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  jwksCache = { keys: body.keys ?? [], expiresAt: Date.now() + maxAge * 1000 };
  return jwksCache.keys;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(part: string): Record<string, unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
  } catch {
    throw new GoogleTokenInvalid("malformed");
  }
}

/** Lista "a.com, b.com" → ["a.com", "b.com"] em minúsculas. */
export function parseAllowedDomains(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyGoogleIdToken(
  token: string,
  options: { clientId: string; allowedDomains: string[]; fetchFn?: FetchLike; now?: number },
): Promise<GoogleIdentity> {
  const fetchFn = options.fetchFn ?? ((url: string) => fetch(url));
  const parts = token.split(".");
  if (parts.length !== 3) throw new GoogleTokenInvalid("malformed");
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  const payload = decodeJson(payloadPart);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new GoogleTokenInvalid("malformed");

  let jwk = (await loadJwks(fetchFn, false)).find((k) => k.kid === header.kid);
  // O Google troca as chaves de tempos em tempos: busca de novo antes de recusar.
  if (!jwk) jwk = (await loadJwks(fetchFn, true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new GoogleTokenInvalid("unknown_key");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw new GoogleTokenInvalid("bad_signature");

  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!options.clientId || !audiences.includes(options.clientId)) throw new GoogleTokenInvalid("wrong_audience");
  if (typeof payload.iss !== "string" || !GOOGLE_ISSUERS.has(payload.iss)) throw new GoogleTokenInvalid("wrong_issuer");
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw new GoogleTokenInvalid("expired");
  }
  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new GoogleTokenInvalid("email_not_verified");
  }

  const email = String(payload.email ?? "").toLowerCase();
  const emailDomain = email.split("@")[1] ?? "";
  // `hd` só existe em contas do Google Workspace: exige-se ele, não só o domínio do e-mail,
  // para que uma conta Google pessoal criada com um e-mail da empresa não entre.
  const hd = typeof payload.hd === "string" ? payload.hd.toLowerCase() : "";
  if (!hd || hd !== emailDomain || !options.allowedDomains.includes(hd)) {
    throw new GoogleTokenInvalid("domain_not_allowed");
  }

  return {
    email,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
    domain: hd,
    subject: String(payload.sub ?? ""),
  };
}
