import { HealthResponseSchema } from "@jovia/contracts";
import type { FastifyInstance } from "fastify";

export interface HealthRouteOptions {
  version: string;
  clock: { now(): Date };
}

export function registerHealthRoute(app: FastifyInstance, options: HealthRouteOptions): void {
  app.get("/v1/health", async () =>
    HealthResponseSchema.parse({
      status: "ok",
      service: "jovia-api",
      version: options.version,
      timestamp: options.clock.now().toISOString(),
    }),
  );
}
