import { toJSONSchema } from "zod";

import type {
  AiCapability,
  AiProvider,
  ProviderHealth,
  ProviderRequest,
  ProviderStreamEvent,
  TokenUsage,
} from "../../contracts.js";
import type { AiErrorCategory } from "../../contracts.js";
import { mapGeminiError, mapGeminiFinishReason, mapGeminiResponse } from "./mapping.js";
import type { GeminiClient, GeminiGenerateRequest } from "./client.js";
import { normalizeGeminiUsage } from "./usage.js";

export const STABLE_GEMINI_MODEL = "gemini-3.6-flash";

export class GeminiProvider implements AiProvider {
  readonly id = "gemini";
  readonly capabilities: ReadonlySet<AiCapability> = new Set([
    "text",
    "structured_output",
    "streaming",
  ]);
  private lastSuccessAt: string | undefined;
  private lastFailureCategory: AiErrorCategory | undefined;

  constructor(
    private readonly client: GeminiClient,
    private readonly model = STABLE_GEMINI_MODEL,
  ) {
    if (model !== STABLE_GEMINI_MODEL)
      throw new Error(`Gemini model must be pinned to ${STABLE_GEMINI_MODEL}`);
  }

  private request(input: ProviderRequest, signal: AbortSignal): GeminiGenerateRequest {
    return {
      model: this.model,
      prompt: input.prompt,
      signal,
      ...(input.outputSchema ? { responseJsonSchema: toJSONSchema(input.outputSchema) } : {}),
    };
  }

  async invoke(request: ProviderRequest, signal: AbortSignal) {
    try {
      const response = mapGeminiResponse(
        await this.client.generate(this.request(request, signal)),
        this.id,
      );
      this.lastSuccessAt = new Date().toISOString();
      this.lastFailureCategory = undefined;
      return response;
    } catch (error) {
      const normalized = mapGeminiError(error, this.id);
      this.lastFailureCategory = normalized.category;
      throw normalized;
    }
  }

  async *stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamEvent> {
    let lastUsage: TokenUsage | undefined;
    let finishReason: "stop" | "length" | "safety" | "unknown" = "unknown";
    try {
      for await (const chunk of this.client.stream(this.request(request, signal))) {
        if (chunk.text) yield { type: "delta", text: chunk.text };
        if (chunk.usage) lastUsage = normalizeGeminiUsage(chunk.usage);
        if (chunk.finishReason) finishReason = mapGeminiFinishReason(chunk.finishReason);
        if (chunk.blocked || finishReason === "safety") {
          throw mapGeminiResponse(chunk, this.id);
        }
      }
      if (lastUsage) yield { type: "usage", usage: lastUsage };
      yield { type: "done", finishReason };
      this.lastSuccessAt = new Date().toISOString();
      this.lastFailureCategory = undefined;
    } catch (error) {
      const normalized = mapGeminiError(error, this.id);
      this.lastFailureCategory = normalized.category;
      throw normalized;
    }
  }

  async health(): Promise<ProviderHealth> {
    return {
      status: this.lastFailureCategory ? "degraded" : "healthy",
      ...(this.lastSuccessAt ? { lastSuccessAt: this.lastSuccessAt } : {}),
      ...(this.lastFailureCategory ? { lastFailureCategory: this.lastFailureCategory } : {}),
    };
  }
}
