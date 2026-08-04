import { SourceRegistrationSchema } from "@jovia/contracts";
import { describe, expect, it } from "vitest";

import { aiUsageEvents } from "./ai-usage-events.js";
import { sourceRegistry } from "./source-registry.js";

describe("PostgreSQL foundation schema", () => {
  it("keeps new sources disabled until legal posture is executable", () => {
    expect(sourceRegistry.enabled.hasDefault).toBe(true);
    const source = SourceRegistrationSchema.parse({
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
    });
    expect(source.enabled).toBe(false);
  });

  it("records provider, model, prompt, tokens, cost, and result fields", () => {
    expect(Object.keys(aiUsageEvents)).toEqual(
      expect.arrayContaining([
        "provider",
        "model",
        "promptVersion",
        "inputTokens",
        "outputTokens",
        "totalTokens",
        "costMicrousd",
        "success",
      ]),
    );
  });
});
