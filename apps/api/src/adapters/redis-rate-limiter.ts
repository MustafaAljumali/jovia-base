import type { Redis } from "ioredis";

import type { ApiRateLimiter } from "../plugins/rate-limit.js";

const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

function routeKey(route: string): string {
  return route.replace(/[^A-Za-z0-9:_-]+/gu, "_").slice(0, 160);
}

export class RedisApiRateLimiter implements ApiRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly options: { limit: number; windowMs: number } = {
      limit: 120,
      windowMs: 60_000,
    },
  ) {}

  async consume(input: { actorId: string; route: string; now: Date }) {
    const window = Math.floor(input.now.getTime() / this.options.windowMs);
    const key = `jovia:api-rate:${input.actorId}:${routeKey(input.route)}:${window}`;
    const result = await this.redis.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      key,
      this.options.windowMs.toString(),
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error("Redis rate limiter returned an invalid result");
    }
    const count = Number(result[0]);
    const ttlMs = Math.max(1, Number(result[1]));
    return {
      allowed: count <= this.options.limit,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1_000)),
      remaining: Math.max(0, this.options.limit - count),
    };
  }
}
