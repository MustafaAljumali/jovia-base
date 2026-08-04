import type {
  AiCapability,
  AiInvocationAudit,
  AiInvocationResult,
  AiRequest,
} from "./contracts.js";
import { AiProviderError, normalizeAiError } from "./errors.js";
import type { AiAuditSink } from "./audit.js";
import type { AiProviderRegistry } from "./provider-registry.js";
import type { SafetyGuard } from "./safety.js";
import { parseStructuredOutput } from "./structured-output.js";
import { withRetry } from "./retry.js";

export interface AiTaskPolicy {
  task: string;
  primaryProvider: string;
  fallbackProviders: readonly string[];
  timeoutMs: number;
  maxAttempts: number;
  requiredCapabilities: ReadonlySet<AiCapability>;
}

export interface AiTaskRouterOptions {
  registry: AiProviderRegistry;
  policies: readonly AiTaskPolicy[];
  safety: SafetyGuard;
  auditSink?: AiAuditSink;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

export class AiTaskRouter {
  private readonly policies = new Map<string, AiTaskPolicy>();
  private readonly now: () => Date;

  constructor(private readonly options: AiTaskRouterOptions) {
    this.now = options.now ?? (() => new Date());
    for (const policy of options.policies) {
      if (this.policies.has(policy.task))
        throw new Error(`duplicate AI task policy: ${policy.task}`);
      for (const id of [policy.primaryProvider, ...policy.fallbackProviders])
        options.registry.get(id);
      this.policies.set(policy.task, Object.freeze({ ...policy }));
    }
  }

  async invoke<Output>(request: AiRequest<Output>): Promise<AiInvocationResult<Output>> {
    const policy = this.policies.get(request.task);
    if (!policy) throw new Error(`AI task policy is not registered: ${request.task}`);
    const safety = this.options.safety.inspect(request.safetyPolicyId, request.prompt);
    if (safety.outcome === "blocked") {
      throw new AiProviderError({
        category: "safety",
        providerId: "router",
        message: "AI request blocked",
      });
    }

    const audit: AiInvocationAudit = {
      requestId: request.requestId,
      task: request.task,
      promptVersion: request.promptVersion,
      safetyPolicyId: request.safetyPolicyId,
      safetyOutcome: safety.outcome,
      attempts: [],
    };

    let lastError: AiProviderError | undefined;
    for (const providerId of [policy.primaryProvider, ...policy.fallbackProviders]) {
      const provider = this.options.registry.get(providerId);
      const missingCapability = [...policy.requiredCapabilities].find(
        (capability) => !provider.capabilities.has(capability),
      );
      if (missingCapability) throw new Error(`${providerId} lacks capability ${missingCapability}`);
      const startedAt = this.now().toISOString();
      try {
        const response = await withRetry(
          async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
            try {
              return await provider.invoke(
                { ...request, prompt: safety.prompt },
                controller.signal,
              );
            } finally {
              clearTimeout(timer);
            }
          },
          (error) => normalizeAiError(error, providerId).retryable,
          {
            maxAttempts: policy.maxAttempts,
            baseDelayMs: 25,
            random: this.options.random,
            sleep: this.options.sleep,
          },
        );
        const output = parseStructuredOutput(response.text, request.outputSchema, providerId);
        audit.attempts.push({
          providerId,
          model: request.model,
          startedAt,
          finishedAt: this.now().toISOString(),
          result: "success",
          usage: response.usage,
        });
        await this.options.auditSink?.record(audit);
        return { output, response, audit };
      } catch (error) {
        lastError = normalizeAiError(error, providerId);
        audit.attempts.push({
          providerId,
          model: request.model,
          startedAt,
          finishedAt: this.now().toISOString(),
          result: "failure",
          errorCategory: lastError.category,
        });
        if (!lastError.retryable) break;
      }
    }
    await this.options.auditSink?.record(audit);
    throw lastError ?? new Error("AI routing failed");
  }
}
