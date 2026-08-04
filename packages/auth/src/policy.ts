import type { Actor, Capability } from "./contracts.js";

export class AuthorizationPolicy {
  can(actor: Actor | undefined, capability: Capability): boolean {
    return Boolean(actor?.capabilities.has(capability));
  }

  require(actor: Actor | undefined, capability: Capability): asserts actor is Actor {
    if (!this.can(actor, capability)) throw new Error(`capability denied: ${capability}`);
  }
}
