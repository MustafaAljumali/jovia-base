import type { RawPayloadReference } from "@jovia/contracts";
import type { OpportunityLifecycleService, RawPayloadStore } from "@jovia/opportunity-ingestion";

export interface RawRetentionRepository {
  listRawPayloadsDue(
    now: Date,
    limit?: number,
  ): Promise<readonly (RawPayloadReference & { id: string })[]>;
  markRawPayloadPurged(id: string, purgedAt: Date): Promise<void>;
}

export class RetentionSweepJob {
  constructor(
    private readonly repository: RawRetentionRepository,
    private readonly rawPayloads: RawPayloadStore,
    private readonly lifecycle: Pick<OpportunityLifecycleService, "purgeDue">,
    private readonly clock: { now(): Date },
  ) {}

  async run(limit = 100): Promise<{ rawPurged: number; opportunitiesPurged: number }> {
    const now = this.clock.now();
    const due = await this.repository.listRawPayloadsDue(now, limit);
    let rawPurged = 0;
    for (const { id, ...reference } of due) {
      await this.rawPayloads.delete(reference);
      await this.repository.markRawPayloadPurged(id, this.clock.now());
      rawPurged += 1;
    }
    const opportunitiesPurged = await this.lifecycle.purgeDue(limit);
    return { rawPurged, opportunitiesPurged };
  }
}
