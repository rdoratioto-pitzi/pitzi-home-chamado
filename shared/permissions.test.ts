import { describe, it, expect } from "vitest";
import { MODULE_PERMISSION_KEYS, canManageTicketFields, completeModulePermissions, hasModulePermission, parseModulePermissions } from "./permissions";

describe("canManageTicketFields", () => {
  it("só administradores; permissões avulsas antigas não valem", () => {
    expect(canManageTicketFields({ isAdmin: true })).toBe(true);
    expect(canManageTicketFields({ isAdmin: false, modulePermissions: '{"campos_chamado":true}' })).toBe(false);
    expect(canManageTicketFields({ isAdmin: false, modulePermissions: '{"configuracoes":true}' })).toBe(false);
    expect(canManageTicketFields(null)).toBe(false);
  });
});

describe("parseModulePermissions", () => {
  it("returns {} for null, undefined, non-string, non-object", () => {
    expect(parseModulePermissions(null)).toEqual({});
    expect(parseModulePermissions(undefined)).toEqual({});
    expect(parseModulePermissions(42)).toEqual({});
  });

  it("returns {} for malformed JSON string", () => {
    expect(parseModulePermissions("{not-json")).toEqual({});
  });

  it("parses a valid JSON string of permissions", () => {
    expect(parseModulePermissions('{"okrs":true,"metas":false}')).toEqual({
      okrs: true,
      metas: false,
    });
  });

  it("returns object passthrough when already parsed", () => {
    expect(parseModulePermissions({ okrs: true })).toEqual({ okrs: true });
  });
});

describe("hasModulePermission", () => {
  it("returns false when user is null/undefined", () => {
    expect(hasModulePermission(null, "okrs")).toBe(false);
    expect(hasModulePermission(undefined, "okrs")).toBe(false);
  });

  it("returns true for admin regardless of modulePermissions", () => {
    expect(hasModulePermission({ isAdmin: true, modulePermissions: null }, "okrs")).toBe(true);
    expect(
      hasModulePermission({ isAdmin: true, modulePermissions: '{"okrs":false}' }, "okrs"),
    ).toBe(true);
  });

  it("returns true when okrs flag is explicitly true", () => {
    expect(
      hasModulePermission({ isAdmin: false, modulePermissions: '{"okrs":true}' }, "okrs"),
    ).toBe(true);
  });

  it("returns false when okrs flag is missing or false", () => {
    expect(
      hasModulePermission({ isAdmin: false, modulePermissions: '{"okrs":false}' }, "okrs"),
    ).toBe(false);
    expect(
      hasModulePermission({ isAdmin: false, modulePermissions: "{}" }, "okrs"),
    ).toBe(false);
    expect(
      hasModulePermission({ isAdmin: false, modulePermissions: null }, "okrs"),
    ).toBe(false);
  });

  it("does not grant cross-module permission (metas !== okrs)", () => {
    const user = { isAdmin: false, modulePermissions: '{"metas":true}' };
    expect(hasModulePermission(user, "okrs")).toBe(false);
    expect(hasModulePermission(user, "metas")).toBe(true);
  });
});

describe("completeModulePermissions", () => {
  it("completa as chaves ausentes e mantém o que já estava gravado", () => {
    const full = JSON.parse(completeModulePermissions('{"chamados":true,"projetos":true}'));
    expect(Object.keys(full).sort()).toEqual([...MODULE_PERMISSION_KEYS].sort());
    expect(full.projetos).toBe(true);
    expect(full.configuracoes).toBe(false);
  });

  it("cadastro vazio ou inválido vira só chamados", () => {
    for (const raw of [null, "", "não é json"]) {
      const full = JSON.parse(completeModulePermissions(raw));
      expect(full.chamados).toBe(true);
      expect(Object.values(full).filter(Boolean)).toHaveLength(1);
    }
  });
});
