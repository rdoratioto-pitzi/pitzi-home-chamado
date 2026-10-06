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
  buildConversationHtml,
  formatSlackTs,
  selectSlackFiles,
  slackAccessHint,
  slackMrkdwnToText,
  slackUserIdsIn,
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

describe("conversa do Slack", () => {
  const names = new Map([["U1", "Ana Lima"], ["U2", "Bruno Reis"]]);
  // 05/10/2026 13:00 de Brasília = 16:00 UTC
  const ts = (min: number) => String(Date.UTC(2026, 9, 5, 16, min) / 1000);

  it("converte mrkdwn: menções com nome, canais, links e entidades", () => {
    expect(slackMrkdwnToText("oi <@U1>, veja <#C9|suporte> e <https://x.com/a|o painel> &amp; <!here>", names))
      .toBe("oi @Ana Lima, veja #suporte e o painel (https://x.com/a) & @here");
    expect(slackMrkdwnToText("<@U9>", names)).toBe("@usuário");
    expect(slackUserIdsIn([{ ts: "1", user: "U1", text: "fala <@U2>" }]).sort()).toEqual(["U1", "U2"]);
  });

  it("horário em Brasília", () => {
    expect(formatSlackTs(ts(5))).toBe("05/10 13:05");
  });

  it("monta a conversa em ordem, com nomes, bots e anexos", () => {
    const html = buildConversationHtml({
      channelName: "suporte", permalink: "https://pitzi.slack.com/archives/C1/p1",
      names,
      messages: [
        { ts: ts(0), user: "U1", text: "a VPN caiu" },
        { ts: ts(1), subtype: "channel_join", user: "U2", text: "entrou" },
        { ts: ts(2), user: "U2", text: "reiniciei <@U1>", files: [{ name: "print.png" }] },
        { ts: ts(3), bot_id: "B1", bot_profile: { name: "Monitor" }, text: "alerta resolvido" },
      ],
    });
    expect(html).toContain("<strong>Conversa no Slack</strong> (#suporte, 3 mensagens)");
    expect(html).toContain('<a href="https://pitzi.slack.com/archives/C1/p1">');
    const order = [
      "Ana Lima</strong> (05/10 13:00): a VPN caiu",
      "Bruno Reis</strong> (05/10 13:02): reiniciei @Ana Lima<br>[anexo: print.png]",
      "Monitor</strong> (05/10 13:03): alerta resolvido",
    ].map((part) => html.indexOf(part));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain("entrou");
  });

  it("corta conversas longas e avisa quantas mensagens ficaram de fora", () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({ ts: ts(i % 59), user: "U1", text: "x".repeat(200) }));
    const html = buildConversationHtml({ messages, names, maxChars: 2_000 });
    expect(html.length).toBeLessThan(2_400);
    expect(html).toMatch(/Conversa cortada: \d+ mensagens não couberam/);
  });

  it("escapa HTML vindo do Slack", () => {
    const html = buildConversationHtml({ messages: [{ ts: ts(0), user: "U1", text: "&lt;script&gt;alert(1)&lt;/script&gt;" }], names });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("seleciona anexos aceitos (tipo e tamanho) e lista os que ficam de fora", () => {
    const { importable, skipped } = selectSlackFiles([
      { ts: "1", user: "U1", files: [
        { name: "a.png", mimetype: "image/png", size: 100, url_private_download: "https://files.slack.com/a" },
        { name: "b.exe", mimetype: "application/x-msdownload", size: 100, url_private_download: "https://files.slack.com/b" },
        { name: "c.pdf", mimetype: "application/pdf", size: 20 * 1024 * 1024, url_private_download: "https://files.slack.com/c" },
      ] },
    ]);
    expect(importable.map((f) => f.name)).toEqual(["a.png"]);
    expect(skipped).toEqual(["b.exe", "c.pdf"]);
  });

  it("explica o que falta quando não dá para ler a conversa", () => {
    expect(slackAccessHint("not_in_channel")).toContain("/invite @Chamados Pitzi");
    expect(slackAccessHint("missing_scope")).toContain("channels:history");
  });
});
