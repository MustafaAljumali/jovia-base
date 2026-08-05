import type { OpportunityEvent } from "@jovia/contracts";
import type { OpportunityEventPublisher } from "@jovia/opportunity-ingestion";

export interface OpportunityEventQueue {
  add(
    name: OpportunityEvent["type"],
    data: OpportunityEvent,
    options: { jobId: string; removeOnComplete: boolean },
  ): Promise<unknown>;
}

export class BullMqOpportunityEventPublisher implements OpportunityEventPublisher {
  constructor(private readonly queue: OpportunityEventQueue) {}

  async publish(event: OpportunityEvent): Promise<void> {
    await this.queue.add(event.type, event, {
      jobId: event.eventId,
      removeOnComplete: true,
    });
  }
}
