import type { Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { LoggerApiMetrics, LoggerSourceEligibilityMetrics } from "./metrics.js";
import { RedisApiRateLimiter } from "./redis-rate-limiter.js";

describe("API production adapters", () => {
  it("uses an atomic actor-and-route Redis window", async () => {
    const redis = { eval: vi.fn(async () => [1, 60_000]) } as unknown as Redis;
    const limiter = new RedisApiRateLimiter(redis, { limit: 2, windowMs: 60_000 });
    await expect(
      limiter.consume({
        actorId: "actor-1",
        route: "/v1/opportunities/:id",
        now: new Date("2026-08-05T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 60, remaining: 1 });
    vi.mocked(redis.eval).mockResolvedValueOnce([3, 1_500]);
    await expect(
      limiter.consume({ actorId: "actor-1", route: "/v1/opportunities", now: new Date() }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 2, remaining: 0 });
    vi.mocked(redis.eval).mockResolvedValueOnce("invalid");
    await expect(
      limiter.consume({ actorId: "actor-1", route: "/v1/opportunities", now: new Date() }),
    ).rejects.toThrow("invalid result");
  });

  it("emits bounded request and source metrics without request bodies or tokens", () => {
    const logger = { info: vi.fn() };
    const apiLogger = logger as unknown as FastifyBaseLogger;
    new LoggerApiMetrics(apiLogger).observe({
      route: "/v1/opportunities",
      method: "GET",
      statusCode: 200,
      durationMs: 12,
    });
    new LoggerSourceEligibilityMetrics(apiLogger).recordEligibilityDecision(
      "himalayas",
      false,
      "disabled",
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ metric: "jovia_api_request_duration_ms", value: 12 }),
      "API request metric",
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/Bearer|body|token/u);
  });
});
