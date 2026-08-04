import { describe, expect, it } from "vitest";

import { findForbiddenImports, findMutableActionReferences } from "./check-architecture.mjs";

describe("architecture policy", () => {
  it("rejects an external provider import outside its adapter", () => {
    expect(
      findForbiddenImports("packages/ai/src/task-router.ts", 'import "@google/genai";'),
    ).toEqual(["@google/genai imports are restricted to packages/ai/src/providers/gemini"]);
  });

  it("allows the Gemini SDK only at the client adapter boundary", () => {
    expect(
      findForbiddenImports("packages/ai/src/providers/gemini/client.ts", 'import "@google/genai";'),
    ).toEqual([]);
  });

  it("rejects mutable GitHub Action references", () => {
    expect(findMutableActionReferences("steps:\n  - uses: actions/checkout@v4\n")).toEqual([
      "uses: actions/checkout@v4",
    ]);
    expect(
      findMutableActionReferences(
        "steps:\n  - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262\n",
      ),
    ).toEqual([]);
  });
});
