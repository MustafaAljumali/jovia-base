import { describe, expect, it, vi } from "vitest";

import { createWorkerRuntime, type WorkerHandle } from "./runtime.js";

function fakeWorker(
  name: string,
): WorkerHandle & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } {
  return { name, start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
}

describe("worker lifecycle", () => {
  it("starts and stops every registered worker exactly once", async () => {
    const ingestion = fakeWorker("ingestion");
    const notifications = fakeWorker("notifications");
    const lifecycle = createWorkerRuntime([ingestion, notifications]);
    await lifecycle.start();
    await lifecycle.start();
    await lifecycle.stop();
    await lifecycle.stop();
    expect(ingestion.start).toHaveBeenCalledOnce();
    expect(ingestion.stop).toHaveBeenCalledOnce();
    expect(notifications.start).toHaveBeenCalledOnce();
    expect(notifications.stop).toHaveBeenCalledOnce();
    expect(lifecycle.snapshot()).toEqual({
      state: "stopped",
      workers: ["ingestion", "notifications"],
    });
  });

  it("rejects duplicate worker names", () => {
    expect(() => createWorkerRuntime([fakeWorker("same"), fakeWorker("same")])).toThrow(/unique/u);
  });

  it("rolls back already-started workers after a startup failure", async () => {
    const first = fakeWorker("first");
    const failing = fakeWorker("failing");
    failing.start.mockRejectedValueOnce(new Error("startup failed"));
    const lifecycle = createWorkerRuntime([first, failing]);
    await expect(lifecycle.start()).rejects.toThrow(/startup failed/u);
    expect(first.stop).toHaveBeenCalledOnce();
    expect(lifecycle.snapshot().state).toBe("stopped");
    await expect(lifecycle.start()).rejects.toThrow(/cannot start/u);
  });
});
