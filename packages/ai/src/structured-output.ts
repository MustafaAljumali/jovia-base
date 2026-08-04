import type { ZodType } from "zod";

import { AiProviderError } from "./errors.js";

export function parseStructuredOutput<Output>(
  text: string,
  schema: ZodType<Output>,
  providerId: string,
): Output {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new AiProviderError({
      category: "validation",
      providerId,
      message: "AI provider returned malformed JSON",
      cause,
    });
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AiProviderError({
      category: "validation",
      providerId,
      message: "AI provider output failed schema validation",
      cause: result.error,
    });
  }
  return result.data;
}
