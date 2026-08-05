import type { SourcePolicyVersion } from "@jovia/contracts";
import { describe, expect, it } from "vitest";

import { stricterRequestSpacingMilliseconds } from "./rate-limiter.js";

const polling: SourcePolicyVersion["polling"] = {
  pollingFloorSeconds: 86_400,
  maximumConcurrency: 1,
  minimumRequestSpacingMs: 1_000,
  honorRetryAfter: true,
  retryAfterDefaultSeconds: 60,
  officialRequestLimit: null,
};

describe("source request spacing", () => {
  it("keeps the self-imposed limit when the official quota is unknown", () => {
    expect(stricterRequestSpacingMilliseconds(polling)).toBe(1_000);
  });

  it("uses the stricter official spacing without inventing a quota", () => {
    expect(
      stricterRequestSpacingMilliseconds({
        ...polling,
        officialRequestLimit: { requests: 1, windowSeconds: 60 },
      }),
    ).toBe(60_000);
  });
});
