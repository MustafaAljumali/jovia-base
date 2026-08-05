export interface PersistentCircuitState {
  state: "closed" | "open" | "half_open";
  consecutiveFailures: number;
  openedAt: string | null;
  halfOpenAfter: string | null;
}

export type CircuitEvent =
  | { type: "retryable_failure"; at: Date }
  | { type: "schema_failure"; at: Date }
  | { type: "probe_due"; at: Date }
  | { type: "success"; at: Date };

const failureThreshold = 5;
const cooldownMilliseconds = 5 * 60 * 1_000;

export function nextCircuitState(
  current: PersistentCircuitState,
  event: CircuitEvent,
): PersistentCircuitState {
  if (event.type === "success") {
    return { state: "closed", consecutiveFailures: 0, openedAt: null, halfOpenAfter: null };
  }
  if (event.type === "probe_due") {
    if (
      current.state !== "open" ||
      current.halfOpenAfter === null ||
      event.at < new Date(current.halfOpenAfter)
    ) {
      return current;
    }
    return { ...current, state: "half_open" };
  }
  const consecutiveFailures =
    event.type === "schema_failure" ? failureThreshold : current.consecutiveFailures + 1;
  if (consecutiveFailures < failureThreshold) {
    return { ...current, consecutiveFailures };
  }
  return {
    state: "open",
    consecutiveFailures,
    openedAt: event.at.toISOString(),
    halfOpenAfter: new Date(event.at.getTime() + cooldownMilliseconds).toISOString(),
  };
}
