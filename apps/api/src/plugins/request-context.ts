import { randomUUID } from "node:crypto";

import { enterCorrelationId } from "@jovia/observability";
import type { FastifyInstance } from "fastify";

const validCorrelationId = /^[A-Za-z0-9._:-]{1,128}$/u;

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

export function registerRequestContext(app: FastifyInstance): void {
  app.decorateRequest("correlationId", "");
  app.addHook("onRequest", async (request, reply) => {
    const supplied = request.headers["x-correlation-id"];
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
    const correlationId =
      candidate && validCorrelationId.test(candidate) ? candidate : randomUUID();
    request.correlationId = correlationId;
    reply.header("x-correlation-id", correlationId);
    enterCorrelationId(correlationId);
  });
}
