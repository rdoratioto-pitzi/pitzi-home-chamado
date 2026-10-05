import { describe, it, expect } from "vitest";
import { mentionRecipients, mentionsToStore, parseMentionSpans, resolveMentions } from "./mentions.service";

const user = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, email: `${id}@pitzi.com.br`, status: "active", tenantId: null, isAdmin: false, isTechnician: true, ...extra }) as any;

const USERS = [
  user("rodrigo", "Rodrigo Doratioto"),
  user("ana1", "Ana Souza"),
  user("ana2", "Ana Souza"),
  user("bruno", "Bruno Neves", { isTechnician: false }),
  user("velho", "Fulano Antigo", { status: "inactive" }),
  user("outro", "Rodrigo Doratioto Outro Tenant", { tenantId: "t2" }),
];
const storage = {
  getUsers: async () => USERS,
  getUser: async (id: string) => USERS.find((u) => u.id === id),
} as any;

// HTML que o editor grava depois da correção (com data-user-id)
const COM_ID =
  '<p><span class="mention" data-index="0" data-denotation-char="@" data-id="rodrigo" data-value="Rodrigo Doratioto" ' +
  'data-user-id="rodrigo" data-display-name="Rodrigo Doratioto">﻿<span contenteditable="false">' +
  '<span class="ql-mention-denotation-char">@</span><span class="ql-mention-value">Rodrigo Doratioto</span></span>﻿</span> o que acha?</p>';
// HTML gravado em produção antes da correção (CHA-0008): sem data-user-id
const SEM_ID = '<p><span class="mention">﻿<span>Rodrigo Doratioto</span>﻿</span> o que você acha?</p>';

describe("parseMentionSpans", () => {
  it("lê id e nome do span.mention, ignorando os spans internos", () => {
    expect(parseMentionSpans(COM_ID)).toEqual([{ userId: "rodrigo", displayName: "Rodrigo Doratioto" }]);
  });

  it("sem data-user-id usa o nome visível, sem @ e sem os caracteres de guarda", () => {
    expect(parseMentionSpans(SEM_ID)).toEqual([{ userId: null, displayName: "Rodrigo Doratioto" }]);
  });

  it("texto sem menção não devolve nada", () => {
    expect(parseMentionSpans("<p>@Rodrigo sem span</p>")).toEqual([]);
  });
});

describe("resolveMentions", () => {
  it("pelo data-user-id", async () => {
    expect(await resolveMentions(storage, COM_ID, null)).toEqual([{ userId: "rodrigo", displayName: "Rodrigo Doratioto" }]);
  });

  it("sem id: acha pelo nome quando é único no tenant", async () => {
    expect(await resolveMentions(storage, SEM_ID, null)).toEqual([{ userId: "rodrigo", displayName: "Rodrigo Doratioto" }]);
  });

  it("nome ambíguo ou de usuário inativo não resolve", async () => {
    const ambiguo = '<p><span class="mention"><span>Ana Souza</span></span></p>';
    const inativo = '<p><span class="mention"><span>Fulano Antigo</span></span></p>';
    expect(await resolveMentions(storage, ambiguo, null)).toEqual([]);
    expect(await resolveMentions(storage, inativo, null)).toEqual([]);
  });

  it("não repete a mesma pessoa mencionada duas vezes", async () => {
    expect(await resolveMentions(storage, COM_ID + SEM_ID, null)).toHaveLength(1);
  });
});

describe("quem recebe e o que fica gravado", () => {
  const refs = [
    { userId: "rodrigo", displayName: "Rodrigo Doratioto" },
    { userId: "bruno", displayName: "Bruno Neves" },
  ];

  it("comentário público avisa todos menos o autor", async () => {
    const out = await mentionRecipients(storage, refs, "rodrigo", false);
    expect(out.map((u) => u.id)).toEqual(["bruno"]);
  });

  it("nota interna: só técnicos são avisados e gravados", async () => {
    expect((await mentionRecipients(storage, refs, "x", true)).map((u) => u.id)).toEqual(["rodrigo"]);
    expect((await mentionsToStore(storage, refs, true)).map((r) => r.userId)).toEqual(["rodrigo"]);
    expect(await mentionsToStore(storage, refs, false)).toHaveLength(2);
  });
});
