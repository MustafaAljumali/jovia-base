import { AppError, ProblemDetailsSchema } from "@jovia/contracts";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { registerRequestContext } from "./plugins/request-context.js";
import { registerHealthRoute } from "./routes/health.js";

export interface ApiAppDependencies {
  config: { version: string };
  clock?: { now(): Date };
  logger?: FastifyBaseLogger;
  configure?: (app: FastifyInstance) => void;
}

export async function createApiApp(dependencies: ApiAppDependencies): Promise<FastifyInstance> {
  const app = dependencies.logger
    ? Fastify({ loggerInstance: dependencies.logger })
    : Fastify({ logger: false });
  registerRequestContext(app);
  registerHealthRoute(app, {
    version: dependencies.config.version,
    clock: dependencies.clock ?? { now: () => new Date() },
  });
  dependencies.configure?.(app);
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof AppError;
    const status = known ? error.status : 500;
    const problem = ProblemDetailsSchema.parse({
      type: known ? `https://jovia.dev/problems/${error.code}` : "about:blank",
      title: known ? error.title : "Internal Server Error",
      status,
      detail: known ? error.message : undefined,
      instance: request.url,
      code: known ? error.code : "internal_error",
      correlationId: request.correlationId,
    });
    if (!known) request.log.error({ err: error }, "Unhandled request error");
    void reply.status(status).type("application/problem+json").send(problem);
  });
  await app.ready();
  return app;
}
