import { AppError } from "@jovia/contracts";
import type { FastifyInstance } from "fastify";

export interface ApiRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export interface ApiRateLimiter {
  consume(input: { actorId: string; route: string; now: Date }): Promise<ApiRateLimitDecision>;
}

export function registerRateLimit(
  app: FastifyInstance,
  limiter: ApiRateLimiter,
  clock: { now(): Date },
): void {
  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.url === "/v1/health") return;
    if (!request.actor) return;
    const decision = await limiter.consume({
      actorId: request.actor.id,
      route: request.routeOptions.url ?? "unmatched",
      now: clock.now(),
    });
    reply.header("x-ratelimit-remaining", decision.remaining.toString());
    if (!decision.allowed) {
      reply.header("retry-after", decision.retryAfterSeconds.toString());
      throw new AppError({
        code: "rate_limit_exceeded",
        status: 429,
        title: "Request rate limit exceeded",
      });
    }
  });
}
