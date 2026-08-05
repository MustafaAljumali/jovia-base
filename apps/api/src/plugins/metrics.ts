import type { FastifyInstance } from "fastify";

export interface ApiMetricsPort {
  observe(input: { route: string; method: string; statusCode: number; durationMs: number }): void;
}

export function registerApiMetrics(
  app: FastifyInstance,
  metrics: ApiMetricsPort,
  clock: { now(): Date },
): void {
  const starts = new WeakMap<object, number>();
  app.addHook("onRequest", async (request) => {
    starts.set(request, clock.now().getTime());
  });
  app.addHook("onResponse", async (request, reply) => {
    const startedAt = starts.get(request) ?? clock.now().getTime();
    metrics.observe({
      route: request.routeOptions.url ?? "unmatched",
      method: request.method,
      statusCode: reply.statusCode,
      durationMs: Math.max(0, clock.now().getTime() - startedAt),
    });
  });
}
