import type { AiErrorCategory } from "./contracts.js";

const retryableCategories = new Set<AiErrorCategory>([
  "rate_limit",
  "timeout",
  "provider_unavailable",
  "unknown",
]);

export class AiProviderError extends Error {
  readonly category: AiErrorCategory;
  readonly providerId: string;
  readonly status: number | undefined;

  constructor(options: {
    category: AiErrorCategory;
    providerId: string;
    message: string;
    status?: number;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "AiProviderError";
    this.category = options.category;
    this.providerId = options.providerId;
    this.status = options.status;
  }

  get retryable() {
    return retryableCategories.has(this.category);
  }
}

export function normalizeAiError(error: unknown, providerId: string): AiProviderError {
  return error instanceof AiProviderError
    ? error
    : new AiProviderError({
        category: "unknown",
        providerId,
        message: "AI provider failed",
        cause: error,
      });
}
