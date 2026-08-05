import type { OpportunityEvent } from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  OutboxDispatcher,
  type ClaimedOutboxEvent,
  type OutboxDispatchPort,
} from "./dispatcher.js";

const event: OpportunityEvent = {
  eventId: "00000000-0000-4000-8000-000000000001",
  eventKey: "opportunity:1:discovered",
  type: "opportunity.discovered.v1",
  occurredAt: "2026-08-05T00:00:00.000Z",
  correlationId: "outbox-test",
  opportunityId: "00000000-0000-4000-8000-000000000002",
  lifecycle: "active",
};

function harness(failOnce = false) {
  let pending: ClaimedOutboxEvent[] = [
    {
      id: event.eventId,
      claimToken: "00000000-0000-4000-8000-000000000099",
      attemptNumber: 1,
      event,
    },
  ];
  const repository: OutboxDispatchPort = {
    claim: vi.fn(async () => pending),
    markPublished: vi.fn(async () => {
      pending = [];
    }),
    scheduleRetry: vi.fn(async ({ attemptNumber }) => {
      pending = [
        {
          id: event.eventId,
          claimToken: "00000000-0000-4000-8000-000000000098",
          attemptNumber: attemptNumber + 1,
          event,
        },
      ];
    }),
    deadLetter: vi.fn(async () => {
      pending = [];
    }),
  };
  let calls = 0;
  const publisher = {
    publish: vi.fn(async () => {
      calls += 1;
      if (failOnce && calls === 1) throw new Error("broker unavailable");
    }),
  };
  const metrics = { record: vi.fn() };
  return {
    repository,
    publisher,
    dispatcher: new OutboxDispatcher(
      repository,
      publisher,
      metrics,
      { now: () => new Date("2026-08-05T00:00:00.000Z") },
      { maxAttempts: 3, retryDelayMs: () => 1 },
    ),
  };
}

describe("OutboxDispatcher", () => {
  it("does not mark a failed publication and succeeds on a later retry", async () => {
    const { dispatcher, repository, publisher } = harness(true);
    await expect(dispatcher.dispatchBatch(10)).resolves.toEqual({ claimed: 1, published: 0 });
    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(repository.scheduleRetry).toHaveBeenCalledOnce();
    await expect(dispatcher.dispatchBatch(10)).resolves.toEqual({ claimed: 1, published: 1 });
    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(repository.markPublished).toHaveBeenCalledOnce();
  });

  it("dead-letters only at the configured attempt ceiling", async () => {
    const { dispatcher, repository, publisher } = harness();
    vi.mocked(publisher.publish).mockRejectedValue(new TypeError("invalid event endpoint"));
    vi.mocked(repository.claim).mockResolvedValue([
      {
        id: event.eventId,
        claimToken: "00000000-0000-4000-8000-000000000097",
        attemptNumber: 3,
        event,
      },
    ]);
    await dispatcher.dispatchBatch();
    expect(repository.deadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 3, errorCategory: "TypeError" }),
    );
  });
});
