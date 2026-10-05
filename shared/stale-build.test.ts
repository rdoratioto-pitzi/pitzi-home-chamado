import { describe, it, expect } from "vitest";
import { isStaleChunkError } from "./stale-build";

describe("isStaleChunkError", () => {
  it("reconhece arquivo da versão antiga que sumiu depois do deploy", () => {
    expect(isStaleChunkError(new Error("error loading dynamically imported module: https://x/assets/WorkspacePage-D5iNlyba.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("não confunde com outros erros", () => {
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
