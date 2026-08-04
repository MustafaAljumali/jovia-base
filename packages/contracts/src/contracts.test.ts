import { describe, expect, it } from "vitest";

import { AppError } from "./errors.js";
import { OpportunityEventSchema } from "./events.js";
import { HealthResponseSchema } from "./health.js";
import { createOpportunityOpenApiDocument } from "./openapi.js";
import { CompensationSchema, DirectOpportunityCommandSchema } from "./opportunities.js";
import { SourcePolicyVersionSchema, SourceRegistrationSchema } from "./sources.js";

describe("shared contracts", () => {
  it("constructs normalized application errors", () => {
    const error = new AppError({ code: "denied", status: 403, title: "Denied" });
    expect(error).toMatchObject({ name: "AppError", code: "denied", status: 403 });
  });

  it("validates health and source payloads", () => {
    expect(
      HealthResponseSchema.parse({
        status: "ok",
        service: "jovia-api",
        version: "0.1.0",
        timestamp: "2026-08-04T00:00:00.000Z",
      }).status,
    ).toBe("ok");
    expect(
      SourceRegistrationSchema.parse({
        code: "himalayas",
        name: "Himalayas",
        mechanism: "official_api",
        legalPosture: "approved",
        termsUrl: "https://himalayas.app/terms",
        attributionRule: "Link to source",
        pollingFloorSeconds: 300,
        cacheTtlSeconds: 300,
        redistributionRule: "Metadata only",
        owner: "Product Operations",
        lastVerifiedAt: "2026-08-04T00:00:00.000Z",
      }).enabled,
    ).toBe(false);
  });

  it("rejects an approved external policy without immutable terms evidence", () => {
    const result = SourcePolicyVersionSchema.safeParse({
      sourceCode: "himalayas",
      version: 1,
      scope: "external",
      mechanism: "official_api",
      legalPosture: "approved",
    });

    expect(result.success).toBe(false);
  });

  it("keeps decimal amounts and normalized ISO values at the boundary", () => {
    expect(
      CompensationSchema.parse({
        kind: "hourly",
        minimum: "50.25",
        maximum: "75",
        currency: "USD",
        sourcePeriod: "hourly",
        annualizedMinimum: "104520.00",
        annualizedMaximum: "156000.00",
      }).currency,
    ).toBe("USD");
  });

  it("emits only supported version-one opportunity events", () => {
    expect(
      OpportunityEventSchema.parse({
        eventId: "00000000-0000-4000-8000-000000000001",
        eventKey: "opportunity.discovered:00000000-0000-4000-8000-000000000002:1",
        type: "opportunity.discovered.v1",
        occurredAt: "2026-08-05T00:00:00.000Z",
        correlationId: "contract-test",
        opportunityId: "00000000-0000-4000-8000-000000000002",
        lifecycle: "active",
      }).type,
    ).toBe("opportunity.discovered.v1");
  });

  it("keeps requests strict and publishes all approved OpenAPI paths", () => {
    const invalid = DirectOpportunityCommandSchema.safeParse({
      publisherOrganizationId: "00000000-0000-4000-8000-000000000001",
      title: "Platform engineer",
      descriptionHtml: "<p>Build Jovia</p>",
      employerName: "Jovia",
      engagementType: "contract",
      experienceLevels: ["senior"],
      categories: ["Engineering"],
      technologies: ["TypeScript"],
      languages: ["en"],
      location: { remote: true, countryCodes: ["IQ"], timezoneRestrictions: [] },
      publishedAt: "2026-08-05T00:00:00.000Z",
      applicationUrl: "https://jovia.dev/apply/1",
      extension: {},
      unexpected: true,
    });
    expect(invalid.success).toBe(false);

    const document = createOpportunityOpenApiDocument() as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths).sort()).toEqual([
      "/v1/admin/ingestion-runs",
      "/v1/admin/opportunity-sources",
      "/v1/openapi.json",
      "/v1/opportunities",
      "/v1/opportunities/{id}",
    ]);
  });
});
