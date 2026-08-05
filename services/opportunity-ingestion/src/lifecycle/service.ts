export type TombstoneReason = "source_removed" | "publisher_deleted" | "source_expired";

export interface OpportunityLifecyclePort {
  tombstoneOccurrence(input: {
    provenanceId: string;
    reason: TombstoneReason;
    correlationId: string;
    occurredAt: Date;
  }): Promise<{ canonicalOpportunityId: string; canonicalRemainsActive: boolean }>;
  expireDue(input: { limit: number; occurredAt: Date }): Promise<number>;
  reconcileCompletedRun(input: {
    runId: string;
    sourceCode: string;
    correlationId: string;
    occurredAt: Date;
  }): Promise<number>;
  purgeDue(input: { limit: number; occurredAt: Date }): Promise<number>;
}

export class OpportunityLifecycleService {
  constructor(
    private readonly lifecycle: OpportunityLifecyclePort,
    private readonly clock: { now(): Date },
  ) {}

  tombstoneOccurrence(provenanceId: string, reason: TombstoneReason, correlationId: string) {
    return this.lifecycle.tombstoneOccurrence({
      provenanceId,
      reason,
      correlationId,
      occurredAt: this.clock.now(),
    });
  }

  expireDue(limit = 500): Promise<number> {
    return this.lifecycle.expireDue({ limit, occurredAt: this.clock.now() });
  }

  reconcileCompletedRun(runId: string, sourceCode: string, correlationId: string): Promise<number> {
    return this.lifecycle.reconcileCompletedRun({
      runId,
      sourceCode,
      correlationId,
      occurredAt: this.clock.now(),
    });
  }

  purgeDue(limit = 100): Promise<number> {
    return this.lifecycle.purgeDue({ limit, occurredAt: this.clock.now() });
  }
}
