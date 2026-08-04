import type {
  AiCapability,
  AiProvider,
  ProviderHealth,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamEvent,
} from "../contracts.js";
import { AiProviderError } from "../errors.js";

export class FakeAiProvider implements AiProvider {
  readonly capabilities: ReadonlySet<AiCapability> = new Set([
    "text",
    "structured_output",
    "streaming",
  ]);

  private constructor(
    readonly id: string,
    private readonly result: ProviderResponse | AiProviderError,
  ) {}

  static success(id: string, options: { text: string; usage?: ProviderResponse["usage"] }) {
    return new FakeAiProvider(id, {
      text: options.text,
      usage: options.usage ?? { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    });
  }

  static retryableFailure(id: string) {
    return new FakeAiProvider(
      id,
      new AiProviderError({
        category: "provider_unavailable",
        providerId: id,
        message: "unavailable",
      }),
    );
  }

  async invoke(_request: ProviderRequest, signal: AbortSignal) {
    if (signal.aborted)
      throw new AiProviderError({ category: "timeout", providerId: this.id, message: "aborted" });
    if (this.result instanceof AiProviderError) throw this.result;
    return this.result;
  }

  async *stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamEvent> {
    const response = await this.invoke(request, signal);
    yield { type: "delta", text: response.text };
    yield { type: "usage", usage: response.usage };
    yield { type: "done", finishReason: response.finishReason };
  }

  async health(): Promise<ProviderHealth> {
    return { status: this.result instanceof AiProviderError ? "degraded" : "healthy" };
  }
}
