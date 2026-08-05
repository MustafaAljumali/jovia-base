import type { ConnectorRuntimePorts } from "@jovia/opportunity-ingestion";
import type { Redis } from "ioredis";

type SourceRateLimiterPort = ConnectorRuntimePorts["limiter"];
type Sleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export class RedisSourceRateLimiter implements SourceRateLimiterPort {
  constructor(
    private readonly redis: Redis,
    private readonly clock: { now(): number } = { now: () => Date.now() },
    private readonly sleep: Sleep = wait,
  ) {}

  async acquire(input: Parameters<ConnectorRuntimePorts["limiter"]["acquire"]>[0]): Promise<void> {
    const spacingKey = `jovia:source-spacing:${input.sourceCode}:${input.policyId}`;
    while (true) {
      const acquired = await this.redis.set(
        spacingKey,
        this.clock.now().toString(),
        "PX",
        Math.max(1, input.minimumSpacingMs),
        "NX",
      );
      if (acquired === "OK") break;
      const ttl = await this.redis.pttl(spacingKey);
      await this.sleep(Math.max(1, ttl), input.signal);
    }
    if (!input.officialRequestLimit) return;
    const window = Math.floor(
      this.clock.now() / (input.officialRequestLimit.windowSeconds * 1_000),
    );
    const key = `jovia:source-window:${input.sourceCode}:${input.policyId}:${window}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, input.officialRequestLimit.windowSeconds);
    if (count <= input.officialRequestLimit.requests) return;
    const ttl = await this.redis.ttl(key);
    await this.sleep(Math.max(1, ttl) * 1_000, input.signal);
    return this.acquire(input);
  }
}
