import { z } from "zod";
import { describe, expect, it } from "vitest";

import { InMemoryAiAuditSink } from "./audit.js";
import { AiProviderRegistry } from "./provider-registry.js";
import { FakeAiProvider } from "./providers/fake.js";
import { SafetyGuard } from "./safety.js";
import { AiTaskRouter } from "./task-router.js";

describe("AI task router", () => {
  it("fails over after a retryable primary error and records both attempts", async () => {
    const primary = FakeAiProvider.retryableFailure("gemini-primary");
    const fallback = FakeAiProvider.success("fallback", { text: '{"answer":"ok"}' });
    const auditSink = new InMemoryAiAuditSink();
    const router = new AiTaskRouter({
      registry: new AiProviderRegistry([primary, fallback]),
      policies: [
        {
          task: "proposal",
          primaryProvider: "gemini-primary",
          fallbackProviders: ["fallback"],
          timeoutMs: 1_000,
          maxAttempts: 1,
          requiredCapabilities: new Set(["structured_output"]),
        },
      ],
      safety: new SafetyGuard([{ id: "default" }]),
      auditSink,
      now: () => new Date("2026-08-04T00:00:00.000Z"),
    });
    const result = await router.invoke({
      requestId: "req-1",
      task: "proposal",
      prompt: "write",
      promptVersion: "1.0.0",
      safetyPolicyId: "default",
      outputSchema: z.object({ answer: z.string() }),
    });
    expect(result.output).toEqual({ answer: "ok" });
    expect(result.audit.attempts.map(({ providerId }) => providerId)).toEqual([
      "gemini-primary",
      "fallback",
    ]);
    expect(auditSink.records).toHaveLength(1);
  });

  it("blocks unsafe work before calling providers", async () => {
    const provider = FakeAiProvider.success("fake", { text: "{}" });
    const router = new AiTaskRouter({
      registry: new AiProviderRegistry([provider]),
      policies: [
        {
          task: "unsafe",
          primaryProvider: "fake",
          fallbackProviders: [],
          timeoutMs: 100,
          maxAttempts: 1,
          requiredCapabilities: new Set(),
        },
      ],
      safety: new SafetyGuard([{ id: "default", blockedTerms: ["blocked"] }]),
    });
    await expect(
      router.invoke({
        requestId: "req-2",
        task: "unsafe",
        prompt: "blocked",
        promptVersion: "1.0.0",
        safetyPolicyId: "default",
        outputSchema: z.object({}),
      }),
    ).rejects.toMatchObject({ category: "safety" });
  });
});
