import type { OpportunityEvent } from "@jovia/contracts";

export interface ClaimedOutboxEvent {
  id: string;
  claimToken: string;
  attemptNumber: number;
  event: OpportunityEvent;
}

export interface OutboxDispatchPort {
  claim(limit: number, claimedAt: Date): Promise<readonly ClaimedOutboxEvent[]>;
  markPublished(
    id: string,
    claimToken: string,
    attemptNumber: number,
    publishedAt: Date,
  ): Promise<void>;
  scheduleRetry(input: {
    id: string;
    claimToken: string;
    attemptNumber: number;
    availableAt: Date;
    errorCategory: string;
    attemptedAt: Date;
  }): Promise<void>;
  deadLetter(input: {
    id: string;
    claimToken: string;
    attemptNumber: number;
    errorCategory: string;
    attemptedAt: Date;
  }): Promise<void>;
}

export interface OpportunityEventPublisher {
  publish(event: OpportunityEvent): Promise<void>;
}

export interface OutboxDispatchMetrics {
  record(
    eventType: OpportunityEvent["type"],
    outcome: "published" | "retry" | "dead_lettered",
  ): void;
}

function safeErrorCategory(error: unknown): string {
  if (error instanceof Error && error.name) return error.name.slice(0, 80);
  return "unknown_error";
}

export class OutboxDispatcher {
  constructor(
    private readonly repository: OutboxDispatchPort,
    private readonly publisher: OpportunityEventPublisher,
    private readonly metrics: OutboxDispatchMetrics,
    private readonly clock: { now(): Date },
    private readonly options: {
      maxAttempts: number;
      retryDelayMs(attemptNumber: number): number;
    } = {
      maxAttempts: 8,
      retryDelayMs: (attempt) => Math.min(60_000 * 2 ** (attempt - 1), 3_600_000),
    },
  ) {}

  async dispatchBatch(limit = 100): Promise<{ claimed: number; published: number }> {
    const claimed = await this.repository.claim(limit, this.clock.now());
    let published = 0;
    for (const item of claimed) {
      try {
        await this.publisher.publish(item.event);
        await this.repository.markPublished(
          item.id,
          item.claimToken,
          item.attemptNumber,
          this.clock.now(),
        );
        this.metrics.record(item.event.type, "published");
        published += 1;
      } catch (error) {
        const attemptedAt = this.clock.now();
        const errorCategory = safeErrorCategory(error);
        if (item.attemptNumber >= this.options.maxAttempts) {
          await this.repository.deadLetter({
            id: item.id,
            claimToken: item.claimToken,
            attemptNumber: item.attemptNumber,
            errorCategory,
            attemptedAt,
          });
          this.metrics.record(item.event.type, "dead_lettered");
        } else {
          await this.repository.scheduleRetry({
            id: item.id,
            claimToken: item.claimToken,
            attemptNumber: item.attemptNumber,
            availableAt: new Date(
              attemptedAt.getTime() + this.options.retryDelayMs(item.attemptNumber),
            ),
            errorCategory,
            attemptedAt,
          });
          this.metrics.record(item.event.type, "retry");
        }
      }
    }
    return { claimed: claimed.length, published };
  }
}
