// E-mails de chamado: quem recebe, eventos desativados, notas internas e destinatários inativos.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_EMAIL_SETTINGS, type EmailSettings } from "../../../shared/email-settings";

let settings: EmailSettings = structuredClone(DEFAULT_EMAIL_SETTINGS);
const queued: any[] = [];

vi.mock("./mailer", () => ({
  loadEmailSettings: vi.fn(async () => settings),
  queueEmails: vi.fn(async (_ctx: unknown, rows: any[]) => { queued.push(...rows); return rows; }),
  sendDirect: vi.fn(),
  keepAlive: (ctx: any, p: Promise<unknown>) => { ctx.waitUntil?.(p.catch(() => undefined)); return p; },
}));

const email = await import("./email");

const user = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `Nome ${id}`, email: `${id}@pitzi.com.br`, status: "active", tenantId: null, ...extra }) as any;
const requester = user("solic");
const assignee = user("tec");
const ticket = {
  id: "t-1", code: "CHA-0009", title: "Impressora", category: "suporte-ti", type: "bug", status: "open",
  requesterId: "solic", assigneeId: "tec", tenantId: null,
} as any;
const ctx = { env: { APP_URL: "https://app.test", GMAIL_SENDER: "chamados@pitzi.com.br" }, db: {} } as any;
const storage = {
  shouldSendEmail: vi.fn(async () => true),
  getUser: vi.fn(async (id: string) => (id === "solic" ? requester : assignee)),
} as any;

beforeEach(() => {
  settings = structuredClone(DEFAULT_EMAIL_SETTINGS);
  queued.length = 0;
  storage.shouldSendEmail.mockClear();
});

describe("e-mails de chamado", () => {
  it("registra waitUntil na hora da chamada, para a fila não se perder quando a resposta sai", async () => {
    const waitUntil = vi.fn();
    // Sem await, como as rotas fazem: o waitUntil tem de ser registrado de imediato.
    const pending = email.sendTicketCreatedEmail({ ...ctx, waitUntil }, storage, ticket, requester, assignee);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await pending;
    expect(queued).toHaveLength(1);
  });

  it("abertura vai para o solicitante, com assunto [código] e thread do chamado", async () => {
    await email.sendTicketCreatedEmail(ctx, storage, ticket, requester, assignee);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      event: "ticket_created",
      toEmail: "solic@pitzi.com.br",
      subject: "[CHA-0009] Impressora",
      status: "pending",
      ticketId: "t-1",
      threadRootId: "<ticket-t-1@pitzi.com.br>",
    });
    expect(queued[0].messageIdHeader).toMatch(/^<chamado-.+@pitzi\.com\.br>$/);
    expect(queued[0].html).toContain("https://app.test/chamados/t-1");
    expect(queued[0].text).toContain("Recebemos o seu chamado CHA-0009");
  });

  it("nota interna nunca gera e-mail", async () => {
    await email.sendTicketCommentEmail(ctx, storage, ticket, { content: "segredo", isInternal: true } as any, assignee, requester, assignee);
    expect(queued).toHaveLength(0);
  });

  it("resposta da equipe vai para o solicitante; resposta do solicitante vai para o responsável", async () => {
    await email.sendTicketCommentEmail(ctx, storage, ticket, { content: "Pode reiniciar?", isInternal: false } as any, assignee, requester, assignee);
    expect(queued.map((r) => [r.event, r.toEmail])).toEqual([["agent_reply", "solic@pitzi.com.br"]]);
    expect(queued[0].text).toContain("Pode reiniciar?");

    queued.length = 0;
    await email.sendTicketCommentEmail(ctx, storage, ticket, { content: "Reiniciei", isInternal: false } as any, requester, requester, assignee);
    expect(queued.map((r) => [r.event, r.toEmail])).toEqual([["requester_reply", "tec@pitzi.com.br"]]);
  });

  it("quem fez a ação não recebe o próprio e-mail, mesmo marcado como destinatário", async () => {
    settings.events.agent_reply.recipients = ["solicitante", "responsavel"];
    await email.sendTicketCommentEmail(ctx, storage, ticket, { content: "ok", isInternal: false } as any, assignee, requester, assignee);
    expect(queued.map((r) => r.toEmail)).toEqual(["solic@pitzi.com.br"]);
  });

  it("evento desativado não grava nada", async () => {
    settings.events.status_changed.enabled = false;
    await email.sendTicketStatusChangedEmail(ctx, storage, ticket, "open", "in_progress", requester, assignee);
    expect(queued).toHaveLength(0);
  });

  it("resolvido/fechado usa o evento de encerramento", async () => {
    await email.sendTicketStatusChangedEmail(ctx, storage, ticket, "in_progress", "resolved", requester, assignee);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ event: "ticket_closed", toEmail: "solic@pitzi.com.br" });
    expect(queued[0].text).toContain("Resolvido");
  });

  it("destinatário inativo ou sem e-mail fica registrado como skipped; preferência pessoal desligada não grava", async () => {
    await email.sendTicketCreatedEmail(ctx, storage, ticket, user("solic", { status: "inactive" }), assignee);
    expect(queued[0]).toMatchObject({ status: "skipped", lastError: "Usuário inativo" });

    queued.length = 0;
    await email.sendTicketCreatedEmail(ctx, storage, ticket, user("solic", { email: "" }), assignee);
    expect(queued[0]).toMatchObject({ status: "skipped", lastError: "Destinatário sem e-mail" });

    queued.length = 0;
    storage.shouldSendEmail.mockResolvedValueOnce(false);
    await email.sendTicketCreatedEmail(ctx, storage, ticket, requester, assignee);
    expect(queued).toHaveLength(0);
  });

  it("texto editado é escapado no HTML", async () => {
    settings.events.ticket_created.body = "Oi {{solicitante}} <img src=x onerror=alert(1)>";
    await email.sendTicketCreatedEmail(ctx, storage, { ...ticket, title: "<b>x</b>" }, requester, assignee);
    expect(queued[0].html).not.toContain("<img src=x");
    expect(queued[0].html).toContain("&lt;img src=x");
    expect(queued[0].html).not.toContain("<b>x</b>");
  });

  it("link de redefinição de senha é sempre gravado (não depende da configuração)", async () => {
    for (const e of Object.values(settings.events)) e.enabled = false;
    await email.sendPasswordResetLinkEmail(ctx, requester, "https://app.test/redefinir-senha?token=abc");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ event: "password_reset_link", status: "pending", toEmail: "solic@pitzi.com.br" });
  });
});


describe("resposta do solicitante: quem recebe", () => {
  const comment = (userId: string) => ({ id: "c", content: "Ainda não funciona", isInternal: false, userId }) as any;
  const tecA = user("tecA", { isTechnician: true });
  const tecB = user("tecB", { isTechnician: true });
  const naoTecnico = user("usuarioDoGrupo", { isTechnician: false });
  const admin = user("admin", { isAdmin: true });
  const inativo = user("tecInativo", { isTechnician: true, status: "inactive" });
  const semResponsavel = { ...ticket, assigneeId: null, category: "helpdesk" };
  const teamStorage = (members: string[]) => ({
    ...storage,
    getSupportGroups: vi.fn(async () => [{ key: "helpdesk", name: "Helpdesk", memberIds: members }]),
    getUsers: vi.fn(async () => [requester, assignee, tecA, tecB, naoTecnico, admin, inativo]),
  }) as any;

  it("com responsável: só o responsável", async () => {
    await email.sendTicketCommentEmail(ctx, teamStorage(["tecA"]), ticket, comment("solic"), requester, requester, assignee);
    expect(queued.map((r) => r.toUserId)).toEqual(["tec"]);
  });

  it("sem responsável: ninguém recebe (só solicitante e responsável recebem resposta)", async () => {
    await email.sendTicketCommentEmail(
      ctx, teamStorage(["tecA", "tecB"]), semResponsavel, comment("solic"), requester, requester, null,
    );
    expect(queued).toHaveLength(0);
  });

  it("nunca manda para o autor do comentário", async () => {
    const autorAdmin = { ...requester, id: "admin", isAdmin: true };
    const t = { ...semResponsavel, requesterId: "admin" };
    await email.sendTicketCommentEmail(ctx, teamStorage([]), t, comment("admin"), autorAdmin, autorAdmin, null);
    expect(queued.map((r) => r.toUserId)).not.toContain("admin");
  });
});

describe("alteração pela equipe (ticket_updated)", () => {
  it("avisa o solicitante com o resumo das alterações", async () => {
    await email.sendTicketUpdatedEmail(ctx, storage, ticket, "grupo de Helpdesk para Financeiro", requester, assignee);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ event: "ticket_updated", toUserId: "solic", subject: "[CHA-0009] Impressora" });
    expect(queued[0].text).toContain("grupo de Helpdesk para Financeiro");
  });

  it("desligado em Configurações → E-mail não envia", async () => {
    settings.events.ticket_updated.enabled = false;
    await email.sendTicketUpdatedEmail(ctx, storage, ticket, "título para \"X\"", requester, assignee);
    expect(queued).toHaveLength(0);
  });

  it("quem alterou não recebe (solicitante que é o próprio autor)", async () => {
    await email.sendTicketUpdatedEmail(ctx, storage, ticket, "título para \"X\"", requester, requester);
    expect(queued).toHaveLength(0);
  });
});
