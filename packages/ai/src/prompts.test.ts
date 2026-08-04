import { describe, expect, it } from "vitest";

import { PromptRegistry } from "./prompts.js";

describe("prompt registry", () => {
  it("requires bounded-context ids and semantic versions", () => {
    const registry = new PromptRegistry([
      { id: "opportunity.score", version: "1.0.0", template: "Score the opportunity." },
    ]);
    expect(registry.get("opportunity.score", "1.0.0").template).toMatch(/Score/u);
    expect(() => new PromptRegistry([{ id: "invalid", version: "latest", template: "x" }])).toThrow(
      /invalid/u,
    );
  });
});
