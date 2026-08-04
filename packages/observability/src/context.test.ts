import { describe, expect, it } from "vitest";

import { enterCorrelationId, getCorrelationId, runWithCorrelationId } from "./context.js";

describe("correlation context", () => {
  it("preserves an id across asynchronous work and isolates calls", async () => {
    await runWithCorrelationId("req-1", async () => {
      await Promise.resolve();
      expect(getCorrelationId()).toBe("req-1");
    });
    expect(getCorrelationId()).toBeUndefined();
  });

  it("rejects an empty identifier", () => {
    expect(() => runWithCorrelationId(" ", () => undefined)).toThrow(/correlationId/u);
    expect(() => enterCorrelationId("")).toThrow(/correlationId/u);
  });
});
