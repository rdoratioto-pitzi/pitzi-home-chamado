// Equipamentos (inventário do OCS): formato da sincronização e ligação máquina ↔ pessoa.
// Regra única para Worker, Express e telas.
import { z } from "zod";

export const ASSET_SOURCES = ["ocs"] as const;
export const MAX_ASSETS_PER_SYNC = 5000;

const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const assetDiskSchema = z.object({
  name: text(200),
  type: text(100),
  sizeMb: z.number().int().nonnegative().nullish().transform((v) => v ?? null),
});

export const assetMonitorSchema = z.object({
  manufacturer: text(200),
  model: text(200),
  serial: text(200),
});

export const assetDetailsSchema = z.object({
  disks: z.array(assetDiskSchema).max(50).default([]),
  monitors: z.array(assetMonitorSchema).max(20).default([]),
});

export type AssetDetails = z.infer<typeof assetDetailsSchema>;

export const syncedAssetSchema = z.object({
  externalId: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().min(1).max(100)),
  name: z.string().trim().min(1).max(200),
  serial: text(200),
  userLabel: text(200),
  osName: text(200),
  cpu: text(300),
  memoryMb: z.number().int().nonnegative().nullish().transform((v) => v ?? null),
  ipAddress: text(100),
  manufacturer: text(200),
  model: text(200),
  lastInventoryAt: z.string().datetime({ offset: true }).nullish().transform((v) => (v ? new Date(v) : null)),
  details: assetDetailsSchema.nullish().transform((v) => v ?? { disks: [], monitors: [] }),
});

export type SyncedAsset = z.infer<typeof syncedAssetSchema>;

export const assetSyncPayloadSchema = z.object({
  source: z.enum(ASSET_SOURCES).default("ocs"),
  assets: z.array(syncedAssetSchema).max(MAX_ASSETS_PER_SYNC),
});

/** Nome comparável: sem acento, minúsculo, sem domínio do Windows ("PITZI\\julia.granato") e sem pontuação. */
export function normalizePersonName(value: string | null | undefined): string {
  if (!value) return "";
  const withoutDomain = value.includes("\\") ? value.slice(value.lastIndexOf("\\") + 1) : value;
  return withoutDomain
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[._\-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PersonLike {
  name?: string | null;
  email?: string | null;
}

/**
 * O usuário da máquina no OCS é a pessoa? Aceita o nome completo, o login do e-mail
 * (julia.granato) ou primeiro + último nome ("Julia Granato" para "Julia Souza Granato").
 */
export function assetUserMatches(userLabel: string | null | undefined, person: PersonLike): boolean {
  const label = normalizePersonName(userLabel);
  if (!label) return false;
  const name = normalizePersonName(person.name);
  const login = normalizePersonName(person.email);
  if (label === name || label === login) return true;

  const labelTokens = label.split(" ");
  if (labelTokens.length < 2) return false;
  const first = labelTokens[0];
  const last = labelTokens[labelTokens.length - 1];
  return [name, login].some((candidate) => {
    const tokens = candidate.split(" ");
    return tokens.length >= 2 && tokens[0] === first && tokens.slice(1).includes(last);
  });
}

export interface AssetMatchCandidate {
  id: string;
  userLabel: string | null;
  active: boolean;
  lastInventoryAt: Date | string | null;
}

/** Máquina mais recente (ativa) do usuário, para sugerir na abertura do chamado. */
export function findAssetForPerson<T extends AssetMatchCandidate>(assets: T[], person: PersonLike): T | null {
  const time = (a: T) => (a.lastInventoryAt ? new Date(a.lastInventoryAt).getTime() : 0);
  const matches = assets.filter((a) => a.active && assetUserMatches(a.userLabel, person));
  matches.sort((a, b) => time(b) - time(a));
  return matches[0] ?? null;
}

/** Memória legível: 16384 → "16 GB". */
export function formatMemory(memoryMb: number | null | undefined): string {
  if (!memoryMb) return "—";
  if (memoryMb < 1024) return `${memoryMb} MB`;
  const gb = memoryMb / 1024;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
}
