import { describe, it, expect } from "vitest";
import {
  base64UrlUtf8,
  buildMimeMessage,
  encodeHeaderValue,
  formatAddress,
  ticketThreadRootId,
} from "./email-mime";

const decodeB64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** Decodifica um cabeçalho RFC 2047 (só o formato B que geramos). */
function decodeHeader(value: string): string {
  return value
    .split(/\r\n /)
    .map((w) => {
      const m = w.match(/^=\?UTF-8\?B\?(.*)\?=$/);
      return m ? decodeB64(m[1]) : w;
    })
    .join("");
}

describe("encodeHeaderValue", () => {
  it("mantém ASCII como está", () => {
    expect(encodeHeaderValue("[CHA-0001] Teste")).toBe("[CHA-0001] Teste");
  });

  it("codifica acentos em UTF-8/base64 e decodifica de volta sem perder caracteres", () => {
    const subject = "[CHA-0042] Não consigo acessar o sistema de ponto — urgente ção ção ção";
    const encoded = encodeHeaderValue(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    for (const word of encoded.split("\r\n ")) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeHeader(encoded)).toBe(subject);
  });

  it("remove quebras de linha (evita injeção de cabeçalho)", () => {
    expect(encodeHeaderValue("a\r\nBcc: x@y.com")).toBe("a Bcc: x@y.com");
  });
});

describe("formatAddress", () => {
  it("nome com acento é codificado; e-mail fica limpo", () => {
    expect(formatAddress({ email: "a@b.com" })).toBe("a@b.com");
    expect(formatAddress({ name: "Chamados Pitzi", email: "chamados@pitzi.com.br" })).toBe('"Chamados Pitzi" <chamados@pitzi.com.br>');
    const encoded = formatAddress({ name: "João", email: "j@x.com" });
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?= <j@x\.com>$/);
  });
});

describe("buildMimeMessage", () => {
  const raw = buildMimeMessage({
    from: { name: "Chamados Pitzi", email: "chamados@pitzi.com.br" },
    to: { email: "maria@pitzi.com.br" },
    replyTo: { email: "suporte@pitzi.com.br" },
    subject: "[CHA-0001] Impressora sem conexão",
    html: "<p>Olá, <strong>Maria</strong></p>",
    text: "Olá, Maria",
    messageId: "<chamado-1@pitzi.com.br>",
    threadRootId: ticketThreadRootId("t1", "pitzi.com.br"),
    date: new Date("2026-09-30T12:00:00Z"),
  }, "BOUNDARY");

  it("tem os cabeçalhos da thread e de mensagem automática", () => {
    const head = raw.split("\r\n\r\n")[0];
    expect(head).toContain("From: \"Chamados Pitzi\" <chamados@pitzi.com.br>");
    expect(head).toContain("To: maria@pitzi.com.br");
    expect(head).toContain("Reply-To: suporte@pitzi.com.br");
    expect(head).toContain("Message-ID: <chamado-1@pitzi.com.br>");
    expect(head).toContain("In-Reply-To: <ticket-t1@pitzi.com.br>");
    expect(head).toContain("References: <ticket-t1@pitzi.com.br>");
    expect(head).toContain("Auto-Submitted: auto-generated");
    expect(head).toContain('Content-Type: multipart/alternative; boundary="BOUNDARY"');
    expect(head).toContain("Date: Wed, 30 Sep 2026 12:00:00 +0000");
  });

  it("partes texto e HTML em UTF-8/base64, com linhas de até 76 caracteres", () => {
    const parts = raw.split("--BOUNDARY").slice(1, 3);
    const bodies = parts.map((p) => p.split("\r\n\r\n")[1].replace(/\r\n/g, ""));
    expect(decodeB64(bodies[0])).toBe("Olá, Maria");
    expect(decodeB64(bodies[1])).toBe("<p>Olá, <strong>Maria</strong></p>");
    for (const line of raw.split("\r\n")) expect(line.length).toBeLessThanOrEqual(998);
    expect(raw.trimEnd().endsWith("--BOUNDARY--")).toBe(true);
  });

  it("sem thread não inclui In-Reply-To", () => {
    const solo = buildMimeMessage({
      from: { email: "a@b.com" }, to: { email: "c@d.com" }, subject: "x", html: "x", text: "x", messageId: "<m@b.com>",
    });
    expect(solo).not.toContain("In-Reply-To");
  });
});

describe("base64UrlUtf8", () => {
  it("sem +, / nem padding", () => {
    const value = base64UrlUtf8("ção?>>>~~~ ção");
    expect(value).not.toMatch(/[+/=]/);
    const std = value.replace(/-/g, "+").replace(/_/g, "/");
    expect(decodeB64(std + "=".repeat((4 - (std.length % 4)) % 4))).toBe("ção?>>>~~~ ção");
  });
});
