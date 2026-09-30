import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  GMAIL_SEND_SCOPE,
  clearGmailTokenCache,
  getGmailAccessToken,
  isGmailConfigured,
  sendGmailRaw,
  signServiceAccountJwt,
} from "./gmail";

let pem = "";
let publicKey: CryptoKey;

const b64urlToBytes = (v: string) => {
  const std = v.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(std + "=".repeat((4 - (std.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const b64urlJson = (v: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(v)));

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  publicKey = pair.publicKey;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let binary = "";
  for (const b of pkcs8) binary += String.fromCharCode(b);
  // Como vem no JSON da conta de serviço: "\n" literais.
  pem = `-----BEGIN PRIVATE KEY-----\\n${btoa(binary).match(/.{1,64}/g)!.join("\\n")}\\n-----END PRIVATE KEY-----\\n`;
});

beforeEach(() => clearGmailTokenCache());

const env = () => ({
  GOOGLE_SA_CLIENT_EMAIL: "envio@pitzi-automations-prod.iam.gserviceaccount.com",
  GOOGLE_SA_PRIVATE_KEY: pem,
  GMAIL_SENDER: "chamados@pitzi.com.br",
});

describe("JWT da conta de serviço", () => {
  it("RS256 com sub = remetente, escopo gmail.send e assinatura válida", async () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const jwt = await signServiceAccountJwt(env().GOOGLE_SA_CLIENT_EMAIL, pem, "chamados@pitzi.com.br", GMAIL_SEND_SCOPE, now);
    const [h, c, s] = jwt.split(".");
    expect(b64urlJson(h)).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = b64urlJson(c);
    expect(claims).toMatchObject({
      iss: env().GOOGLE_SA_CLIENT_EMAIL,
      sub: "chamados@pitzi.com.br",
      scope: "https://www.googleapis.com/auth/gmail.send",
      aud: "https://oauth2.googleapis.com/token",
      iat: now.getTime() / 1000,
      exp: now.getTime() / 1000 + 3600,
    });
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});

describe("token e envio", () => {
  it("sem segredos não está configurado e não chama a API", async () => {
    const fetchMock = vi.fn();
    expect(isGmailConfigured({ GMAIL_SENDER: "x@y.com" })).toBe(false);
    await expect(getGmailAccessToken({ GMAIL_SENDER: "x@y.com" }, fetchMock as any)).rejects.toThrow("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("troca o JWT por token (jwt-bearer), reaproveita o cache e envia o raw", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok-1", expires_in: 3600 }), { status: 200 });
      return new Response(JSON.stringify({ id: "gmail-msg-1", threadId: "th-1" }), { status: 200 });
    });
    const first = await sendGmailRaw(env(), "cmF3", fetchMock as any);
    await sendGmailRaw(env(), "cmF3Mg", fetchMock as any);
    expect(first).toEqual({ id: "gmail-msg-1", threadId: "th-1" });

    const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("oauth2"));
    expect(tokenCalls).toHaveLength(1);
    const body = new URLSearchParams(String(tokenCalls[0][1].body));
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(body.get("assertion")!.split(".")).toHaveLength(3);

    const sendCall = fetchMock.mock.calls.find(([u]) => String(u).includes("messages/send"))!;
    expect((sendCall[1].headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(JSON.parse(String(sendCall[1].body))).toEqual({ raw: "cmF3" });
  });

  it("erro da API vira exceção com o status", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("oauth2")
        ? new Response(JSON.stringify({ error: "unauthorized_client" }), { status: 401 })
        : new Response("{}", { status: 200 }),
    );
    await expect(sendGmailRaw(env(), "cmF3", fetchMock as any)).rejects.toThrow(/Gmail auth falhou \(401\)/);
  });
});
