export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetAfterMs: number;
  clock: { now(): Date };
}

export type CircuitState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | undefined;

  constructor(private readonly options: CircuitBreakerOptions) {
    if (options.failureThreshold < 1 || options.resetAfterMs < 1) {
      throw new Error("invalid circuit breaker configuration");
    }
  }

  state(): CircuitState {
    if (this.openedAt === undefined) return "closed";
    return this.options.clock.now().getTime() - this.openedAt >= this.options.resetAfterMs
      ? "half_open"
      : "open";
  }

  canAttempt() {
    return this.state() !== "open";
  }

  recordSuccess() {
    this.failures = 0;
    this.openedAt = undefined;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) {
      this.openedAt = this.options.clock.now().getTime();
    }
  }
}
