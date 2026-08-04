import type { ZodType } from "zod";

export type AiCapability = "text" | "structured_output" | "streaming";
export type AiErrorCategory =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "provider_unavailable"
  | "safety"
  | "validation"
  | "client"
  | "unknown";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProviderRequest {
  requestId: string;
  task: string;
  prompt: string;
  promptVersion: string;
  model?: string;
  outputSchema?: ZodType;
  safetyPolicyId: string;
}

export interface ProviderResponse {
  text: string;
  usage: TokenUsage;
  finishReason: "stop" | "length" | "safety" | "unknown";
  providerRequestId?: string;
}

export type ProviderStreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; finishReason: ProviderResponse["finishReason"] };

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unavailable" | "unconfigured";
  lastSuccessAt?: string;
  lastFailureCategory?: AiErrorCategory;
}

export interface AiProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<AiCapability>;
  invoke(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResponse>;
  stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamEvent>;
  health(): Promise<ProviderHealth>;
}

export interface AiAttemptAudit {
  providerId: string;
  model: string | undefined;
  startedAt: string;
  finishedAt: string;
  result: "success" | "failure";
  errorCategory?: AiErrorCategory;
  usage?: TokenUsage;
}

export interface AiInvocationAudit {
  requestId: string;
  task: string;
  promptVersion: string;
  safetyPolicyId: string;
  safetyOutcome: "allowed" | "redacted" | "blocked";
  attempts: AiAttemptAudit[];
}

export interface AiRequest<Output> extends ProviderRequest {
  outputSchema: ZodType<Output>;
}

export interface AiInvocationResult<Output> {
  output: Output;
  response: ProviderResponse;
  audit: AiInvocationAudit;
}
