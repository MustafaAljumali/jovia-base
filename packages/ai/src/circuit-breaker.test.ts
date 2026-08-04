import { describe, expect, it } from "vitest";

import { CircuitBreaker } from "./circuit-breaker.js";

describe("circuit breaker", () => {
  it("opens after failures and allows a half-open probe after reset", () => {
    let current = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetAfterMs: 30_000,
      clock: { now: () => new Date(current) },
    });
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.state()).toBe("open");
    expect(breaker.canAttempt()).toBe(false);
    current = 30_000;
    expect(breaker.state()).toBe("half_open");
    breaker.recordSuccess();
    expect(breaker.state()).toBe("closed");
  });

  it("rejects unsafe thresholds", () => {
    expect(
      () =>
        new CircuitBreaker({
          failureThreshold: 0,
          resetAfterMs: 1,
          clock: { now: () => new Date() },
        }),
    ).toThrow(/invalid/u);
  });
});
