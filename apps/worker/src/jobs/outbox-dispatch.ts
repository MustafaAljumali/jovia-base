import type { OutboxDispatcher } from "@jovia/opportunity-ingestion";

export class OutboxDispatchJob {
  constructor(private readonly dispatcher: Pick<OutboxDispatcher, "dispatchBatch">) {}

  run(limit = 100) {
    return this.dispatcher.dispatchBatch(limit);
  }
}
