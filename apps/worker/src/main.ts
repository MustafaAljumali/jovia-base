import { loadWorkerConfig, toRedactedConfig } from "@jovia/config";
import {
  PostgresIngestionRepository,
  PostgresOpportunityRepository,
  PostgresOutboxRepository,
  PostgresSourceGovernanceRepository,
  createDatabase,
} from "@jovia/database";
import { createS3RawPayloadStore } from "@jovia/object-storage";
import { createLogger } from "@jovia/observability";
import {
  ConnectorRunner,
  FetchHttpTransport,
  HimalayasConnector,
  OpportunityLifecycleService,
  OutboxDispatcher,
  SourceEligibilityService,
  normalizeOpportunity,
} from "@jovia/opportunity-ingestion";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { createBullMqWorkerHandle } from "./adapters/bullmq.js";
import { BullMqOpportunityEventPublisher } from "./adapters/event-publisher.js";
import {
  BoundedConnectorMetrics,
  LoggerOperationalMetricSink,
  OpportunityOperationalMetricsJob,
  WorkerOutboxMetrics,
  WorkerSourceEligibilityMetrics,
} from "./adapters/metrics.js";
import { RedisSourceRateLimiter } from "./adapters/rate-limiter.js";
import { SourcePollScheduler, createIntervalWorkerHandle } from "./adapters/scheduler.js";
import { ExpirySweepJob } from "./jobs/expiry-sweep.js";
import { OutboxDispatchJob } from "./jobs/outbox-dispatch.js";
import { RetentionSweepJob } from "./jobs/retention-sweep.js";
import { SourcePollJob } from "./jobs/source-poll.js";
import { createWorkerRuntime } from "./runtime.js";

async function main() {
  const config = loadWorkerConfig(process.env);
  const logger = createLogger({
    service: "jovia-worker",
    environment: config.environment,
    level: config.logLevel,
  });
  const clock = { now: () => new Date() };
  const database = createDatabase(config.databaseUrl);
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const connection = { url: config.redisUrl };
  const operationsQueue = new Queue("jovia-opportunity-operations", { connection });
  const eventsQueue = new Queue("jovia-opportunity-events", { connection });
  const pollQueue = new Queue("jovia-opportunity-polls", { connection });
  const sink = new LoggerOperationalMetricSink(logger);
  const ingestion = new PostgresIngestionRepository(database.sql);
  const opportunities = new PostgresOpportunityRepository(database.sql);
  const lifecycle = new OpportunityLifecycleService(opportunities, clock);
  const outbox = new OutboxDispatcher(
    new PostgresOutboxRepository(database.sql),
    new BullMqOpportunityEventPublisher(eventsQueue),
    new WorkerOutboxMetrics(sink),
    clock,
  );
  const outboxJob = new OutboxDispatchJob(outbox);
  const expiryJob = new ExpirySweepJob(lifecycle);
  const metricsJob = new OpportunityOperationalMetricsJob(ingestion, sink, clock);
  const handles = [
    createBullMqWorkerHandle({
      queueName: "jovia-opportunity-operations",
      connection,
      concurrency: 4,
      logger,
      processor: async (job) => {
        switch (job.name) {
          case "outbox-dispatch":
            return outboxJob.run();
          case "expiry-sweep":
            return expiryJob.run();
          case "metrics-snapshot":
            await metricsJob.run();
            return undefined;
          default:
            throw new Error(`unknown opportunity operation job: ${job.name}`);
        }
      },
    }),
    createIntervalWorkerHandle({
      name: "opportunity-operation-scheduler",
      intervalMs: 30_000,
      run: async () => {
        const bucket = Math.floor(clock.now().getTime() / 30_000);
        await Promise.all([
          operationsQueue.add("outbox-dispatch", {}, { jobId: `outbox-${bucket}` }),
          operationsQueue.add("expiry-sweep", {}, { jobId: `expiry-${bucket}` }),
          operationsQueue.add("metrics-snapshot", {}, { jobId: `metrics-${bucket}` }),
        ]);
      },
      onError: (error) => logger.error({ err: error }, "Opportunity operation scheduling failed"),
    }),
  ];

  if (config.rawPayload.bucket && config.rawPayload.region) {
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
    const retentionJob = new RetentionSweepJob(ingestion, rawPayloads, lifecycle, clock);
    handles[0] = createBullMqWorkerHandle({
      queueName: "jovia-opportunity-operations",
      connection,
      concurrency: 4,
      logger,
      processor: async (job) => {
        switch (job.name) {
          case "outbox-dispatch":
            return outboxJob.run();
          case "expiry-sweep":
            return expiryJob.run();
          case "retention-sweep":
            return retentionJob.run();
          case "metrics-snapshot":
            await metricsJob.run();
            return undefined;
          default:
            throw new Error(`unknown opportunity operation job: ${job.name}`);
        }
      },
    });
    handles.push(
      createIntervalWorkerHandle({
        name: "retention-scheduler",
        intervalMs: 300_000,
        run: () =>
          operationsQueue.add(
            "retention-sweep",
            {},
            { jobId: `retention-${Math.floor(clock.now().getTime() / 300_000)}` },
          ),
        onError: (error) => logger.error({ err: error }, "Retention scheduling failed"),
      }),
    );

    if (config.opportunityConnectorsEnabled) {
      const governance = new PostgresSourceGovernanceRepository(database.sql);
      const eligibility = new SourceEligibilityService(
        governance,
        governance,
        new WorkerSourceEligibilityMetrics(sink),
        clock,
      );
      const connector = new HimalayasConnector(new FetchHttpTransport());
      const runner = new ConnectorRunner({
        eligibility,
        connectors: { get: (sourceCode) => (sourceCode === "himalayas" ? connector : undefined) },
        leases: ingestion.leases,
        runs: {
          ...ingestion.runs,
          reconcileCompleted: (runId, sourceCode, correlationId) =>
            opportunities
              .reconcileCompletedRun({
                runId,
                sourceCode,
                correlationId,
                occurredAt: clock.now(),
              })
              .then(() => undefined),
        },
        limiter: new RedisSourceRateLimiter(redis),
        rawPayloads,
        pageTransactions: ingestion.pageTransactions,
        quarantine: ingestion.quarantine,
        circuits: ingestion.circuits,
        metrics: new BoundedConnectorMetrics(sink),
        normalize: normalizeOpportunity,
        clock,
        requestTimeoutMs: 30_000,
        sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
        backoffMs: (attempt) => Math.min(1_000 * 2 ** (attempt - 1), 30_000),
      });
      const sourcePollJob = new SourcePollJob(runner);
      const pollScheduler = new SourcePollScheduler(governance, pollQueue, clock);
      handles.push(
        createBullMqWorkerHandle<{ sourceCode: string; correlationId: string }, unknown>({
          queueName: "jovia-opportunity-polls",
          connection,
          concurrency: 2,
          logger,
          processor: (job) => sourcePollJob.run(job.data),
        }),
        createIntervalWorkerHandle({
          name: "source-policy-scheduler",
          intervalMs: 60_000,
          run: () => pollScheduler.tick(),
          onError: (error) => logger.error({ err: error }, "Source policy scheduling failed"),
        }),
      );
    }
  }

  const runtime = createWorkerRuntime(handles);
  await runtime.start();
  logger.info({ config: toRedactedConfig(config) }, "Worker runtime started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Worker runtime stopping");
    await runtime.stop();
    await Promise.all([operationsQueue.close(), eventsQueue.close(), pollQueue.close()]);
    await redis.quit();
    await database.close();
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Worker startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
