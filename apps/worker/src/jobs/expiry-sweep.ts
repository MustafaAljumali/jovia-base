import type { OpportunityLifecycleService } from "@jovia/opportunity-ingestion";

export class ExpirySweepJob {
  constructor(private readonly lifecycle: Pick<OpportunityLifecycleService, "expireDue">) {}

  run(limit = 500): Promise<number> {
    return this.lifecycle.expireDue(limit);
  }
}
