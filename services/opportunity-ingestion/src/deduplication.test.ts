import { describe, expect, it } from "vitest";

import {
  DeterministicDeduplicationStrategy,
  selectCanonicalCandidate,
  type DeduplicationCandidate,
} from "./deduplication.js";

const proposed: DeduplicationCandidate = {
  opportunityId: "00000000-0000-4000-8000-000000000010",
  canonicalOpportunityId: "00000000-0000-4000-8000-000000000010",
  sourceScope: "external",
  sourceReliability: 80,
  firstSeenAt: "2026-08-05T00:00:00.000Z",
};

describe("deterministic opportunity deduplication", () => {
  it("creates a new canonical when no exact signature exists inside 24 hours", async () => {
    const strategy = new DeterministicDeduplicationStrategy({
      findExactWithinWindow: async () => [],
    });
    await expect(
      strategy.decide({
        contentSignature: "a".repeat(64),
        publishedAt: "2026-08-05T00:00:00.000Z",
        proposed,
      }),
    ).resolves.toEqual({ kind: "new", canonicalOpportunityId: proposed.opportunityId });
  });

  it("links an exact match to the stable winning canonical", async () => {
    const existing: DeduplicationCandidate = {
      ...proposed,
      opportunityId: "00000000-0000-4000-8000-000000000001",
      canonicalOpportunityId: "00000000-0000-4000-8000-000000000001",
      firstSeenAt: "2026-08-04T23:00:00.000Z",
    };
    const strategy = new DeterministicDeduplicationStrategy({
      findExactWithinWindow: async (_signature, publishedAt, windowSeconds) => {
        expect(publishedAt).toBe("2026-08-05T00:00:00.000Z");
        expect(windowSeconds).toBe(86_400);
        return [existing];
      },
    });
    await expect(
      strategy.decide({
        contentSignature: "a".repeat(64),
        publishedAt: "2026-08-05T00:00:00.000Z",
        proposed,
      }),
    ).resolves.toEqual({
      kind: "duplicate",
      canonicalOpportunityId: existing.opportunityId,
      duplicateOpportunityIds: [proposed.opportunityId],
    });
  });

  it("promotes first-party, then reliability, first seen, and lexical ID deterministically", () => {
    const candidates: DeduplicationCandidate[] = [
      proposed,
      { ...proposed, opportunityId: "00000000-0000-4000-8000-000000000003", sourceReliability: 90 },
      {
        ...proposed,
        opportunityId: "00000000-0000-4000-8000-000000000002",
        sourceScope: "first_party",
        sourceReliability: 10,
      },
      {
        ...proposed,
        opportunityId: "00000000-0000-4000-8000-000000000001",
        sourceScope: "first_party",
        sourceReliability: 10,
      },
    ];
    expect(selectCanonicalCandidate(candidates).opportunityId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("exposes a semantic extension kind without invoking AI in this strategy", () => {
    const strategy = new DeterministicDeduplicationStrategy({
      findExactWithinWindow: async () => [],
    });
    expect(strategy.kind).toBe("deterministic");
  });
});
