import { describe, expect, it } from "vitest";

import type { Actor, Capability } from "./contracts.js";
import { AuthorizationPolicy } from "./policy.js";

function actorWith(...capabilities: Capability[]): Actor {
  return { id: "actor-1", capabilities: new Set(capabilities), externalSubjects: [] };
}

describe("deny-by-default authorization", () => {
  it("denies a capability that the actor does not hold", () => {
    const policy = new AuthorizationPolicy();
    expect(policy.can(actorWith("profile:read"), "source:enable")).toBe(false);
    expect(policy.can(undefined, "profile:read")).toBe(false);
    expect(() => policy.require(actorWith("profile:read"), "source:enable")).toThrow(/denied/u);
    expect(policy.can(actorWith("source:enable"), "source:enable")).toBe(true);
  });
});
