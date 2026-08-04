import { describe, expect, it } from "vitest";

import { SafetyGuard } from "./safety.js";

describe("AI safety guard", () => {
  const guard = new SafetyGuard([
    { id: "default", blockedTerms: ["exploit"], redactPatterns: [/\b[\w.+-]+@[\w.-]+\b/gu] },
  ]);

  it("redacts configured PII and blocks prohibited requests", () => {
    expect(guard.inspect("default", "Email me@example.com")).toEqual({
      outcome: "redacted",
      prompt: "Email [REDACTED]",
    });
    expect(guard.inspect("default", "exploit this").outcome).toBe("blocked");
    expect(guard.inspect("default", "safe").outcome).toBe("allowed");
    expect(() => guard.inspect("missing", "safe")).toThrow(/not registered/u);
  });
});
