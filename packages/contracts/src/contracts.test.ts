import { describe, expect, it } from "vitest";

import { AppError } from "./errors.js";
import { HealthResponseSchema } from "./health.js";
import { SourceRegistrationSchema } from "./sources.js";

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
});
