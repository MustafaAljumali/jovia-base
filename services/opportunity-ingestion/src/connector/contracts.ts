import type {
  IngestionRunOutcomeSchema,
  RawPayloadReference,
  SourceOpportunityRecord,
  SourcePolicyVersion,
} from "@jovia/contracts";
import type { z } from "zod";

import type { NormalizedOpportunity } from "../normalization/normalize.js";
import type { Clock, EligibleSourceContext } from "../ports.js";

export type IngestionRunOutcome = z.infer<typeof IngestionRunOutcomeSchema>;

export interface ConnectorPlanContext<Checkpoint = unknown> {
  checkpoint: Checkpoint | undefined;
  policy: SourcePolicyVersion;
  runId: string;
}

export interface FetchPlan<Checkpoint = unknown> {
  checkpoint: Checkpoint;
}

export interface RawPage<Checkpoint = unknown> {
  sequence: number;
  bytes: Uint8Array;
  contentType: string;
  fetchedAt: string;
  value: unknown;
  nextCheckpoint: Checkpoint;
  complete: boolean;
}

export interface OpportunityConnector<Checkpoint = unknown> {
  readonly sourceCode: string;
  readonly connectorVersion: string;
  readonly mapperVersion: string;
  plan(context: ConnectorPlanContext<Checkpoint>): Promise<FetchPlan<Checkpoint>>;
  fetch(plan: FetchPlan<Checkpoint>, signal: AbortSignal): AsyncIterable<RawPage<Checkpoint>>;
  parse(page: RawPage<Checkpoint>): readonly SourceOpportunityRecord[];
}

export interface RawPayloadWrite {
  sourceCode: string;
  runId: string;
  pageSequence: number;
  fetchedAt: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface RawPayloadStore {
  put(input: RawPayloadWrite): Promise<RawPayloadReference>;
  delete(reference: RawPayloadReference): Promise<void>;
}

export interface ConnectorLease {
  id: string;
}

export interface ConnectorRun {
  id: string;
  checkpoint: unknown;
}

export interface PageCommit {
  runId: string;
  sourceId: string;
  policyId: string;
  pageSequence: number;
  raw: RawPayloadReference;
  records: readonly NormalizedOpportunity[];
  nextCheckpoint: unknown;
  correlationId: string;
  connectorVersion: string;
  mapperVersion: string;
  normalizationVersion: string;
  fetchedAt: string;
}

export interface ConnectorRuntimePorts {
  eligibility: {
    require(
      sourceCode: string,
      operation: "poll",
      correlationId: string,
    ): Promise<EligibleSourceContext>;
  };
  connectors: { get(sourceCode: string): OpportunityConnector | undefined };
  leases: {
    acquire(input: {
      sourceCode: string;
      policyId: string;
      maximumConcurrency: number;
      correlationId: string;
    }): Promise<ConnectorLease | undefined>;
    release(lease: ConnectorLease): Promise<void>;
  };
  runs: {
    start(input: {
      sourceCode: string;
      policyId: string;
      correlationId: string;
      startedAt: Date;
    }): Promise<ConnectorRun>;
    finish(runId: string, outcome: IngestionRunOutcome, finishedAt: Date): Promise<void>;
    reconcileCompleted?(runId: string, sourceCode: string, correlationId: string): Promise<void>;
  };
  limiter: {
    acquire(input: {
      sourceCode: string;
      policyId: string;
      minimumSpacingMs: number;
      officialRequestLimit: SourcePolicyVersion["polling"]["officialRequestLimit"];
      signal: AbortSignal;
    }): Promise<void>;
  };
  rawPayloads: RawPayloadStore;
  pageTransactions: { commit(input: PageCommit): Promise<void> };
  quarantine: {
    record(input: {
      sourceCode: string;
      runId: string;
      raw: RawPayloadReference;
      reason: "schema_invalid" | "canonical_invalid";
      safeFieldPaths: readonly string[];
      connectorVersion: string;
      correlationId: string;
    }): Promise<void>;
  };
  circuits: {
    recordRetryableFailure(sourceCode: string, at: Date): Promise<void>;
    recordSchemaFailure(sourceCode: string, at: Date): Promise<void>;
    recordSuccess(sourceCode: string, at: Date): Promise<void>;
  };
  metrics: {
    increment(name: string, labels: Readonly<Record<string, string>>): void;
    observe(name: string, value: number, labels: Readonly<Record<string, string>>): void;
  };
  normalize(
    record: SourceOpportunityRecord,
    input: { policy: SourcePolicyVersion; normalizedAt: Date },
  ): NormalizedOpportunity;
  clock: Clock;
  sleep(milliseconds: number): Promise<void>;
  backoffMs(attempt: number): number;
}
