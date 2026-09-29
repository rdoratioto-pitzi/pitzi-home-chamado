import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { resolverDentroDoRepo } from "../utils/safe-path";

// Repositório git descartável com um remoto local: nada toca o repositório real.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "giter-"));
const repo = path.join(tmp, "repo");
const remote = path.join(tmp, "remote.git");
const sh = (args: string[], cwd = repo) => execFileSync("git", args, { cwd, encoding: "utf-8" });

vi.mock("../config", () => ({ config: { paths: { renovHome: repo } } }));
const { giter } = await import("./giter");

beforeEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(repo, { recursive: true });
  execFileSync("git", ["init", "--bare", "-q", remote]);
  sh(["init", "-q", "-b", "feature"]);
  sh(["config", "user.email", "t@t"]);
  sh(["config", "user.name", "t"]);
  sh(["remote", "add", "origin", remote]);
  fs.writeFileSync(path.join(repo, "base.txt"), "x");
  sh(["add", "base.txt"]);
  sh(["commit", "-q", "-m", "base"]);
});

describe("resolverDentroDoRepo", () => {
  it("recusa symlinks e metadados Git, mas permite novos diretórios", () => {
    fs.symlinkSync(tmp, path.join(repo, "escape"));
    fs.symlinkSync(path.join(tmp, "inexistente"), path.join(repo, "quebrado"));
    expect(resolverDentroDoRepo(repo, "escape/segredo.txt")).toBeNull();
    expect(resolverDentroDoRepo(repo, "quebrado")).toBeNull();
    expect(resolverDentroDoRepo(repo, ".git/config")).toBeNull();
    expect(resolverDentroDoRepo(repo, "novo/src/a.ts")).toBe(path.join(repo, "novo/src/a.ts"));
  });
  it("recusa caminhos que escapam do repositório", () => {
    expect(resolverDentroDoRepo("/r", "src/a.ts")).toBe(path.resolve("/r/src/a.ts"));
    expect(resolverDentroDoRepo("/r", "../fora.ts")).toBeNull();
    expect(resolverDentroDoRepo("/r", "src/../../fora.ts")).toBeNull();
    expect(resolverDentroDoRepo("/r", "/etc/passwd")).toBeNull();
    expect(resolverDentroDoRepo("/r", "")).toBeNull();
  });
});

describe("giter", () => {
  it("requisito com substituição de shell vira texto da mensagem, não comando", async () => {
    const marker = path.join(tmp, "PWNED");
    fs.writeFileSync(path.join(repo, "novo.ts"), "export {}");
    await giter({
      requisito: `x" $(touch ${marker}) \`touch ${marker}\``,
      arquivosGerados: ["novo.ts"],
      qaAprovado: true,
    } as any);
    expect(fs.existsSync(marker)).toBe(false);
    expect(sh(["log", "-1", "--format=%s"])).toContain("$(touch");
  });

  it("commita só os arquivos gerados, nunca o resto da árvore", async () => {
    fs.writeFileSync(path.join(repo, "novo.ts"), "export {}");
    fs.writeFileSync(path.join(repo, ".env"), "SECRET=1");
    sh(["add", ".env"]);
    await giter({ requisito: "r", arquivosGerados: ["novo.ts", "../fora.ts"], qaAprovado: true } as any);
    const files = sh(["show", "--name-only", "--format=", "HEAD"]).trim().split("\n");
    expect(files).toEqual(["novo.ts"]);
    expect(sh(["status", "--porcelain"])).toContain(".env");
  });

  it("não interpreta nomes gerados como pathspecs Git", async () => {
    fs.writeFileSync(path.join(repo, "novo.ts"), "export {}");
    await expect(giter({ requisito: "r", arquivosGerados: [":(glob)*"], qaAprovado: true } as any)).rejects.toThrow();
    expect(sh(["log", "-1", "--format=%s"]).trim()).toBe("base");
    expect(sh(["status", "--porcelain"])).toContain("?? novo.ts");
  });
});
