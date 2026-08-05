import {
  AppError,
  CanonicalOpportunitySchema,
  type DirectOpportunityCommand,
} from "@jovia/contracts";
import type { Actor, Capability } from "@jovia/auth";
import { describe, expect, it, vi } from "vitest";

import { createApiApp, type ApiOpportunityCoreDependencies } from "../app.js";

const opportunity = CanonicalOpportunitySchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  publisherOrganizationId: "00000000-0000-4000-8000-000000000010",
  lifecycle: "active",
  title: "Senior Platform Engineer",
  descriptionHtml: "<p>Build reliable systems</p>",
  descriptionText: "Build reliable systems",
  employerName: "Jovia",
  employerKey: "jovia",
  engagementType: "contract",
  experienceLevels: ["senior"],
  categories: ["engineering"],
  technologies: ["TypeScript"],
  languages: ["en"],
  location: { remote: true, countryCodes: ["IQ"], timezoneRestrictions: [] },
  compensation: {
    kind: "hourly",
    minimum: "50",
    maximum: "80",
    currency: "USD",
    sourcePeriod: "hourly",
    annualizedMinimum: "104000",
    annualizedMaximum: "166400",
  },
  publishedAt: "2026-08-05T00:00:00.000Z",
  sourceUpdatedAt: null,
  expiresAt: null,
  deadlineAt: null,
  firstSeenAt: "2026-08-05T00:00:00.000Z",
  lastSeenAt: "2026-08-05T00:00:00.000Z",
  normalizedAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
  originalUrl: "https://jovia.dev/opportunities/platform-engineer",
  applicationUrl: "https://jovia.dev/opportunities/platform-engineer",
  contentSignature: "a".repeat(64),
  canonicalOpportunityId: "00000000-0000-4000-8000-000000000001",
  deduplicationStrategy: "deterministic",
  deletionState: "present",
  tombstoneReason: null,
  tombstonedAt: null,
  purgeEligibleAt: null,
  purgedAt: null,
  extension: {},
  attribution: {
    source: "jovia-direct",
    sourceName: "Jovia Direct",
    attributionText: "Opportunity published through Jovia",
    sourceUrl: "https://jovia.dev",
    originalUrl: "https://jovia.dev/opportunities/platform-engineer",
  },
  provenance: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      sourceCode: "jovia-direct",
      sourcePolicyId: "00000000-0000-4000-8000-000000000003",
      externalId: "direct:test",
      originalUrl: "https://jovia.dev/opportunities/platform-engineer",
      rawObjectKey: "jovia-direct/raw.json",
      rawSha256: "b".repeat(64),
      fetchedAt: "2026-08-05T00:00:00.000Z",
      sourcePublishedAt: "2026-08-05T00:00:00.000Z",
      sourceUpdatedAt: null,
      ingestionRunId: "00000000-0000-4000-8000-000000000004",
      connectorVersion: "jovia-direct/1.0.0",
      mapperVersion: "jovia-direct/1.0.0",
      normalizationVersion: "opportunity-normalizer/1.0.0",
      deletionState: "present",
      tombstonedAt: null,
      purgedAt: null,
    },
  ],
});

const command: DirectOpportunityCommand = {
  publisherOrganizationId: "00000000-0000-4000-8000-000000000010",
  publishingTermsVersion: "2026-08-05",
  title: opportunity.title,
  descriptionHtml: opportunity.descriptionHtml,
  employerName: opportunity.employerName,
  engagementType: "contract",
  experienceLevels: ["senior"],
  categories: ["engineering"],
  technologies: ["TypeScript"],
  languages: ["en"],
  location: opportunity.location,
  publishedAt: opportunity.publishedAt,
  applicationUrl: opportunity.applicationUrl,
  extension: {},
};

function actor(...capabilities: Capability[]): Actor {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    capabilities: new Set(capabilities),
    externalSubjects: [],
  };
}

function core(principal: Actor | undefined): ApiOpportunityCoreDependencies {
  return {
    authenticator: { authenticate: vi.fn(async () => principal) },
    rateLimiter: {
      consume: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0, remaining: 99 })),
    },
    metrics: { observe: vi.fn() },
    direct: {
      create: vi.fn(async () => opportunity),
      replace: vi.fn(async () => opportunity),
      remove: vi.fn(async () => opportunity),
    },
    opportunities: {
      getById: vi.fn(async () => opportunity),
      listActive: vi.fn(async () => [opportunity]),
    },
    sources: { listSources: vi.fn(async () => []) },
    runs: { listRuns: vi.fn(async () => []) },
  };
}

describe("opportunity v1 API contracts", () => {
  it.each([
    [undefined, 401, "authentication_required"],
    [actor("opportunity:read"), 403, "capability_denied"],
  ] as const)("fails closed before publishing", async (principal, status, code) => {
    const app = await createApiApp({
      config: { version: "test" },
      opportunityCore: core(principal),
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/opportunities",
      headers: { authorization: "Bearer test-token", "idempotency-key": "publish-key-0001" },
      payload: command,
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ code, correlationId: expect.any(String) });
    await app.close();
  });

  it("validates strict input and returns explicit attribution and provenance", async () => {
    const dependencies = core(actor("opportunity:read", "opportunity:publish"));
    const app = await createApiApp({ config: { version: "test" }, opportunityCore: dependencies });
    const created = await app.inject({
      method: "POST",
      url: "/v1/opportunities",
      headers: { authorization: "Bearer test-token", "idempotency-key": "publish-key-0002" },
      payload: command,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      attribution: { source: "jovia-direct" },
      provenance: [expect.objectContaining({ rawSha256: "b".repeat(64) })],
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/opportunities",
      headers: { authorization: "Bearer test-token", "idempotency-key": "publish-key-0003" },
      payload: { ...command, unsupportedField: true },
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({ code: "validation_failed" });
    await app.close();
  });

  it("preserves organization-scope denial and idempotency conflict problem codes", async () => {
    const dependencies = core(actor("opportunity:publish"));
    vi.mocked(dependencies.direct.create).mockRejectedValueOnce(
      new AppError({
        code: "organization_scope_denied",
        status: 403,
        title: "Publisher scope denied",
      }),
    );
    const app = await createApiApp({ config: { version: "test" }, opportunityCore: dependencies });
    const response = await app.inject({
      method: "POST",
      url: "/v1/opportunities",
      headers: { authorization: "Bearer test-token", "idempotency-key": "publish-key-0004" },
      payload: command,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "organization_scope_denied" });
    await app.close();
  });

  it("rate limits by stable actor and route with Retry-After", async () => {
    const dependencies = core(actor("opportunity:read"));
    vi.mocked(dependencies.rateLimiter.consume).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
      remaining: 0,
    });
    const app = await createApiApp({ config: { version: "test" }, opportunityCore: dependencies });
    const response = await app.inject({
      method: "GET",
      url: "/v1/opportunities",
      headers: { authorization: "Bearer test-token" },
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expect(dependencies.rateLimiter.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "00000000-0000-4000-8000-000000000099",
        route: "/v1/opportunities",
      }),
    );
    await app.close();
  });

  it("publishes an OpenAPI 3.1 contract covering every registered protected operation", async () => {
    const app = await createApiApp({
      config: { version: "test" },
      opportunityCore: core(actor("opportunity:read")),
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/openapi.json",
      headers: { authorization: "Bearer test-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/v1/opportunities": { get: expect.any(Object), post: expect.any(Object) },
        "/v1/opportunities/{id}": {
          get: expect.any(Object),
          put: expect.any(Object),
          delete: expect.any(Object),
        },
        "/v1/admin/opportunity-sources": { get: expect.any(Object) },
        "/v1/admin/ingestion-runs": { get: expect.any(Object) },
      },
    });
    await app.close();
  });
});
