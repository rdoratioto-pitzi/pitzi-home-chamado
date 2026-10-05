// Menções (@) em comentários de chamado. Usado pelo Worker e pelo Express.
//
// O editor grava <span class="mention" data-user-id="…" data-display-name="…">. Comentários
// antigos (antes da correção do editor) ficaram só com o nome visível; nesse caso a pessoa é
// achada pelo nome, desde que exista exatamente um usuário ativo do tenant com esse nome.
import type { Ticket, User } from "../../shared/schema";
import { sameTenant } from "../../shared/tenant";
import { isTechnician } from "../../shared/user-type";
import type { IStorage } from "../storage";

export interface MentionRef {
  userId: string;
  displayName: string;
}

interface MentionSpan {
  userId: string | null;
  displayName: string;
}

const GUARD = /﻿/g;

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Lê os <span class="mention"> do HTML: id (se houver) e o nome visível. */
export function parseMentionSpans(html: string | null | undefined): MentionSpan[] {
  if (!html || !html.includes("mention")) return [];
  const spans: MentionSpan[] = [];
  const tagRe = /<\/?span\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    if (tag.startsWith("</")) continue;
    const classes = (attr(tag, "class") ?? "").split(/\s+/);
    if (!classes.includes("mention")) continue;
    // Conteúdo até o </span> que fecha esta menção (há spans aninhados dentro dela).
    const start = tagRe.lastIndex;
    let depth = 1;
    let end = html.length;
    const inner = /<\/?span\b[^>]*>/gi;
    inner.lastIndex = start;
    let t: RegExpExecArray | null;
    while ((t = inner.exec(html)) !== null) {
      depth += t[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = t.index;
        break;
      }
    }
    tagRe.lastIndex = Math.max(tagRe.lastIndex, end);
    const visible = decodeEntities(html.slice(start, end).replace(/<[^>]*>/g, ""))
      .replace(GUARD, "")
      .trim()
      .replace(/^@\s*/, "");
    const displayName = decodeEntities(attr(tag, "data-display-name") ?? visible).trim();
    spans.push({ userId: attr(tag, "data-user-id"), displayName });
  }
  return spans;
}

/** Quem foi mencionado: pelo data-user-id ou, sem ele, pelo nome (só se o nome for único). */
export async function resolveMentions(
  storage: IStorage,
  html: string | null | undefined,
  tenantId: string | null | undefined,
): Promise<MentionRef[]> {
  const spans = parseMentionSpans(html);
  if (spans.length === 0) return [];
  const users = (await storage.getUsers()).filter(
    (u) => u.status === "active" && sameTenant(u.tenantId, tenantId ?? null),
  );
  const byId = new Map(users.map((u) => [u.id, u]));
  const refs = new Map<string, MentionRef>();
  for (const span of spans) {
    let user: User | undefined = span.userId ? byId.get(span.userId) : undefined;
    if (!user && span.displayName) {
      const name = span.displayName.toLowerCase();
      const matches = users.filter((u) => u.name.trim().toLowerCase() === name);
      if (matches.length === 1) user = matches[0];
    }
    if (user && !refs.has(user.id)) refs.set(user.id, { userId: user.id, displayName: user.name });
  }
  return Array.from(refs.values());
}

/**
 * Menções que ficam gravadas no comentário (e dão acesso ao chamado). Em nota interna só
 * técnicos: um Usuário mencionado numa nota não ganha acesso nem aviso.
 */
export async function mentionsToStore(
  storage: IStorage,
  mentions: readonly MentionRef[],
  isInternal: boolean,
): Promise<MentionRef[]> {
  if (!isInternal) return [...mentions];
  const out: MentionRef[] = [];
  for (const ref of mentions) {
    if (isTechnician(await storage.getUser(ref.userId))) out.push(ref);
  }
  return out;
}

/**
 * Quem deve ser avisado de uma menção: nunca o autor; em nota interna, só técnicos
 * (o conteúdo interno não pode chegar a quem não é da equipe).
 */
export async function mentionRecipients(
  storage: IStorage,
  mentions: readonly MentionRef[],
  authorId: string,
  isInternal: boolean,
): Promise<User[]> {
  const out: User[] = [];
  for (const ref of mentions) {
    if (ref.userId === authorId) continue;
    const user = await storage.getUser(ref.userId);
    if (!user || user.status !== "active") continue;
    if (isInternal && !isTechnician(user)) continue;
    out.push(user);
  }
  return out;
}

/** Foi mencionado em algum comentário do chamado. */
export async function isMentionedInTicket(
  storage: IStorage,
  ticket: Pick<Ticket, "id">,
  userId: string,
): Promise<boolean> {
  return storage.isUserMentionedInTicket(ticket.id, userId);
}
