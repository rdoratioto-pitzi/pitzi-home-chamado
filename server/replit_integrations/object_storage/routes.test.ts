import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("./objectStorage", () => ({
  ObjectStorageService: class {},
  ObjectNotFoundError: class extends Error {},
}));

const { registerObjectStorageRoutes } = await import("./routes");

function buildApp() {
  const app = express();
  registerObjectStorageRoutes(app);
  return app;
}

describe("PUT /api/uploads/local-put/:filename", () => {
  // Diretório descartável: mesmo contra código vulnerável, nada é escrito no repositório.
  const sandbox = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "uploads-test-")), "a", "b");
  beforeAll(() => {
    fs.mkdirSync(sandbox, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(sandbox);
  });
  afterAll(() => vi.restoreAllMocks());

  it.each([
    "..%2F..%2Fserver%2Findex.ts",
    "..%5C..%5Cx",
    "shell.sh",
    "00000000-0000-0000-0000-000000000000.html%2F..%2F..%2Fx",
  ])("recusa nome fora do formato gerado pelo servidor: %s", async (name) => {
    const res = await request(buildApp()).put(`/api/uploads/local-put/${name}`).send("x");
    expect(res.status).toBe(400);
    expect(fs.existsSync(path.join(sandbox, "uploads", decodeURIComponent(name)))).toBe(false);
  });
});
