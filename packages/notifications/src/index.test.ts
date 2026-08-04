import { describe, expect, it } from "vitest";

import { NotificationCommandSchema } from "./index.js";

describe("notification contract", () => {
  it("accepts provider-neutral commands with a default variables map", () => {
    const command = NotificationCommandSchema.parse({
      channel: "in_app",
      priority: "high",
      templateId: "opportunity.discovered",
      locale: "ar",
      recipientRef: "actor-1",
      correlationId: "req-1",
    });
    expect(command.variables).toEqual({});
  });
});
