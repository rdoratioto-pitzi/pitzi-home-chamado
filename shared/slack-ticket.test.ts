import { describe, it, expect } from "vitest";
import {
  buildTicketModal,
  firstLine,
  parseModalMetadata,
  parseTicketModal,
  plainTextToHtml,
  slackTextToPlain,
  generateSlackTicketTitle,
  verifySlackSignature,
} from "./slack-ticket";

async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${body}`));
  return `v0=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

describe("verifySlackSignature", () => {
  const secret = "segredo-de-teste";
  const body = "command=%2Fchamado&text=impressora";
  const now = 1_800_000_000;

  it("aceita assinatura válida e recente", async () => {
    const signature = await sign(secret, String(now), body);
    expect(await verifySlackSignature({ signingSecret: secret, timestamp: String(now), signature, rawBody: body, nowSeconds: now + 10 })).toBe(true);
  });

  it("recusa assinatura antiga (mais de 5 min), errada, corpo alterado ou sem segredo", async () => {
    const signature = await sign(secret, String(now), body);
    expect(await verifySlackSignature({ signingSecret: secret, timestamp: String(now), signature, rawBody: body, nowSeconds: now + 301 })).toBe(false);
    expect(await verifySlackSignature({ signingSecret: "outro", timestamp: String(now), signature, rawBody: body, nowSeconds: now })).toBe(false);
    expect(await verifySlackSignature({ signingSecret: secret, timestamp: String(now), signature, rawBody: `${body}x`, nowSeconds: now })).toBe(false);
    expect(await verifySlackSignature({ signingSecret: undefined, timestamp: String(now), signature, rawBody: body, nowSeconds: now })).toBe(false);
  });
});

describe("texto do Slack", () => {
  it("converte mrkdwn em texto simples", () => {
    expect(slackTextToPlain("Veja <https://x.com/a|o painel> e <@U123> &amp; <#C1|geral>")).toBe("Veja o painel (https://x.com/a) e  & geral");
  });

  it("primeira linha vira título com até 80 caracteres", () => {
    expect(firstLine("\n  Impressora parada \nsegunda linha")).toBe("Impressora parada");
    expect(firstLine("a".repeat(100))).toHaveLength(80);
  });

  it("texto simples vira parágrafos HTML escapados", () => {
    expect(plainTextToHtml("linha 1\nlinha 2\n\n<b>x</b>")).toBe("<p>linha 1<br>linha 2</p><p>&lt;b&gt;x&lt;/b&gt;</p>");
  });
});

describe("janela de abertura", () => {
  const metadata = { mode: "command" as const, clickerSlackId: "U1", requesterSlackId: "U1", channelId: "C1" };
  const groups = [{ key: "sap", name: "SAP" }];

  it("Gravidade só aparece para técnico/admin", () => {
    const usuario = buildTicketModal({ metadata, title: "t", description: "d", groups, showImpact: false });
    const tecnico = buildTicketModal({ metadata, title: "t", description: "d", groups, showImpact: true });
    const ids = (v: any) => v.blocks.map((b: any) => b.block_id).filter(Boolean);
    expect(ids(usuario)).toEqual(["titulo", "descricao", "grupo", "tipo"]);
    expect(ids(tecnico)).toEqual(["titulo", "descricao", "grupo", "tipo", "gravidade"]);
    expect(parseModalMetadata(usuario.private_metadata)).toEqual(metadata);
  });

  it("lê os valores enviados", () => {
    const values = parseTicketModal({
      state: {
        values: {
          titulo: { valor: { value: " Impressora " } },
          descricao: { valor: { value: "não imprime" } },
          grupo: { valor: { selected_option: { value: "sap" } } },
          tipo: { valor: { selected_option: { value: "bug" } } },
        },
      },
    });
    expect(values).toEqual({ title: "Impressora", description: "não imprime", category: "sap", type: "bug", impact: null });
    expect(parseModalMetadata("lixo")).toBeNull();
  });
});

describe("título automático", () => {
  it.each([
    ["Minha VPN não está conectando.", "Problema de acesso à VPN"],
    ["Meu notebook não liga.", "Notebook não liga"],
    ["Não consigo acessar o Google Drive.", "Problema de acesso ao Google Drive"],
    ["", "Problema relatado via Slack"],
  ])("%s → %s", (message, title) => expect(generateSlackTicketTitle(message)).toBe(title));
});
