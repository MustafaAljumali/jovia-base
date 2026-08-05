import type {
  SourceEligibilityDecision,
  SourceExecutionContext,
  SourceOperation,
} from "@jovia/contracts";

export interface Clock {
  now(): Date;
}

export interface SourcePolicyRepository {
  getExecutionContext(sourceCode: string): Promise<unknown>;
}

export interface SourceEligibilityAuditRecord {
  sourceCode: string;
  operation: SourceOperation;
  correlationId: string;
  decision: SourceEligibilityDecision;
  evaluatedAt: string;
}

export interface SourceAuditPort {
  recordEligibilityDecision(record: SourceEligibilityAuditRecord): Promise<void>;
}

export interface SourceMetricsPort {
  recordEligibilityDecision(sourceCode: string, eligible: boolean, reason: string): void;
}

export interface EligibleSourceContext {
  decision: Extract<SourceEligibilityDecision, { eligible: true }>;
  context: SourceExecutionContext;
}
