import { describe, it, expect } from "vitest";
import { canSeeInternalComments, filterVisibleComments, resolveIsInternal } from "./ticket-comments";

const ticket = { assigneeId: "tech-1" };
const comments = [
  { id: "c1", isInternal: false },
  { id: "c2", isInternal: true },
  { id: "c3", isInternal: null },
];

describe("ticket-comments", () => {
  it("admin e responsável veem notas internas", () => {
    expect(canSeeInternalComments({ userId: "admin-1", isAdmin: true }, ticket)).toBe(true);
    expect(canSeeInternalComments({ userId: "tech-1", isAdmin: false }, ticket)).toBe(true);
  });

  it("solicitante não vê notas internas", () => {
    expect(canSeeInternalComments({ userId: "req-1", isAdmin: false }, ticket)).toBe(false);
    const visible = filterVisibleComments(comments, { userId: "req-1", isAdmin: false }, ticket);
    expect(visible.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("chamado sem responsável não libera notas internas para não-admin", () => {
    expect(canSeeInternalComments({ userId: "req-1", isAdmin: false }, { assigneeId: null })).toBe(false);
  });

  it("solicitante não consegue criar nota interna", () => {
    expect(resolveIsInternal(true, { userId: "req-1", isAdmin: false }, ticket)).toBe(false);
    expect(resolveIsInternal(true, { userId: "tech-1", isAdmin: false }, ticket)).toBe(true);
    expect(resolveIsInternal("true", { userId: "tech-1", isAdmin: false }, ticket)).toBe(false);
    expect(resolveIsInternal(undefined, { userId: "admin-1", isAdmin: true }, ticket)).toBe(false);
  });
});
