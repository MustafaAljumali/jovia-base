import { describe, expect, it } from "vitest";

import { FakeClock, sequenceId } from "./index.js";

describe("deterministic test utilities", () => {
  it("advances time and generates stable ids", () => {
    const clock = new FakeClock();
    clock.advance(1_000);
    expect(clock.now().toISOString()).toBe("2026-08-04T00:00:01.000Z");
    const nextId = sequenceId("request");
    expect([nextId(), nextId()]).toEqual(["request-1", "request-2"]);
  });

  it("rejects invalid time travel", () => {
    expect(() => new FakeClock().advance(-1)).toThrow(/invalid advance/u);
  });
});
