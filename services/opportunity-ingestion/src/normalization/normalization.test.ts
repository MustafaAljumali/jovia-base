import type { SourceOpportunityRecord, SourcePolicyVersion } from "@jovia/contracts";
import { describe, expect, it } from "vitest";

import type { NormalizationError } from "./normalize.js";
import { normalizeOpportunity } from "./normalize.js";
import { normalizeCompensation } from "./compensation.js";

const policy: SourcePolicyVersion = {
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
};

function record(overrides: Partial<SourceOpportunityRecord> = {}): SourceOpportunityRecord {
  return {
    externalId: "job-1",
    sourceCode: "himalayas",
    title: "  Senior Platform Engineer  ",
    descriptionHtml:
      '<p onclick="alert(1)">Build &amp; ship<script>alert(2)</script> <a href="javascript:bad()">now</a></p>',
    employerName: "  JÓVIA, Inc. ",
    engagementType: "contract",
    experienceLevels: ["senior"],
    categories: [" Engineering ", "engineering"],
    technologies: [" TypeScript ", "PostgreSQL"],
    languages: ["fr", "en", "fr"],
    location: {
      remote: true,
      raw: "Worldwide",
      countryCodes: ["us", "GB", "us"],
      timezoneRestrictions: [" UTC+03 ", "UTC+03"],
    },
    compensation: { kind: "hourly", minimum: "50.25", maximum: "75", currency: "usd" },
    publishedAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:30:00.000Z",
    expiresAt: "2026-09-05T00:00:00.000Z",
    originalUrl: "https://example.com/apply/job-1",
    applicationUrl: "https://example.com/apply/job-1",
    extension: { sourceCategory: "dev" },
    ...overrides,
  };
}

describe("opportunity normalization", () => {
  it.each([
    ["hourly", "50", "104000.00"],
    ["daily", "400", "104000.00"],
    ["weekly", "2000", "104000.00"],
    ["fortnightly", "4000", "104000.00"],
    ["monthly", "8666.666666", "103999.999992"],
    ["annual", "104000", "104000"],
  ] as const)("annualizes %s using decimal arithmetic", (kind, minimum, annualizedMinimum) => {
    expect(normalizeCompensation({ kind, minimum, currency: "USD" })).toMatchObject({
      kind,
      minimum,
      currency: "USD",
      sourcePeriod: kind,
      annualizedMinimum,
    });
  });

  it("does not annualize project budgets or convert currency", () => {
    expect(normalizeCompensation({ kind: "project", minimum: "1000", currency: "EUR" })).toEqual({
      kind: "project",
      minimum: "1000",
      currency: "EUR",
      sourcePeriod: "project",
    });
  });

  it("sanitizes active content, normalizes ISO values and stabilizes collection ordering", () => {
    const normalized = normalizeOpportunity(record(), {
      policy,
      normalizedAt: new Date("2026-08-05T01:00:00.000Z"),
    });

    expect(normalized).toMatchObject({
      title: "Senior Platform Engineer",
      descriptionHtml: "<p>Build &amp; ship <a>now</a></p>",
      descriptionText: "Build & ship now",
      employerName: "JÓVIA, Inc.",
      employerKey: "jóvia inc",
      languages: ["en", "fr"],
      categories: ["engineering"],
      technologies: ["PostgreSQL", "TypeScript"],
      location: { countryCodes: ["GB", "US"], timezoneRestrictions: ["UTC+03"] },
      compensation: {
        currency: "USD",
        annualizedMinimum: "104520.00",
        annualizedMaximum: "156000.00",
      },
    });
    expect(normalized.contentSignature).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("produces the same signature for non-semantic ordering and whitespace changes", () => {
    const first = normalizeOpportunity(record(), { policy, normalizedAt: new Date() });
    const second = normalizeOpportunity(
      record({
        title: "Senior   Platform Engineer",
        location: { ...record().location, countryCodes: ["gb", "US"] },
      }),
      { policy, normalizedAt: new Date() },
    );
    expect(second.contentSignature).toBe(first.contentSignature);
  });

  it.each([
    [
      "currency",
      record({ compensation: { kind: "hourly", minimum: "50", currency: "ZZZ" } }),
      "invalid_currency",
    ],
    ["language", record({ languages: ["english"] }), "invalid_language"],
    [
      "country",
      record({ location: { ...record().location, countryCodes: ["XX"] } }),
      "invalid_country",
    ],
  ] as const)("rejects unknown %s instead of guessing", (_field, input, code) => {
    expect(() => normalizeOpportunity(input, { policy, normalizedAt: new Date() })).toThrowError(
      expect.objectContaining<Partial<NormalizationError>>({ code }),
    );
  });

  it("rejects a transformation the active policy does not allow", () => {
    const restrictive = {
      ...policy,
      contentModification: { allowedFields: [], translationAllowed: false },
    } satisfies SourcePolicyVersion;
    expect(() =>
      normalizeOpportunity(record(), { policy: restrictive, normalizedAt: new Date() }),
    ).toThrowError(
      expect.objectContaining<Partial<NormalizationError>>({ code: "modification_not_permitted" }),
    );
  });
});
