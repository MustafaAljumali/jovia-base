import { describe, expect, it } from "vitest";

import { colorTokens, semanticTokens } from "./tokens.js";

describe("monochrome design tokens", () => {
  it("contains only black, white, and neutral gray colors", () => {
    expect(colorTokens).toMatchObject({ black: "#000000", white: "#ffffff" });
    expect(semanticTokens.dark.background).toBe(colorTokens.black);
    expect(semanticTokens.light.background).toBe(colorTokens.white);
    expect(Object.keys(colorTokens).every((name) => /black|white|gray/u.test(name))).toBe(true);
  });
});
