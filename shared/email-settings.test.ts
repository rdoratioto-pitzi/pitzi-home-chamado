import { describe, it, expect } from "vitest";
import {
  DEFAULT_EMAIL_SETTINGS,
  parseEmailSettings,
  renderSubject,
  renderTemplateHtml,
  renderTemplateText,
  validateEmailSettings,
} from "./email-settings";

describe("parseEmailSettings", () => {
  it("sem nada gravado (ou JSON inválido) usa os padrões", () => {
    expect(parseEmailSettings(null)).toEqual(DEFAULT_EMAIL_SETTINGS);
    expect(parseEmailSettings("{quebrado")).toEqual(DEFAULT_EMAIL_SETTINGS);
  });

  it("completa o que faltar e ignora evento inválido", () => {
    const parsed = parseEmailSettings(JSON.stringify({
      senderName: "Suporte",
      events: {
        agent_reply: { enabled: false },
        status_changed: { enabled: true, recipients: ["ninguem"], subject: "x", body: "y" },
      },
    }));
    expect(parsed.senderName).toBe("Suporte");
    expect(parsed.events.agent_reply.enabled).toBe(false);
    expect(parsed.events.agent_reply.body).toBe(DEFAULT_EMAIL_SETTINGS.events.agent_reply.body);
    expect(parsed.events.status_changed).toEqual(DEFAULT_EMAIL_SETTINGS.events.status_changed);
    expect(parsed.events.ticket_created).toEqual(DEFAULT_EMAIL_SETTINGS.events.ticket_created);
  });
});

describe("validateEmailSettings", () => {
  it("aceita os padrões e remove destinatários repetidos", () => {
    const input = structuredClone(DEFAULT_EMAIL_SETTINGS);
    input.events.ticket_created.recipients = ["solicitante", "solicitante", "responsavel"];
    const result = validateEmailSettings(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.settings.events.ticket_created.recipients).toEqual(["solicitante", "responsavel"]);
  });

  it("recusa assunto vazio, destinatário desconhecido e reply-to inválido", () => {
    const empty = structuredClone(DEFAULT_EMAIL_SETTINGS);
    empty.events.ticket_closed.subject = "  ";
    expect(validateEmailSettings(empty)).toMatchObject({ ok: false, error: "Assunto obrigatório" });

    const bad = structuredClone(DEFAULT_EMAIL_SETTINGS) as any;
    bad.events.agent_reply.recipients = ["gestor"];
    expect(validateEmailSettings(bad).ok).toBe(false);

    expect(validateEmailSettings({ ...DEFAULT_EMAIL_SETTINGS, replyTo: "nao-e-email" }).ok).toBe(false);
    expect(validateEmailSettings(null).ok).toBe(false);
  });
});

describe("modelos", () => {
  const vars = { codigo: "CHA-0007", titulo: "<script>x</script>", solicitante: "Ana & Cia", comentario: "linha 1\nlinha 2" };

  it("texto troca as variáveis; desconhecida vira vazio", () => {
    expect(renderTemplateText("{{solicitante}} / {{ codigo }} / {{inexistente}}", vars)).toBe("Ana & Cia / CHA-0007 / ");
  });

  it("HTML escapa o modelo e os valores e separa parágrafos", () => {
    const html = renderTemplateHtml("Oi <b>{{solicitante}}</b>\n\n{{titulo}}\n{{comentario}}", vars);
    expect(html).toContain("Oi &lt;b&gt;Ana &amp; Cia&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;<br>linha 1<br>linha 2");
    expect(html).not.toContain("<script>");
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("assunto sempre traz o código do chamado", () => {
    expect(renderSubject("[{{codigo}}] {{titulo}}", { codigo: "CHA-1", titulo: "Teste" })).toBe("[CHA-1] Teste");
    expect(renderSubject("Atualização: {{titulo}}", { codigo: "CHA-1", titulo: "Teste" })).toBe("[CHA-1] Atualização: Teste");
    expect(renderSubject("{{titulo}}\r\nBcc: x", { codigo: "CHA-1", titulo: "a" })).toBe("[CHA-1] a Bcc: x");
  });
});
