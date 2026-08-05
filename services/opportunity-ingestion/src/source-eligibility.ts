import {
  AppError,
  SourceExecutionContextSchema,
  type SourceEligibilityDecision,
  type SourceExecutionContext,
  type SourceIneligibilityReason,
  type SourceOperation,
} from "@jovia/contracts";

import type {
  Clock,
  EligibleSourceContext,
  SourceAuditPort,
  SourceMetricsPort,
  SourcePolicyRepository,
} from "./ports.js";

interface Evaluation {
  decision: SourceEligibilityDecision;
  context?: SourceExecutionContext;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function deny(sourceCode: string, reason: SourceIneligibilityReason): Evaluation {
  return { decision: { eligible: false, sourceCode, reason } };
}

function operationPermitted(context: SourceExecutionContext, operation: SourceOperation): boolean {
  if (context.policy.scope === "external") {
    return operation === "poll" && context.policy.mechanism !== "manual_submission";
  }
  return (
    context.policy.mechanism === "manual_submission" &&
    (operation === "publish" || operation === "replace" || operation === "remove")
  );
}

export function evaluateSourceExecution(
  rawContext: unknown,
  requestedSourceCode: string,
  operation: SourceOperation,
  now: Date,
): Evaluation {
  if (rawContext === undefined || rawContext === null)
    return deny(requestedSourceCode, "source_missing");

  const raw = record(rawContext);
  const source = record(raw?.source);
  const policy = record(raw?.policy);
  const circuit = record(raw?.circuit);
  if (!raw || !source || !policy || !circuit) return deny(requestedSourceCode, "policy_incomplete");

  if (source.enabled === false) return deny(requestedSourceCode, "disabled");
  if (policy.mechanism === "unsupported") return deny(requestedSourceCode, "unsupported");
  if (policy.legalPosture !== "approved") return deny(requestedSourceCode, "not_approved");
  if (
    typeof policy.approvedBy !== "string" ||
    policy.approvedBy.trim().length === 0 ||
    typeof policy.approvedAt !== "string" ||
    policy.approvedAt.length === 0
  ) {
    return deny(requestedSourceCode, "approval_missing");
  }

  const parsed = SourceExecutionContextSchema.safeParse(rawContext);
  if (!parsed.success || source.activePolicyId === null) {
    return deny(requestedSourceCode, "policy_incomplete");
  }
  const context = parsed.data;

  if (
    context.source.code !== requestedSourceCode ||
    context.policy.sourceCode !== requestedSourceCode ||
    context.source.activePolicyId !== context.policy.id ||
    context.source.scope !== context.policy.scope
  ) {
    return deny(requestedSourceCode, "source_policy_mismatch");
  }

  const verifiedAt = new Date(context.policy.verifiedAt);
  const approvedAt = new Date(context.policy.approvedAt);
  const validUntil = new Date(context.policy.validUntil);
  if (verifiedAt > now || approvedAt > now)
    return deny(requestedSourceCode, "verification_in_future");
  if (validUntil < now) return deny(requestedSourceCode, "policy_expired");
  if (!operationPermitted(context, operation))
    return deny(requestedSourceCode, "mechanism_not_permitted");
  if (context.source.runtimeStatus === "quarantined" || context.source.quarantinedAt !== null) {
    return deny(requestedSourceCode, "quarantined");
  }
  if (context.circuit.state === "open") return deny(requestedSourceCode, "circuit_open");
  if (
    operation === "poll" &&
    context.source.nextPollAt !== null &&
    new Date(context.source.nextPollAt) > now
  ) {
    return deny(requestedSourceCode, "poll_not_due");
  }

  return {
    decision: {
      eligible: true,
      sourceCode: requestedSourceCode,
      policyId: context.policy.id,
    },
    context,
  };
}

export class SourceEligibilityService {
  constructor(
    private readonly policies: SourcePolicyRepository,
    private readonly audit: SourceAuditPort,
    private readonly metrics: SourceMetricsPort,
    private readonly clock: Clock,
  ) {}

  private async evaluateWithContext(
    sourceCode: string,
    operation: SourceOperation,
    correlationId: string,
  ): Promise<Evaluation> {
    const now = this.clock.now();
    const rawContext = await this.policies.getExecutionContext(sourceCode);
    const evaluation = evaluateSourceExecution(rawContext, sourceCode, operation, now);
    await this.audit.recordEligibilityDecision({
      sourceCode,
      operation,
      correlationId,
      decision: evaluation.decision,
      evaluatedAt: now.toISOString(),
    });
    this.metrics.recordEligibilityDecision(
      sourceCode,
      evaluation.decision.eligible,
      evaluation.decision.eligible ? "eligible" : evaluation.decision.reason,
    );
    return evaluation;
  }

  async evaluate(
    sourceCode: string,
    operation: SourceOperation,
    correlationId: string,
  ): Promise<SourceEligibilityDecision> {
    return (await this.evaluateWithContext(sourceCode, operation, correlationId)).decision;
  }

  async require(
    sourceCode: string,
    operation: SourceOperation,
    correlationId: string,
  ): Promise<EligibleSourceContext> {
    const evaluation = await this.evaluateWithContext(sourceCode, operation, correlationId);
    if (!evaluation.decision.eligible || !evaluation.context) {
      throw new AppError({
        code: "source_not_eligible",
        status: 422,
        title: "Source is not eligible for this operation",
        details: {
          sourceCode,
          reason: evaluation.decision.eligible ? "policy_incomplete" : evaluation.decision.reason,
        },
      });
    }
    return { decision: evaluation.decision, context: evaluation.context };
  }
}
