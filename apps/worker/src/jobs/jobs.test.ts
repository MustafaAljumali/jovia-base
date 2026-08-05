import type { RawPayloadReference } from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import { OpportunityOperationalMetricsJob } from "../adapters/metrics.js";
import { SourcePollScheduler } from "../adapters/scheduler.js";
import { ExpirySweepJob } from "./expiry-sweep.js";
import { OutboxDispatchJob } from "./outbox-dispatch.js";
import { RetentionSweepJob } from "./retention-sweep.js";
import { SourcePollJob } from "./source-poll.js";

describe("opportunity operational jobs", () => {
  it("schedules sources only from policy due time and version", async () => {
    const now = new Date("2026-08-05T01:00:00.000Z");
    const queue = { add: vi.fn(async () => undefined) };
    const scheduler = new SourcePollScheduler(
      {
        listDueSources: vi.fn(async () => [
          {
            sourceCode: "himalayas",
            policyVersion: 1,
            nextPollAt: new Date("2026-08-05T01:00:05.000Z"),
          },
        ]),
      },
      queue,
      { now: () => now },
    );
    await expect(scheduler.tick()).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      "poll-source",
      { sourceCode: "himalayas", correlationId: expect.any(String) },
      {
        jobId: `poll-himalayas-v1-${new Date("2026-08-05T01:00:05.000Z").getTime()}`,
        delay: 5_000,
        removeOnComplete: true,
      },
    );
  });

  it("delegates polling, outbox and expiry with bounded batch sizes", async () => {
    const runner = {
      run: vi.fn(async () => ({
        outcome: "completed" as const,
        committedPages: 1,
        committedRecords: 1,
      })),
    };
    const poll = new SourcePollJob(runner);
    await poll.run({ sourceCode: "himalayas", correlationId: "poll-test" });
    expect(runner.run).toHaveBeenCalledWith("himalayas", "poll-test", expect.any(AbortSignal));

    const dispatcher = { dispatchBatch: vi.fn(async () => ({ claimed: 1, published: 1 })) };
    await new OutboxDispatchJob(dispatcher).run(25);
    expect(dispatcher.dispatchBatch).toHaveBeenCalledWith(25);

    const lifecycle = { expireDue: vi.fn(async () => 2) };
    await expect(new ExpirySweepJob(lifecycle).run(50)).resolves.toBe(2);
  });

  it("deletes raw objects before marking records and purging opportunities", async () => {
    const calls: string[] = [];
    const reference: RawPayloadReference & { id: string } = {
      id: "00000000-0000-4000-8000-000000000001",
      provider: "s3-compatible",
      bucket: "raw",
      objectKey: "himalayas/raw.json",
      sha256: "a".repeat(64),
      byteLength: 10,
      storedAt: "2026-08-05T00:00:00.000Z",
    };
    const job = new RetentionSweepJob(
      {
        listRawPayloadsDue: vi.fn(async () => [reference]),
        markRawPayloadPurged: vi.fn(async () => {
          calls.push("mark");
        }),
      },
      {
        put: vi.fn(async () => reference),
        delete: vi.fn(async () => {
          calls.push("delete");
        }),
      },
      {
        purgeDue: vi.fn(async () => {
          calls.push("purge");
          return 1;
        }),
      },
      { now: () => new Date("2026-08-05T01:00:00.000Z") },
    );
    await expect(job.run()).resolves.toEqual({ rawPurged: 1, opportunitiesPurged: 1 });
    expect(calls).toEqual(["delete", "mark", "purge"]);
  });

  it("reports only bounded freshness, circuit, quarantine, tombstone and outbox labels", async () => {
    const sink = { gauge: vi.fn() };
    const job = new OpportunityOperationalMetricsJob(
      {
        operationalMetrics: vi.fn(async () => ({
          sources: [
            {
              sourceCode: "himalayas",
              freshnessLagSeconds: 120,
              tombstoneLagSeconds: 5,
              quarantineCount: 1,
              circuitState: "closed" as const,
            },
            {
              sourceCode: "unapproved-dynamic-source",
              freshnessLagSeconds: 1,
              tombstoneLagSeconds: 0,
              quarantineCount: 0,
              circuitState: "closed" as const,
            },
          ],
          pendingOutbox: [
            { eventType: "opportunity.discovered.v1", count: 3 },
            { eventType: "unbounded.event", count: 99 },
          ],
        })),
      },
      sink,
      { now: () => new Date("2026-08-05T01:00:00.000Z") },
    );
    await job.run();
    expect(sink.gauge).toHaveBeenCalledWith("jovia_source_freshness_lag_seconds", 120, {
      source: "himalayas",
    });
    expect(sink.gauge).toHaveBeenCalledWith("jovia_outbox_pending", 3, {
      event_type: "opportunity.discovered.v1",
    });
    expect(sink.gauge).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ source: "unapproved-dynamic-source" }),
    );
  });
});
