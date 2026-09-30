import { describe, it, expect } from "vitest";
import {
  articleUpdateSchema,
  buildArticleDraftFromTicket,
  canCreateArticle,
  canCreateFromTicket,
  canEditArticle,
  canViewArticle,
} from "./knowledge";

const admin = { userId: "adm", isAdmin: true, groupKeys: [] };
const staff = { userId: "tec", isAdmin: false, groupKeys: ["sap"] };
const plain = { userId: "sol", isAdmin: false, groupKeys: [] };

describe("permissões da Base de Conhecimento", () => {
  it("publicado é visível para todos; rascunho só para o autor e admin", () => {
    expect(canViewArticle(plain, { authorId: "x", status: "publicado" })).toBe(true);
    expect(canViewArticle(plain, { authorId: "x", status: "rascunho" })).toBe(false);
    expect(canViewArticle(staff, { authorId: "tec", status: "rascunho" })).toBe(true);
    expect(canViewArticle(admin, { authorId: "x", status: "rascunho" })).toBe(true);
  });

  it("editar: autor ou admin", () => {
    expect(canEditArticle(staff, { authorId: "tec", status: "publicado" })).toBe(true);
    expect(canEditArticle(staff, { authorId: "outro", status: "publicado" })).toBe(false);
    expect(canEditArticle(admin, { authorId: "outro", status: "publicado" })).toBe(true);
  });

  it("criar: admin ou membro de algum grupo", () => {
    expect(canCreateArticle(admin)).toBe(true);
    expect(canCreateArticle(staff)).toBe(true);
    expect(canCreateArticle(plain)).toBe(false);
  });

  it("a partir do chamado: o solicitante não cria, mesmo sendo da equipe", () => {
    expect(canCreateFromTicket(staff, { requesterId: "tec" })).toBe(false);
    expect(canCreateFromTicket(staff, { requesterId: "sol" })).toBe(true);
    expect(canCreateFromTicket(plain, { requesterId: "outro" })).toBe(false);
    expect(canCreateFromTicket(admin, { requesterId: "adm" })).toBe(true);
  });

  it("editar sem status não republica o rascunho", () => {
    expect(articleUpdateSchema.parse({ title: "Novo" })).toEqual({ title: "Novo" });
  });
});

describe("rascunho a partir do chamado", () => {
  const ticket = { title: "VPN não conecta", description: "Erro 809\n\nDesde ontem", category: "sap", requesterId: "sol" };

  it("usa a descrição como problema e só comentários públicos da equipe como solução", () => {
    const draft = buildArticleDraftFromTicket(ticket, [
      { userId: "tec", isInternal: true, content: "<p>senha do firewall: segredo</p>" },
      { userId: "sol", isInternal: false, content: "<p>ainda não funciona</p>" },
      { userId: "tec", isInternal: false, content: "<p>Reinstalar o cliente VPN</p>" },
    ]);
    expect(draft.title).toBe("VPN não conecta");
    expect(draft.groupKey).toBe("sap");
    expect(draft.content).toContain("<h2>Problema</h2><p>Erro 809</p><p>Desde ontem</p>");
    expect(draft.content).toContain("<h2>Solução</h2><p>Reinstalar o cliente VPN</p>");
    expect(draft.content).not.toContain("segredo");
    expect(draft.content).not.toContain("ainda não funciona");
  });

  it("sem comentários da equipe deixa um lembrete para escrever a solução; texto puro é escapado", () => {
    const draft = buildArticleDraftFromTicket({ ...ticket, description: "x < 3 & y > 1" }, []);
    expect(draft.content).toContain("<p>x &lt; 3 &amp; y &gt; 1</p>");
    expect(draft.content).toContain("Descreva a solução aplicada.");
  });
});
