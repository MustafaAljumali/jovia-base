import type { SourceExecutionContext } from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import type { SourceAuditPort, SourceMetricsPort, SourcePolicyRepository } from "./ports.js";
import { SourceEligibilityService } from "./source-eligibility.js";

const now = new Date("2026-08-05T00:00:00.000Z");

function validContext(): SourceExecutionContext {
  return {
    source: {
      id: "00000000-0000-4000-8000-000000000001",
      code: "himalayas",
      name: "Himalayas",
      scope: "external",
      enabled: true,
      runtimeStatus: "eligible",
      activePolicyId: "00000000-0000-4000-8000-000000000002",
      nextPollAt: "2026-08-04T00:00:00.000Z",
      quarantinedAt: null,
      lastSuccessfulRunAt: null,
    },
    policy: {
      id: "00000000-0000-4000-8000-000000000002",
      sourceCode: "himalayas",
      version: 1,
      scope: "external",
      mechanism: "official_api",
      legalPosture: "approved",
      termsUrl: "https://himalayas.app/docs/remote-jobs-api",
      termsSnapshotRef: "docs/legal/sources/himalayas-2026-08-05.md",
      termsSnapshotSha256: "a".repeat(64),
      attribution: {
        required: true,
        displayText: "Data sourced from Himalayas",
        sourceUrl: "https://himalayas.app",
        originalLinkRequired: true,
        logoPolicy: "text_only",
      },
      polling: {
        pollingFloorSeconds: 86_400,
        maximumConcurrency: 1,
        minimumRequestSpacingMs: 1_000,
        honorRetryAfter: true,
        retryAfterDefaultSeconds: 60,
        officialRequestLimit: null,
      },
      retention: {
        servingTtlSeconds: 86_400,
        inactiveRetentionDays: 90,
        rawPayloadRetentionDays: 90,
        tombstoneSlaSeconds: 300,
      },
      redistribution: "prohibited",
      contentModification: {
        allowedFields: [
          "description_sanitization",
          "compensation_normalization",
          "location_normalization",
          "language_normalization",
          "taxonomy_mapping",
        ],
        translationAllowed: false,
      },
      owner: "integrations",
      verifiedAt: "2026-08-05T00:00:00.000Z",
      validUntil: "2026-11-03T23:59:59.999Z",
      approvedBy: "Product Owner",
      approvedAt: "2026-08-05T00:00:00.000Z",
      createdAt: "2026-08-05T00:00:00.000Z",
    },
    circuit: { state: "closed", consecutiveFailures: 0, openedAt: null, halfOpenAfter: null },
  };
}

function harness(context: unknown) {
  const policies: SourcePolicyRepository = {
    getExecutionContext: vi.fn(async () => context),
  };
  const audit: SourceAuditPort = {
    recordEligibilityDecision: vi.fn(async () => undefined),
  };
  const metrics: SourceMetricsPort = {
    recordEligibilityDecision: vi.fn(),
  };
  return {
    audit,
    metrics,
    service: new SourceEligibilityService(policies, audit, metrics, { now: () => now }),
  };
}

interface EligibilityPatch {
  source?: Partial<SourceExecutionContext["source"]>;
  policy?: Partial<SourceExecutionContext["policy"]>;
  circuit?: Partial<SourceExecutionContext["circuit"]>;
}

const denialCases: ReadonlyArray<readonly [string, EligibilityPatch]> = [
  ["disabled", { source: { enabled: false } }],
  ["unsupported", { policy: { mechanism: "unsupported" } }],
  ["not_approved", { policy: { legalPosture: "conditional" } }],
  ["approval_missing", { policy: { approvedBy: "" } }],
  ["verification_in_future", { policy: { verifiedAt: "2026-08-06T00:00:00.000Z" } }],
  ["policy_expired", { policy: { validUntil: "2026-08-04T23:59:59.000Z" } }],
  ["source_policy_mismatch", { policy: { sourceCode: "other" } }],
  ["quarantined", { source: { runtimeStatus: "quarantined" } }],
  ["circuit_open", { circuit: { state: "open" } }],
  ["poll_not_due", { source: { nextPollAt: "2026-08-05T00:01:00.000Z" } }],
];

describe("SourceEligibilityService", () => {
  it.each(denialCases)("denies %s before connector lookup", async (reason, patch) => {
    const base = validContext();
    const context = {
      ...base,
      source: { ...base.source, ...(patch.source ?? {}) },
      policy: { ...base.policy, ...(patch.policy ?? {}) },
      circuit: { ...base.circuit, ...(patch.circuit ?? {}) },
    };
    const connectorLookup = vi.fn();
    const { audit, metrics, service } = harness(context);

    const decision = await service.evaluate("himalayas", "poll", "eligibility-test");
    if (decision.eligible) connectorLookup();

    expect(decision).toEqual({ eligible: false, reason, sourceCode: "himalayas" });
    expect(connectorLookup).not.toHaveBeenCalled();
    expect(audit.recordEligibilityDecision).toHaveBeenCalledOnce();
    expect(metrics.recordEligibilityDecision).toHaveBeenCalledWith("himalayas", false, reason);
  });

  it("permits a complete, current and due source", async () => {
    const { service } = harness(validContext());
    await expect(service.evaluate("himalayas", "poll", "eligible-test")).resolves.toEqual({
      eligible: true,
      sourceCode: "himalayas",
      policyId: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("fails closed for malformed or missing policy state", async () => {
    await expect(
      harness(undefined).service.evaluate("missing", "poll", "missing-test"),
    ).resolves.toEqual({
      eligible: false,
      sourceCode: "missing",
      reason: "source_missing",
    });
    const malformed = validContext() as unknown as { source: { activePolicyId: string | null } };
    malformed.source.activePolicyId = null;
    await expect(
      harness(malformed).service.evaluate("himalayas", "poll", "malformed-test"),
    ).resolves.toEqual({
      eligible: false,
      sourceCode: "himalayas",
      reason: "policy_incomplete",
    });
  });

  it("allows manual publishing but never treats it as an external poll", async () => {
    const base = validContext();
    const direct = {
      ...base,
      source: { ...base.source, code: "jovia-direct", scope: "first_party", nextPollAt: null },
      policy: {
        ...base.policy,
        sourceCode: "jovia-direct",
        scope: "first_party",
        mechanism: "manual_submission",
        redistribution: "first_party_only",
      },
    };
    await expect(
      harness(direct).service.evaluate("jovia-direct", "publish", "direct-test"),
    ).resolves.toMatchObject({ eligible: true, sourceCode: "jovia-direct" });
    await expect(
      harness(direct).service.evaluate("jovia-direct", "poll", "direct-poll-test"),
    ).resolves.toEqual({
      eligible: false,
      sourceCode: "jovia-direct",
      reason: "mechanism_not_permitted",
    });
  });
});
