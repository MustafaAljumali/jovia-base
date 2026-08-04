import { describe, expect, it } from "vitest";

import { redactSensitive, serializeSafeError } from "./redaction.js";

describe("sensitive value redaction", () => {
  it("redacts nested secret fields without changing safe values", () => {
    expect(redactSensitive({ apiKey: "secret", nested: { requestId: "req-1" } })).toEqual({
      apiKey: "[REDACTED]",
      nested: { requestId: "req-1" },
    });
  });

  it("handles arrays and circular values", () => {
    const value: Record<string, unknown> = { items: [{ token: "secret" }] };
    value.self = value;
    expect(redactSensitive(value)).toEqual({
      items: [{ token: "[REDACTED]" }],
      self: "[CIRCULAR]",
    });
  });

  it("normalizes error-like values", () => {
    expect(serializeSafeError("failure")).toEqual({ name: "Error", message: "Unknown error" });
    expect(serializeSafeError(new TypeError("failure"))).toMatchObject({
      name: "TypeError",
      message: "failure",
    });
  });
});
