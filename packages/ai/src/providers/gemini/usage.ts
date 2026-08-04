import type { TokenUsage } from "../../contracts.js";
import type { GeminiRawUsage } from "./client.js";

export function normalizeGeminiUsage(usage: GeminiRawUsage | undefined): TokenUsage {
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage?.totalTokenCount ?? inputTokens + outputTokens,
  };
}
