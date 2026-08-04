import { describe, expect, it, vi } from "vitest";

import { correlationIdFromJob, createBullMqWorkerHandle } from "./bullmq.js";

describe("BullMQ adapter", () => {
  it("starts and closes an injected queue worker without logging payloads", async () => {
    const queueWorker = { run: vi.fn(async () => undefined), close: vi.fn(async () => undefined) };
    const logger = { info: vi.fn(), error: vi.fn() };
    const handle = createBullMqWorkerHandle({
      queueName: "opportunity-ingestion",
      connection: { host: "127.0.0.1", port: 6379 },
      concurrency: 2,
      processor: vi.fn(async () => ({ ok: true })),
      logger,
      workerFactory: () => queueWorker,
    });
    await handle.start();
    await handle.start();
    await handle.stop();
    expect(queueWorker.run).toHaveBeenCalledOnce();
    expect(queueWorker.close).toHaveBeenCalledOnce();
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("payload");
  });

  it("extracts only valid correlation identifiers", () => {
    expect(correlationIdFromJob({ data: { correlationId: "req-1" } })).toBe("req-1");
    expect(correlationIdFromJob({ data: { correlationId: 1 } })).toBeUndefined();
    expect(correlationIdFromJob({ data: null })).toBeUndefined();
  });
});
