import { AppError } from "@jovia/contracts";
import type { Actor, Capability } from "@jovia/auth";

export function requireCapability(actor: Actor | null, capability: Capability): Actor {
  if (!actor?.capabilities.has(capability)) {
    throw new AppError({
      code: "capability_denied",
      status: 403,
      title: "The required capability was not granted",
    });
  }
  return actor;
}
