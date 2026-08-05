import { AppError } from "@jovia/contracts";
import type { Actor, Authenticator } from "@jovia/auth";
import type { FastifyInstance } from "fastify";
import { RateLimiterMemory } from "rate-limiter-flexible";

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

function bearerToken(header: string | undefined): string {
  const match = /^Bearer ([^\s]+)$/u.exec(header ?? "");
  if (!match?.[1]) {
    throw new AppError({
      code: "authentication_required",
      status: 401,
      title: "Bearer authentication is required",
    });
  }
  return match[1];
}

export interface PreAuthenticationRateLimitOptions {
  points: number;
  durationSeconds: number;
}

export function registerAuthentication(
  app: FastifyInstance,
  authenticator: Authenticator,
  rateLimitOptions: PreAuthenticationRateLimitOptions = {
    points: 120,
    durationSeconds: 60,
  },
): void {
  const preAuthenticationLimiter = new RateLimiterMemory({
    points: rateLimitOptions.points,
    duration: rateLimitOptions.durationSeconds,
    blockDuration: rateLimitOptions.durationSeconds,
    keyPrefix: "jovia-api-pre-authentication",
  });
  app.decorateRequest("actor", null);
  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.url === "/v1/health") return;
    try {
      await preAuthenticationLimiter.consume(request.ip);
    } catch (error) {
      const milliseconds =
        typeof error === "object" && error !== null && "msBeforeNext" in error
          ? Number(error.msBeforeNext)
          : rateLimitOptions.durationSeconds * 1_000;
      const retryAfterSeconds = Math.max(1, Math.ceil(milliseconds / 1_000));
      reply.header("retry-after", retryAfterSeconds.toString());
      throw new AppError({
        code: "rate_limit_exceeded",
        status: 429,
        title: "Pre-authentication request rate limit exceeded",
      });
    }
    const actor = await authenticator.authenticate(bearerToken(request.headers.authorization));
    if (!actor) {
      throw new AppError({
        code: "authentication_required",
        status: 401,
        title: "Bearer authentication is invalid or expired",
      });
    }
    request.actor = actor;
  });
}
