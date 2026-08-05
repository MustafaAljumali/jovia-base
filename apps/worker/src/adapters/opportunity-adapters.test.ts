import type { OpportunityEvent } from "@jovia/contracts";
import type { Redis } from "ioredis";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BullMqOpportunityEventPublisher } from "./event-publisher.js";
import {
  BoundedConnectorMetrics,
  LoggerOperationalMetricSink,
  WorkerOutboxMetrics,
  WorkerSourceEligibilityMetrics,
} from "./metrics.js";
import { RedisSourceRateLimiter } from "./rate-limiter.js";
import { createIntervalWorkerHandle } from "./scheduler.js";

afterEach(() => vi.useRealTimers());

describe("opportunity worker adapters", () => {
  it("publishes versioned events with an idempotent BullMQ job id", async () => {
    const queue = { add: vi.fn(async () => undefined) };
    const event: OpportunityEvent = {
      eventId: "00000000-0000-4000-8000-000000000001",
      eventKey: "opportunity:1:updated",
      type: "opportunity.updated.v1",
      occurredAt: "2026-08-05T00:00:00.000Z",
      correlationId: "event-test",
      opportunityId: "00000000-0000-4000-8000-000000000002",
      lifecycle: "active",
    };
    await new BullMqOpportunityEventPublisher(queue).publish(event);
    expect(queue.add).toHaveBeenCalledWith(event.type, event, {
      jobId: event.eventId,
      removeOnComplete: true,
    });
  });

  it("enforces source spacing and the official source window in Redis", async () => {
    const redis = {
      set: vi.fn(async () => "OK"),
      incr: vi.fn(async () => 1),
      expire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 1),
      ttl: vi.fn(async () => 1),
    } as unknown as Redis;
    const limiter = new RedisSourceRateLimiter(redis);
    await limiter.acquire({
      sourceCode: "himalayas",
      policyId: "00000000-0000-4000-8000-000000000001",
      minimumSpacingMs: 1_000,
      officialRequestLimit: { requests: 10, windowSeconds: 60 },
      signal: new AbortController().signal,
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining("himalayas"),
      expect.any(String),
      "PX",
      1_000,
      "NX",
    );
    expect(redis.expire).toHaveBeenCalledOnce();
    await limiter.acquire({
      sourceCode: "jovia-direct",
      policyId: "00000000-0000-4000-8000-000000000002",
      minimumSpacingMs: 0,
      officialRequestLimit: null,
      signal: new AbortController().signal,
    });
  });

  it("retries spacing and official-window exhaustion through an injectable cancellable wait", async () => {
    const redis = {
      set: vi.fn().mockResolvedValueOnce(null).mockResolvedValue("OK"),
      incr: vi.fn().mockResolvedValueOnce(11).mockResolvedValueOnce(1),
      expire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 25),
      ttl: vi.fn(async () => 2),
    } as unknown as Redis;
    const sleep = vi.fn(async () => undefined);
    const limiter = new RedisSourceRateLimiter(
      redis,
      { now: () => Date.parse("2026-08-05T00:00:00.000Z") },
      sleep,
    );

    await limiter.acquire({
      sourceCode: "himalayas",
      policyId: "00000000-0000-4000-8000-000000000001",
      minimumSpacingMs: 100,
      officialRequestLimit: { requests: 10, windowSeconds: 60 },
      signal: new AbortController().signal,
    });

    expect(sleep).toHaveBeenNthCalledWith(1, 25, expect.any(AbortSignal));
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000, expect.any(AbortSignal));
    expect(redis.expire).toHaveBeenCalledOnce();
  });

  it("cancels a pending spacing wait when the worker shuts down", async () => {
    const redis = {
      set: vi.fn(async () => null),
      pttl: vi.fn(async () => 60_000),
    } as unknown as Redis;
    const controller = new AbortController();
    const pending = new RedisSourceRateLimiter(redis).acquire({
      sourceCode: "himalayas",
      policyId: "00000000-0000-4000-8000-000000000001",
      minimumSpacingMs: 100,
      officialRequestLimit: null,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(redis.pttl).toHaveBeenCalledOnce());
    controller.abort(new Error("worker stopped"));
    await expect(pending).rejects.toThrow("worker stopped");
  });

  it("fails immediately for a pre-aborted wait and accepts capacity already used in a window", async () => {
    const redis = {
      set: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("OK"),
      pttl: vi.fn(async () => 1),
      incr: vi.fn(async () => 2),
      expire: vi.fn(async () => 1),
    } as unknown as Redis;
    const aborted = new AbortController();
    aborted.abort(new Error("already stopped"));
    await expect(
      new RedisSourceRateLimiter(redis).acquire({
        sourceCode: "himalayas",
        policyId: "00000000-0000-4000-8000-000000000001",
        minimumSpacingMs: 100,
        officialRequestLimit: null,
        signal: aborted.signal,
      }),
    ).rejects.toThrow("already stopped");

    await new RedisSourceRateLimiter(redis).acquire({
      sourceCode: "himalayas",
      policyId: "00000000-0000-4000-8000-000000000001",
      minimumSpacingMs: 100,
      officialRequestLimit: { requests: 10, windowSeconds: 60 },
      signal: new AbortController().signal,
    });
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it("rejects unbounded labels and records approved operational labels", () => {
    const logger = { info: vi.fn() };
    const sink = new LoggerOperationalMetricSink(logger);
    const connector = new BoundedConnectorMetrics(sink);
    connector.increment("jovia_connector_page_total", { source: "himalayas" });
    connector.observe("jovia_connector_latency_ms", 5, { source: "jovia-direct" });
    expect(() => connector.increment("jovia_connector_page_total", { source: "dynamic" })).toThrow(
      "unbounded source",
    );
    const eligibility = new WorkerSourceEligibilityMetrics(sink);
    eligibility.recordEligibilityDecision("himalayas", false, "disabled");
    expect(() => eligibility.recordEligibilityDecision("dynamic", true, "eligible")).toThrow(
      "unbounded source",
    );
    const outbox = new WorkerOutboxMetrics(sink);
    outbox.record("opportunity.discovered.v1", "published");
    expect(() => outbox.record("dynamic.event", "retry")).toThrow("unbounded outbox");
    expect(logger.info).toHaveBeenCalled();
  });

  it("starts, ticks and stops an interval worker without leaving a timer", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const onError = vi.fn();
    const handle = createIntervalWorkerHandle({
      name: "interval-test",
      intervalMs: 1_000,
      run,
      onError,
    });
    await handle.start();
    await vi.advanceTimersByTimeAsync(1_000);
    await handle.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports interval failures and makes start and stop idempotent", async () => {
    vi.useFakeTimers();
    const failure = new Error("sweep failed");
    const run = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(failure);
    const onError = vi.fn();
    const handle = createIntervalWorkerHandle({
      name: "interval-failure-test",
      intervalMs: 1_000,
      run,
      onError,
    });
    await handle.start();
    await handle.start();
    await vi.advanceTimersByTimeAsync(1_000);
    await handle.stop();
    await handle.stop();
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
