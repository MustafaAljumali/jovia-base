import { AppError } from "@jovia/contracts";

import { NormalizationError } from "../normalization/normalize.js";
import { DatasetSupersededError } from "./contracts.js";
import type {
  ConnectorRuntimePorts,
  FetchPlan,
  OpportunityConnector,
  RawPage,
} from "./contracts.js";
import { stricterRequestSpacingMilliseconds } from "./rate-limiter.js";
import { executeWithRetry, isRetryableConnectorError, type ConnectorFetchError } from "./retry.js";

export interface ConnectorRunResult {
  runId?: string;
  outcome: "completed" | "quarantined" | "rate_limited";
  committedPages: number;
  committedRecords: number;
}

async function fetchFirstPage(
  connector: OpportunityConnector,
  plan: FetchPlan,
  signal: AbortSignal,
): Promise<RawPage | undefined> {
  const iterator = connector.fetch(plan, signal)[Symbol.asyncIterator]();
  const result = await iterator.next();
  if (iterator.return) await iterator.return();
  return result.done ? undefined : result.value;
}

function safeFieldPaths(error: unknown): string[] {
  if (error instanceof NormalizationError) return [error.fieldPath];
  const message = error instanceof Error ? error.message : "schema";
  const candidates = message.match(/[A-Za-z][A-Za-z0-9_.[\]-]*/gu) ?? [];
  const path = candidates.find((candidate) => candidate.includes("."));
  return [path ?? "schema"];
}

export class ConnectorRunner {
  constructor(private readonly ports: ConnectorRuntimePorts) {}

  async run(
    sourceCode: string,
    correlationId: string,
    signal: AbortSignal,
  ): Promise<ConnectorRunResult> {
    const startedAt = this.ports.clock.now();
    const eligible = await this.ports.eligibility.require(sourceCode, "poll", correlationId);
    const connector = this.ports.connectors.get(sourceCode);
    if (!connector || connector.sourceCode !== sourceCode) {
      throw new AppError({
        code: "connector_not_registered",
        status: 503,
        title: "Eligible source connector is not registered",
      });
    }
    const policy = eligible.context.policy;
    const lease = await this.ports.leases.acquire({
      sourceCode,
      policyId: policy.id,
      maximumConcurrency: policy.polling.maximumConcurrency,
      correlationId,
    });
    if (!lease) {
      this.ports.metrics.increment("jovia_source_rate_limited_total", { source: sourceCode });
      return { outcome: "rate_limited", committedPages: 0, committedRecords: 0 };
    }

    let runId: string | undefined;
    let runFinished = false;
    try {
      const run = await this.ports.runs.start({
        sourceCode,
        policyId: policy.id,
        correlationId,
        startedAt,
      });
      runId = run.id;
      let currentCheckpoint = run.checkpoint;
      let committedPages = 0;
      let committedRecords = 0;
      let complete = false;
      let restartCount = 0;

      while (!complete) {
        if (signal.aborted) throw signal.reason ?? new Error("connector run aborted");
        const plan = await connector.plan({ checkpoint: currentCheckpoint, policy, runId });
        let page: RawPage | undefined;
        try {
          page = await executeWithRetry(
            async () => {
              await this.ports.limiter.acquire({
                sourceCode,
                policyId: policy.id,
                minimumSpacingMs: stricterRequestSpacingMilliseconds(policy.polling),
                officialRequestLimit: policy.polling.officialRequestLimit,
                signal,
              });
              const requestSignal = AbortSignal.any([
                signal,
                AbortSignal.timeout(this.ports.requestTimeoutMs),
              ]);
              return fetchFirstPage(connector, plan, requestSignal);
            },
            {
              maximumAttempts: 3,
              sleep: this.ports.sleep,
              backoffMs: this.ports.backoffMs,
            },
          );
        } catch (error) {
          if (isRetryableConnectorError(error)) {
            await this.ports.circuits.recordRetryableFailure(sourceCode, this.ports.clock.now());
          }
          await this.ports.runs.finish(runId, "failed", this.ports.clock.now());
          runFinished = true;
          this.ports.metrics.increment("jovia_ingestion_fetch_total", {
            source: sourceCode,
            outcome: "failed",
          });
          throw error as ConnectorFetchError;
        }
        if (!page) {
          complete = true;
          continue;
        }

        const raw = await this.ports.rawPayloads.put({
          sourceCode,
          runId,
          pageSequence: page.sequence,
          fetchedAt: page.fetchedAt,
          contentType: page.contentType,
          bytes: page.bytes,
        });
        let records;
        try {
          records = connector
            .parse(page)
            .map((record) =>
              this.ports.normalize(record, { policy, normalizedAt: this.ports.clock.now() }),
            );
        } catch (error) {
          if (error instanceof DatasetSupersededError) {
            await this.ports.runs.recordSupersededPage?.(runId, raw, correlationId);
            await this.ports.runs.finish(runId, "superseded", this.ports.clock.now());
            runFinished = true;
            if (restartCount >= 1) {
              throw new AppError({
                code: "source_dataset_unstable",
                status: 503,
                title: "Source dataset changed repeatedly during ingestion",
              });
            }
            restartCount += 1;
            const restarted = await this.ports.runs.start({
              sourceCode,
              policyId: policy.id,
              correlationId,
              startedAt: this.ports.clock.now(),
              restartFromBeginning: true,
            });
            runId = restarted.id;
            currentCheckpoint = undefined;
            complete = false;
            runFinished = false;
            continue;
          }
          await this.ports.quarantine.record({
            sourceCode,
            runId,
            raw,
            reason: error instanceof NormalizationError ? "canonical_invalid" : "schema_invalid",
            safeFieldPaths: safeFieldPaths(error),
            connectorVersion: connector.connectorVersion,
            correlationId,
          });
          await this.ports.circuits.recordSchemaFailure(sourceCode, this.ports.clock.now());
          await this.ports.runs.finish(runId, "quarantined", this.ports.clock.now());
          runFinished = true;
          this.ports.metrics.increment("jovia_ingestion_quarantined_total", {
            source: sourceCode,
            reason: error instanceof NormalizationError ? "canonical_invalid" : "schema_invalid",
          });
          return { runId, outcome: "quarantined", committedPages, committedRecords };
        }

        await this.ports.pageTransactions.commit({
          runId,
          sourceId: eligible.context.source.id,
          policyId: policy.id,
          pageSequence: page.sequence,
          raw,
          records,
          nextCheckpoint: page.nextCheckpoint,
          correlationId,
          connectorVersion: connector.connectorVersion,
          mapperVersion: connector.mapperVersion,
          normalizationVersion: "1.0.0",
          fetchedAt: page.fetchedAt,
        });
        currentCheckpoint = page.nextCheckpoint;
        committedPages += 1;
        committedRecords += records.length;
        complete = page.complete;
        await this.ports.circuits.recordSuccess(sourceCode, this.ports.clock.now());
        this.ports.metrics.increment("jovia_ingestion_fetch_total", {
          source: sourceCode,
          outcome: "success",
        });
        this.ports.metrics.increment("jovia_ingestion_records_total", {
          source: sourceCode,
          result: "committed",
        });
      }

      await this.ports.runs.reconcileCompleted?.(runId, sourceCode, correlationId);
      await this.ports.runs.finish(runId, "completed", this.ports.clock.now());
      runFinished = true;
      this.ports.metrics.observe(
        "jovia_ingestion_run_duration_ms",
        this.ports.clock.now().getTime() - startedAt.getTime(),
        { source: sourceCode, outcome: "completed" },
      );
      return { runId, outcome: "completed", committedPages, committedRecords };
    } catch (error) {
      if (runId && !runFinished) {
        await this.ports.runs.finish(runId, "failed", this.ports.clock.now());
      }
      throw error;
    } finally {
      await this.ports.leases.release(lease);
    }
  }
}
