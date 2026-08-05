import { loadApiConfig } from "@jovia/config";
import {
  PostgresAuthenticator,
  PostgresIngestionRepository,
  PostgresOpportunityRepository,
  PostgresPublishingOwnershipRepository,
  PostgresSourceGovernanceRepository,
  createDatabase,
} from "@jovia/database";
import { createS3RawPayloadStore } from "@jovia/object-storage";
import { createLogger } from "@jovia/observability";
import {
  DirectOpportunityService,
  SourceEligibilityService,
  normalizeOpportunity,
} from "@jovia/opportunity-ingestion";
import { Redis } from "ioredis";

import { LoggerApiMetrics, LoggerSourceEligibilityMetrics } from "./adapters/metrics.js";
import { RedisApiRateLimiter } from "./adapters/redis-rate-limiter.js";
import { createApiApp } from "./app.js";

async function main() {
  const config = loadApiConfig(process.env);
  const logger = createLogger({
    service: "jovia-api",
    environment: config.environment,
    level: config.logLevel,
  });
  if (
    !config.databaseUrl ||
    !config.redisUrl ||
    !config.rawPayload.bucket ||
    !config.rawPayload.region
  ) {
    throw new Error(
      "API opportunity core requires database, Redis and raw payload storage configuration",
    );
  }
  const clock = { now: () => new Date() };
  const database = createDatabase(config.databaseUrl);
  const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  await redis.connect();
  const rawPayloads = await createS3RawPayloadStore(
    {
      environment: config.environment,
      bucket: config.rawPayload.bucket,
      region: config.rawPayload.region,
      ...(config.rawPayload.endpoint ? { endpoint: config.rawPayload.endpoint } : {}),
      approvedEndpointHosts: config.rawPayload.approvedEndpointHosts,
      credentialProviderAvailable: true,
    },
    clock,
  );
  const governance = new PostgresSourceGovernanceRepository(database.sql);
  const opportunityRepository = new PostgresOpportunityRepository(database.sql);
  const ingestionRepository = new PostgresIngestionRepository(database.sql);
  const eligibility = new SourceEligibilityService(
    governance,
    governance,
    new LoggerSourceEligibilityMetrics(logger),
    clock,
  );
  const direct = new DirectOpportunityService({
    ownership: new PostgresPublishingOwnershipRepository(database.sql),
    eligibility,
    rawPayloads,
    transactions: opportunityRepository,
    normalize: normalizeOpportunity,
    clock,
  });
  const app = await createApiApp({
    config,
    logger,
    clock,
    opportunityCore: {
      authenticator: new PostgresAuthenticator(database.sql, clock),
      rateLimiter: new RedisApiRateLimiter(redis, {
        limit: config.rateLimit.requests,
        windowMs: config.rateLimit.windowSeconds * 1_000,
      }),
      metrics: new LoggerApiMetrics(logger),
      direct,
      opportunities: opportunityRepository,
      sources: governance,
      runs: ingestionRepository,
    },
  });
  app.addHook("onClose", async () => {
    redis.disconnect();
    await database.close();
  });
  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `API startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
