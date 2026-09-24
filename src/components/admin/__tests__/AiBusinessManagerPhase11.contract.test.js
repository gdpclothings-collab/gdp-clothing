import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../AiBusinessManagerModule.jsx", import.meta.url), "utf8");

describe("AI Business Manager Phase 1.1 safety contract", () => {
  it("keeps the admin UI read-only", () => {
    expect(source).toContain("strictly read-only");
    expect(source).toContain("no write actions");
    expect(source).not.toMatch(/refund\s*\(/i);
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
  });
});
