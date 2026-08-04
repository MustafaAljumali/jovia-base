import type { ProviderResponse } from "../../contracts.js";
import { AiProviderError } from "../../errors.js";
import type { GeminiRawResponse } from "./client.js";
import { normalizeGeminiUsage } from "./usage.js";

const safetyReasons = new Set(["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);

export function mapGeminiFinishReason(
  reason: string | undefined,
): ProviderResponse["finishReason"] {
  if (reason === "STOP") return "stop";
  if (reason === "MAX_TOKENS") return "length";
  if (reason && safetyReasons.has(reason)) return "safety";
  return "unknown";
}

export function mapGeminiResponse(
  response: GeminiRawResponse,
  providerId = "gemini",
): ProviderResponse {
  const finishReason = mapGeminiFinishReason(response.finishReason);
  if (response.blocked || finishReason === "safety") {
    throw new AiProviderError({
      category: "safety",
      providerId,
      message: "Gemini blocked the response",
    });
  }
  if (response.text === undefined) {
    throw new AiProviderError({
      category: "validation",
      providerId,
      message: "Gemini returned no text",
    });
  }
  return {
    text: response.text,
    usage: normalizeGeminiUsage(response.usage),
    finishReason,
    ...(response.responseId ? { providerRequestId: response.responseId } : {}),
  };
}

function errorRecord(error: unknown): Record<string, unknown> {
  return typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
}

export function mapGeminiError(error: unknown, providerId = "gemini"): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AiProviderError({
      category: "timeout",
      providerId,
      message: "Gemini request timed out",
      cause: error,
    });
  }
  const record = errorRecord(error);
  const status = typeof record.status === "number" ? record.status : undefined;
  const message = error instanceof Error ? error.message : "Gemini request failed";
  const lower = message.toLowerCase();
  const category =
    status === 401 || status === 403 || lower.includes("api key")
      ? "authentication"
      : status === 429
        ? "rate_limit"
        : status !== undefined && status >= 500
          ? "provider_unavailable"
          : "unknown";
  return new AiProviderError({
    category,
    providerId,
    message: "Gemini request failed",
    ...(status === undefined ? {} : { status }),
    cause: error,
  });
}
