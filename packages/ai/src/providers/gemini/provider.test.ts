import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { ProviderRequest } from "../../contracts.js";
import type { GeminiClient, GeminiRawResponse } from "./client.js";
import { GeminiProvider, STABLE_GEMINI_MODEL } from "./provider.js";

function request(): ProviderRequest {
  return {
    requestId: "req-1",
    task: "score",
    prompt: "Score this opportunity",
    promptVersion: "1.0.0",
    safetyPolicyId: "default",
    outputSchema: z.object({ score: z.number() }),
  };
}

function fakeClient(response: GeminiRawResponse): GeminiClient {
  return {
    generate: vi.fn(async () => response),
    async *stream() {
      yield { text: '{"score":' };
      yield response;
    },
  };
}

describe("Gemini provider", () => {
  it("maps a response into provider-neutral output and usage", async () => {
    const client = fakeClient({
      text: '{"score":91}',
      usage: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 },
      finishReason: "STOP",
    });
    const provider = new GeminiProvider(client);
    expect(await provider.invoke(request(), new AbortController().signal)).toMatchObject({
      text: '{"score":91}',
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    });
    expect(client.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: STABLE_GEMINI_MODEL,
        responseJsonSchema: expect.any(Object),
      }),
    );
  });

  it("streams ordered deltas and one terminal usage event", async () => {
    const provider = new GeminiProvider(
      fakeClient({
        text: "91}",
        usage: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 },
        finishReason: "STOP",
      }),
    );
    const events = [];
    for await (const event of provider.stream(request(), new AbortController().signal))
      events.push(event);
    expect(events.map(({ type }) => type)).toEqual(["delta", "delta", "usage", "done"]);
    expect((await provider.health()).status).toBe("healthy");
  });

  it("rejects unpinned models and normalizes failures", async () => {
    expect(() => new GeminiProvider(fakeClient({ text: "ok" }), "gemini-latest")).toThrow(
      /pinned/u,
    );
    const client: GeminiClient = {
      generate: vi.fn(async () => {
        throw { status: 429 };
      }),
      async *stream() {
        yield { text: "partial" };
        throw { status: 503 };
      },
    };
    const provider = new GeminiProvider(client);
    await expect(provider.invoke(request(), new AbortController().signal)).rejects.toMatchObject({
      category: "rate_limit",
    });
    expect((await provider.health()).status).toBe("degraded");
  });
});
