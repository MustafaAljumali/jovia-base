import { SourceRegistrationSchema } from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import { OpportunityIngestionService } from "./index.js";

const validSource = () =>
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
    enabled: true,
  });

describe("lawful opportunity ingestion", () => {
  it("refuses to ingest an unsupported or disabled source", async () => {
    const connector = { discover: vi.fn(async () => []) };
    const service = new OpportunityIngestionService(new Map([["himalayas", connector]]), {
      now: () => new Date("2026-08-04T00:00:00.000Z"),
    });
    await expect(
      service.ingest({ ...validSource(), mechanism: "unsupported", enabled: false }),
    ).rejects.toMatchObject({
      code: "source_not_eligible",
    });
    expect(connector.discover).not.toHaveBeenCalled();
  });

  it("invokes a registered connector only for an eligible source", async () => {
    const opportunities = [
      {
        externalId: "job-1",
        sourceCode: "himalayas",
        title: "Platform Engineer",
        canonicalUrl: "https://example.com/job-1",
        discoveredAt: "2026-08-04T00:00:00.000Z",
      },
    ];
    const connector = { discover: vi.fn(async () => opportunities) };
    const service = new OpportunityIngestionService(new Map([["himalayas", connector]]), {
      now: () => new Date("2026-08-04T00:00:00.000Z"),
    });
    expect(await service.ingest(validSource(), { correlationId: "req-1" })).toEqual(opportunities);
    expect(connector.discover).toHaveBeenCalledOnce();
  });
});
