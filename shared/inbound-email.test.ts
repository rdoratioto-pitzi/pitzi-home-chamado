import { describe, it, expect } from "vitest";
import {
  detectAutomatedMessage,
  extractTicketReference,
  htmlToText,
  normalizeHeaders,
  parseEmailAddress,
  stripQuotedReply,
  textToCommentHtml,
} from "./inbound-email";
import { describeTeamChanges } from "./ticket-changes";

describe("stripQuotedReply", () => {
  it("Gmail em português, com o 'escreveu:' quebrado na linha seguinte", () => {
    const raw = [
      "Pode fechar, já funcionou.",
      "",
      "Em seg., 5 de out. de 2026 às 10:02, Chamados Pitzi <chamados@pitzi.com.br>",
      "escreveu:",
      "> Olá, Vinicius.",
      "> O chamado CHA-0007 mudou para Aguardando solicitante.",
    ].join("\n");
    expect(stripQuotedReply(raw)).toBe("Pode fechar, já funcionou.");
  });

  it("Gmail em inglês", () => {
    const raw = "Thanks!\n\nOn Mon, Oct 5, 2026 at 10:02 AM Chamados Pitzi <chamados@pitzi.com.br> wrote:\n> old";
    expect(stripQuotedReply(raw)).toBe("Thanks!");
  });

  it("Outlook: bloco De/Enviado/Para e separador", () => {
    const pt = "Segue o print.\n\n________________________________\nDe: Chamados Pitzi <chamados@pitzi.com.br>\nEnviado: segunda-feira\nPara: Fulano";
    expect(stripQuotedReply(pt)).toBe("Segue o print.");
    const en = "Done.\r\n\r\nFrom: Chamados Pitzi <chamados@pitzi.com.br>\r\nSent: Monday\r\nTo: Someone\r\nSubject: [CHA-0001]";
    expect(stripQuotedReply(en)).toBe("Done.");
    expect(stripQuotedReply("Ok\n-----Original Message-----\ncorpo antigo")).toBe("Ok");
  });

  it("Apple Mail e assinatura de celular", () => {
    const raw = "Combinado.\n\nEnviado do meu iPhone\n\nEm 5 de out. de 2026, à(s) 10:02, Chamados Pitzi <chamados@pitzi.com.br> escreveu:\n\n> antigo";
    expect(stripQuotedReply(raw)).toBe("Combinado.");
  });

  it("corta a assinatura depois de '-- ' e mantém linhas normais que começam com 'Em'", () => {
    const raw = "Em anexo segue a nota.\nObrigado\n-- \nFulano\nPitzi";
    expect(stripQuotedReply(raw)).toBe("Em anexo segue a nota.\nObrigado");
  });

  it("só histórico vira texto vazio", () => {
    expect(stripQuotedReply("> tudo citado\n> nada novo")).toBe("");
  });
});

describe("htmlToText", () => {
  it("descarta o bloco gmail_quote e converte quebras", () => {
    const html = '<div dir="ltr">Linha 1<br>Linha 2</div><div class="gmail_quote"><div>Em seg... escreveu:</div><blockquote>antigo</blockquote></div>';
    expect(htmlToText(html)).toBe("Linha 1\nLinha 2");
  });

  it("decodifica entidades e remove scripts", () => {
    expect(htmlToText("<p>A &amp; B &lt;ok&gt;&nbsp;fim</p><script>alert(1)</script>")).toBe("A & B <ok> fim");
  });
});

describe("textToCommentHtml", () => {
  it("escapa HTML e vira parágrafos", () => {
    expect(textToCommentHtml("Oi <b>equipe</b>\nlinha 2\n\nnovo parágrafo"))
      .toBe("<p>Oi &lt;b&gt;equipe&lt;/b&gt;<br>linha 2</p><p>novo parágrafo</p>");
  });
});

describe("detectAutomatedMessage", () => {
  const own = "chamados@pitzi.com.br";
  it("ignora a própria caixa (evita loop)", () => {
    expect(detectAutomatedMessage({}, "chamados@pitzi.com.br", own).automated).toBe(true);
  });
  it("ignora respostas automáticas, devoluções e listas", () => {
    expect(detectAutomatedMessage({ "auto-submitted": "auto-replied" }, "a@pitzi.com.br", own).automated).toBe(true);
    expect(detectAutomatedMessage({ "x-autoreply": "yes" }, "a@pitzi.com.br", own).automated).toBe(true);
    expect(detectAutomatedMessage({ precedence: "bulk" }, "a@pitzi.com.br", own).automated).toBe(true);
    expect(detectAutomatedMessage({ "return-path": "<>" }, "a@pitzi.com.br", own).automated).toBe(true);
    expect(detectAutomatedMessage({}, "mailer-daemon@googlemail.com", own).automated).toBe(true);
    expect(detectAutomatedMessage({ "list-id": "<x.y>" }, "a@pitzi.com.br", own).automated).toBe(true);
  });
  it("aceita resposta de pessoa (Auto-Submitted: no)", () => {
    expect(detectAutomatedMessage({ "auto-submitted": "no" }, "vinicius@pitzi.com.br", own)).toEqual({ automated: false });
  });
});

describe("extractTicketReference", () => {
  const id = "0f8b6c1e-1234-4abc-9def-0123456789ab";
  it("lê Message-IDs, a raiz do chamado e o código do assunto", () => {
    const headers = normalizeHeaders([
      { name: "In-Reply-To", value: "<chamado-abc@pitzi.com.br>" },
      { name: "References", value: `<ticket-${id}@pitzi.com.br> <chamado-abc@pitzi.com.br>` },
      { name: "Subject", value: "Re: [CHA-0007] Impressora" },
    ]);
    const ref = extractTicketReference(headers);
    expect(ref.messageIds).toEqual(["<chamado-abc@pitzi.com.br>", `<ticket-${id}@pitzi.com.br>`]);
    expect(ref.ticketIds).toEqual([id]);
    expect(ref.code).toBe("CHA-0007");
  });
  it("sem cabeçalhos de conversa, só o assunto", () => {
    expect(extractTicketReference({ subject: "RES: RES: [cha-0012] Acesso" })).toEqual({ messageIds: [], ticketIds: [], code: "CHA-0012" });
  });
});

describe("parseEmailAddress", () => {
  it("extrai e normaliza", () => {
    expect(parseEmailAddress('"Vinicius Reato" <Vinicius@Pitzi.com.br>')).toBe("vinicius@pitzi.com.br");
    expect(parseEmailAddress("fulano@pitzi.com.br")).toBe("fulano@pitzi.com.br");
    expect(parseEmailAddress("")).toBe("");
  });
});

describe("describeTeamChanges (e-mail ticket_updated)", () => {
  const before = { title: "Impressora", category: "helpdesk", requesterId: "solic" };
  it("grupo e título mudados pela equipe", () => {
    const names = (k: string) => ({ helpdesk: "Helpdesk", financeiro: "Financeiro" } as Record<string, string>)[k] ?? k;
    expect(describeTeamChanges(before, { ...before, category: "financeiro", title: "Impressora 2º andar" }, "tec", names))
      .toBe('grupo de Helpdesk para Financeiro; título para "Impressora 2º andar"');
  });
  it("alteração do próprio solicitante não gera e-mail", () => {
    expect(describeTeamChanges(before, { ...before, title: "Outro" }, "solic")).toBe("");
  });
  it("sem mudança de grupo ou título não gera e-mail", () => {
    expect(describeTeamChanges(before, { ...before }, "tec")).toBe("");
  });
});
