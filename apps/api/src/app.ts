import { AppError, ProblemDetailsSchema } from "@jovia/contracts";
import type { Authenticator } from "@jovia/auth";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { registerAuthentication } from "./plugins/authentication.js";
import { registerApiMetrics, type ApiMetricsPort } from "./plugins/metrics.js";
import { registerRateLimit, type ApiRateLimiter } from "./plugins/rate-limit.js";
import { registerRequestContext } from "./plugins/request-context.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerIngestionRunRoutes, type IngestionRunQueryPort } from "./routes/ingestion-runs.js";
import { registerOpenApiRoute } from "./routes/openapi.js";
import {
  registerOpportunityRoutes,
  type OpportunityRouteDependencies,
} from "./routes/opportunities.js";
import { registerOpportunitySourceRoutes } from "./routes/opportunity-sources.js";
import type { SourceExecutionContext } from "@jovia/contracts";

export interface ApiOpportunityCoreDependencies extends OpportunityRouteDependencies {
  authenticator: Authenticator;
  rateLimiter: ApiRateLimiter;
  metrics: ApiMetricsPort;
  sources: { listSources(limit?: number): Promise<readonly SourceExecutionContext[]> };
  runs: IngestionRunQueryPort;
}

export interface ApiAppDependencies {
  config: { version: string };
  clock?: { now(): Date };
  logger?: FastifyBaseLogger;
  opportunityCore?: ApiOpportunityCoreDependencies;
  configure?: (app: FastifyInstance) => void;
}

export async function createApiApp(dependencies: ApiAppDependencies): Promise<FastifyInstance> {
  const app = dependencies.logger
    ? Fastify({ loggerInstance: dependencies.logger })
    : Fastify({ logger: false });
  registerRequestContext(app);
  const clock = dependencies.clock ?? { now: () => new Date() };
  if (dependencies.opportunityCore) {
    registerApiMetrics(app, dependencies.opportunityCore.metrics, clock);
    registerAuthentication(app, dependencies.opportunityCore.authenticator);
    registerRateLimit(app, dependencies.opportunityCore.rateLimiter, clock);
  }
  registerHealthRoute(app, {
    version: dependencies.config.version,
    clock,
  });
  if (dependencies.opportunityCore) {
    registerOpportunityRoutes(app, dependencies.opportunityCore);
    registerOpportunitySourceRoutes(app, dependencies.opportunityCore.sources);
    registerIngestionRunRoutes(app, dependencies.opportunityCore.runs);
    registerOpenApiRoute(app);
  }
  dependencies.configure?.(app);
  app.setErrorHandler((error, request, reply) => {
    const validation = error instanceof ZodError;
    const errorCode =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const invalidJson = errorCode === "FST_ERR_CTP_INVALID_JSON_BODY";
    const known = error instanceof AppError;
    const status = known ? error.status : validation ? 422 : invalidJson ? 400 : 500;
    const code = known
      ? error.code
      : validation
        ? "validation_failed"
        : invalidJson
          ? "invalid_json"
          : "internal_error";
    const title = known
      ? error.title
      : validation
        ? "Request validation failed"
        : invalidJson
          ? "Request body is not valid JSON"
          : "Internal Server Error";
    const problem = ProblemDetailsSchema.parse({
      type: status < 500 ? `https://jovia.dev/problems/${code}` : "about:blank",
      title,
      status,
      detail: known ? error.message : undefined,
      instance: request.url,
      code,
      correlationId: request.correlationId,
    });
    if (status >= 500) request.log.error({ err: error }, "Unhandled request error");
    if (status === 401) reply.header("www-authenticate", "Bearer");
    void reply.status(status).type("application/problem+json").send(problem);
  });
  app.setNotFoundHandler((request, reply) => {
    const problem = ProblemDetailsSchema.parse({
      type: "https://jovia.dev/problems/not_found",
      title: "Route not found",
      status: 404,
      instance: request.url,
      code: "not_found",
      correlationId: request.correlationId,
    });
    void reply.status(404).type("application/problem+json").send(problem);
  });
  await app.ready();
  return app;
}
