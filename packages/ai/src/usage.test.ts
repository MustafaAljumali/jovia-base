import { describe, expect, it } from "vitest";

import { accountUsage, calculateCostMicrousd } from "./usage.js";

const usage = { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 };

describe("AI usage accounting", () => {
  it("uses integer micro-USD accounting and preserves unknown pricing", () => {
    expect(
      calculateCostMicrousd(usage, {
        inputMicrousdPerMillion: 100n,
        outputMicrousdPerMillion: 200n,
      }),
    ).toBe(200n);
    expect(accountUsage(usage).costStatus).toBe("unknown");
  });
});
