import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { GoogleTokenInvalid, resetGoogleJwksCache, verifyGoogleIdToken } from "./google-id-token";
import { canUsePasswordLogin, passwordLoginMode, publicAuthConfig } from "./auth-policy";

const CLIENT_ID = "123-test.apps.googleusercontent.com";
let keys: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

/** ID token assinado com a chave de teste; `claims` sobrescreve o padrão válido. */
async function signGoogleToken(
  privateKey: CryptoKey,
  kid: string,
  claims: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = enc({ alg: "RS256", kid, typ: "JWT" });
  const payload = enc({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "1001",
    email: "Nova.Pessoa@pitzi.com.br",
    email_verified: true,
    hd: "pitzi.com.br",
    name: "Nova Pessoa",
    picture: "https://lh3.googleusercontent.com/a/x",
    iat: now,
    exp: now + 3600,
    ...claims,
  });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

let jwksCalls = 0;
const fetchJwks = async () => {
  jwksCalls++;
  return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "cache-control": "public, max-age=600" } });
};
const verify = (token: string) =>
  verifyGoogleIdToken(token, { clientId: CLIENT_ID, allowedDomains: ["pitzi.com.br"], fetchFn: fetchJwks });
const reason = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof GoogleTokenInvalid ? e.reason : String(e);
  }
};

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  jwk = { ...((await crypto.subtle.exportKey("jwk", keys.publicKey)) as JsonWebKey), kid: "k1" };
});
beforeEach(() => {
  resetGoogleJwksCache();
  jwksCalls = 0;
});

describe("verifyGoogleIdToken", () => {
  it("aceita token válido e normaliza o e-mail", async () => {
    const identity = await verify(await signGoogleToken(keys.privateKey, "k1"));
    expect(identity).toMatchObject({ email: "nova.pessoa@pitzi.com.br", name: "Nova Pessoa", domain: "pitzi.com.br" });
  });

  it("guarda as chaves em cache", async () => {
    await verify(await signGoogleToken(keys.privateKey, "k1"));
    await verify(await signGoogleToken(keys.privateKey, "k1"));
    expect(jwksCalls).toBe(1);
  });

  it("recusa outro client id, emissor, token vencido e e-mail não verificado", async () => {
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k1", { aud: "outro" })))).toBe("wrong_audience");
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k1", { iss: "evil.com" })))).toBe("wrong_issuer");
    const old = Math.floor(Date.now() / 1000) - 7200;
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k1", { exp: old })))).toBe("expired");
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k1", { email_verified: false })))).toBe("email_not_verified");
  });

  it("exige conta do Google Workspace do domínio permitido", async () => {
    const outro = { email: "x@outra.com", hd: "outra.com" };
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k1", outro)))).toBe("domain_not_allowed");
    // Conta Google pessoal criada com e-mail da empresa: não tem `hd`.
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k1", { hd: undefined })))).toBe("domain_not_allowed");
  });

  it("recusa assinatura adulterada e chave desconhecida", async () => {
    const token = await signGoogleToken(keys.privateKey, "k1");
    const [h, , sig] = token.split(".");
    const forged = `${h}.${enc({ email: "admin@pitzi.com.br", hd: "pitzi.com.br" })}.${sig}`;
    expect(await reason(verify(forged))).toBe("bad_signature");
    expect(await reason(verify(await signGoogleToken(keys.privateKey, "k2")))).toBe("unknown_key");
    expect(await reason(verify("abc"))).toBe("malformed");
  });
});

describe("política de login", () => {
  it("sem client id: senha para todos", () => {
    expect(passwordLoginMode({})).toBe("all");
    expect(canUsePasswordLogin({}, { isAdmin: false })).toBe(true);
    expect(publicAuthConfig({ GOOGLE_LOGIN_CLIENT_ID: " " })).toEqual({
      googleClientId: null, allowedDomains: ["pitzi.com.br"], passwordLogin: "all",
    });
  });

  it("com client id: só Google, inclusive para admin", () => {
    const env = { GOOGLE_LOGIN_CLIENT_ID: CLIENT_ID, PASSWORD_LOGIN_ENABLED: "false" };
    expect(passwordLoginMode(env)).toBe("off");
    expect(canUsePasswordLogin(env, { isAdmin: true })).toBe(false);
    expect(canUsePasswordLogin(env, { isAdmin: false })).toBe(false);
  });

  it("chave de emergência libera senha só para admin", () => {
    const env = { GOOGLE_LOGIN_CLIENT_ID: CLIENT_ID, PASSWORD_LOGIN_ENABLED: "true" };
    expect(passwordLoginMode(env)).toBe("admins");
    expect(canUsePasswordLogin(env, { isAdmin: true })).toBe(true);
    expect(canUsePasswordLogin(env, { isAdmin: false })).toBe(false);
  });
});
