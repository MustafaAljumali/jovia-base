import { describe, expect, it, vi } from "vitest";

import { ConnectorFetchError, executeWithRetry } from "./retry.js";

describe("connector retry policy", () => {
  it("honors Retry-After and succeeds on the third retryable attempt", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new ConnectorFetchError("http", "rate limited", { status: 429, retryAfterSeconds: 60 }),
      )
      .mockRejectedValueOnce(new ConnectorFetchError("network", "connection reset"))
      .mockResolvedValue("ok");
    const sleep = vi.fn(async () => undefined);

    await expect(
      executeWithRetry(operation, {
        maximumAttempts: 3,
        sleep,
        backoffMs: (attempt) => attempt * 100,
      }),
    ).resolves.toBe("ok");
    expect(sleep.mock.calls).toEqual([[60_000], [200]]);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404, 422])("does not retry HTTP %s", async (status) => {
    const operation = vi.fn(async () => {
      throw new ConnectorFetchError("http", "contract error", { status });
    });
    await expect(
      executeWithRetry(operation, {
        maximumAttempts: 3,
        sleep: async () => undefined,
        backoffMs: () => 1,
      }),
    ).rejects.toMatchObject({ status });
    expect(operation).toHaveBeenCalledOnce();
  });

  it("propagates cancellation without retry", async () => {
    const operation = vi.fn(async () => {
      throw new ConnectorFetchError("aborted", "cancelled");
    });
    await expect(
      executeWithRetry(operation, {
        maximumAttempts: 3,
        sleep: async () => undefined,
        backoffMs: () => 1,
      }),
    ).rejects.toMatchObject({ kind: "aborted" });
    expect(operation).toHaveBeenCalledOnce();
  });
});
