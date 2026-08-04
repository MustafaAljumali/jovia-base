import { describe, expect, it } from "vitest";

import { mapGeminiError, mapGeminiFinishReason, mapGeminiResponse } from "./mapping.js";
import { normalizeGeminiUsage } from "./usage.js";

describe("Gemini mapping", () => {
  it("normalizes responses, usage, finish reasons, and provider ids", () => {
    expect(
      mapGeminiResponse({
        text: '{"score":91}',
        usage: { promptTokenCount: 100, candidatesTokenCount: 20 },
        finishReason: "STOP",
        responseId: "gemini-1",
      }),
    ).toEqual({
      text: '{"score":91}',
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      finishReason: "stop",
      providerRequestId: "gemini-1",
    });
    expect(mapGeminiFinishReason("MAX_TOKENS")).toBe("length");
    expect(normalizeGeminiUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  it("normalizes safety and HTTP failures", () => {
    expect(() => mapGeminiResponse({ finishReason: "SAFETY" })).toThrow(/blocked/u);
    expect(() => mapGeminiResponse({})).toThrow(/no text/u);
    expect(mapGeminiError({ status: 429 })).toMatchObject({ category: "rate_limit" });
    expect(mapGeminiError({ status: 503 })).toMatchObject({ category: "provider_unavailable" });
    expect(mapGeminiError(new Error("invalid api key"))).toMatchObject({
      category: "authentication",
    });
  });
});
