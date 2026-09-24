import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../aiBusinessManagerApi.js", import.meta.url), "utf8");

describe("AI Business Manager API contract", () => {
  it("invokes summary only and contains no database mutation calls", () => {
    expect(source).toContain('action: "summary"');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
  });
});
