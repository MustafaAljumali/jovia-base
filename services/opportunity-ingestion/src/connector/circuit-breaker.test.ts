import { describe, expect, it } from "vitest";

import { nextCircuitState, type PersistentCircuitState } from "./circuit-breaker.js";

const closed: PersistentCircuitState = {
  state: "closed",
  consecutiveFailures: 0,
  openedAt: null,
  halfOpenAfter: null,
};

describe("persistent connector circuit transitions", () => {
  it("opens after five retryable page failures", () => {
    let state = closed;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      state = nextCircuitState(state, {
        type: "retryable_failure",
        at: new Date("2026-08-05T00:00:00.000Z"),
      });
    }
    expect(state).toEqual({
      state: "open",
      consecutiveFailures: 5,
      openedAt: "2026-08-05T00:00:00.000Z",
      halfOpenAfter: "2026-08-05T00:05:00.000Z",
    });
  });

  it("permits one half-open state after cooldown and closes on success", () => {
    const open: PersistentCircuitState = {
      state: "open",
      consecutiveFailures: 5,
      openedAt: "2026-08-05T00:00:00.000Z",
      halfOpenAfter: "2026-08-05T00:05:00.000Z",
    };
    const halfOpen = nextCircuitState(open, {
      type: "probe_due",
      at: new Date("2026-08-05T00:05:00.000Z"),
    });
    expect(halfOpen.state).toBe("half_open");
    expect(
      nextCircuitState(halfOpen, { type: "success", at: new Date("2026-08-05T00:05:01.000Z") }),
    ).toEqual(closed);
  });

  it("opens immediately on a schema failure", () => {
    expect(
      nextCircuitState(closed, {
        type: "schema_failure",
        at: new Date("2026-08-05T00:00:00.000Z"),
      }),
    ).toMatchObject({ state: "open", consecutiveFailures: 5 });
  });
});
