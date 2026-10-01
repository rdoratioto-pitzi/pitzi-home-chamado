import { describe, it, expect } from "vitest";
import { canBeAssignee, isTechnician, userTypeLabel } from "./user-type";

describe("tipo de usuário", () => {
  it("admin conta sempre como técnico", () => {
    expect(isTechnician({ isAdmin: true, isTechnician: false })).toBe(true);
    expect(isTechnician({ isAdmin: false, isTechnician: true })).toBe(true);
    expect(isTechnician({ isAdmin: false, isTechnician: false })).toBe(false);
    expect(isTechnician(null)).toBe(false);
  });

  it("só técnico ativo pode ser responsável", () => {
    expect(canBeAssignee({ isTechnician: true, status: "active" })).toBe(true);
    expect(canBeAssignee({ isTechnician: true, status: "inactive" })).toBe(false);
    expect(canBeAssignee({ isTechnician: false, status: "active" })).toBe(false);
    expect(canBeAssignee(undefined)).toBe(false);
  });

  it("rótulo", () => {
    expect(userTypeLabel({ isTechnician: true })).toBe("Técnico");
    expect(userTypeLabel({ isTechnician: false })).toBe("Usuário");
  });
});
