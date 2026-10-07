import { describe, expect, it } from "vitest";
import {
  assetSyncPayloadSchema,
  assetUserMatches,
  findAssetForPerson,
  formatMemory,
  normalizePersonName,
} from "./assets";

describe("normalizePersonName", () => {
  it("tira acento, domínio do Windows, e-mail e pontuação", () => {
    expect(normalizePersonName("Débora Araújo")).toBe("debora araujo");
    expect(normalizePersonName("PITZI\\julia.granato")).toBe("julia granato");
    expect(normalizePersonName("kaick.oliveira@pitzi.com.br")).toBe("kaick oliveira");
    expect(normalizePersonName(null)).toBe("");
  });
});

describe("assetUserMatches", () => {
  const julia = { name: "Julia Souza Granato", email: "julia.granato@pitzi.com.br" };

  it("aceita nome completo, login do e-mail e primeiro + último nome", () => {
    expect(assetUserMatches("Julia Souza Granato", julia)).toBe(true);
    expect(assetUserMatches("julia.granato", julia)).toBe(true);
    expect(assetUserMatches("Julia Granato", julia)).toBe(true);
  });

  it("não liga nomes diferentes nem só o primeiro nome", () => {
    expect(assetUserMatches("Julia", julia)).toBe(false);
    expect(assetUserMatches("Julia Ferreira", julia)).toBe(false);
    expect(assetUserMatches("Pitzi Admin", julia)).toBe(false);
    expect(assetUserMatches(null, julia)).toBe(false);
  });
});

describe("findAssetForPerson", () => {
  const person = { name: "Brenda Araujo", email: "brenda.araujo@pitzi.com.br" };

  it("escolhe a máquina ativa mais recente da pessoa", () => {
    const assets = [
      { id: "old", userLabel: "Brenda Araujo", active: true, lastInventoryAt: "2026-01-01T00:00:00Z" },
      { id: "new", userLabel: "brenda.araujo", active: true, lastInventoryAt: "2026-06-01T00:00:00Z" },
      { id: "off", userLabel: "Brenda Araujo", active: false, lastInventoryAt: "2026-09-01T00:00:00Z" },
      { id: "other", userLabel: "Kaick Oliveira", active: true, lastInventoryAt: "2026-09-01T00:00:00Z" },
    ];
    expect(findAssetForPerson(assets, person)?.id).toBe("new");
  });

  it("devolve null sem máquina da pessoa", () => {
    expect(findAssetForPerson([], person)).toBeNull();
  });
});

describe("assetSyncPayloadSchema", () => {
  it("aceita o formato do script do OCS e normaliza vazios", () => {
    const parsed = assetSyncPayloadSchema.parse({
      assets: [{
        externalId: 12,
        name: "Pitzi-Leap1010",
        serial: "ABC123",
        userLabel: "",
        memoryMb: 16384,
        lastInventoryAt: "2026-06-09T14:48:55-03:00",
        details: { disks: [{ name: "C:", type: "NTFS", sizeMb: 476000 }] },
      }],
    });
    const asset = parsed.assets[0];
    expect(parsed.source).toBe("ocs");
    expect(asset.externalId).toBe("12");
    expect(asset.userLabel).toBeNull();
    expect(asset.lastInventoryAt).toBeInstanceOf(Date);
    expect(asset.details.monitors).toEqual([]);
  });

  it("recusa máquina sem nome", () => {
    expect(assetSyncPayloadSchema.safeParse({ assets: [{ externalId: "1", name: "" }] }).success).toBe(false);
  });
});

describe("formatMemory", () => {
  it("mostra em GB", () => {
    expect(formatMemory(16384)).toBe("16 GB");
    expect(formatMemory(40960)).toBe("40 GB");
    expect(formatMemory(null)).toBe("—");
  });
});
