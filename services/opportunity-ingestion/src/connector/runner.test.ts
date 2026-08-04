import type {
  RawPayloadReference,
  SourceExecutionContext,
  SourceOpportunityRecord,
} from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import type { NormalizedOpportunity } from "../normalization/normalize.js";
import type { EligibleSourceContext } from "../ports.js";
import type { ConnectorRuntimePorts, OpportunityConnector, RawPage } from "./contracts.js";
import { DatasetSupersededError } from "./contracts.js";
import { ConnectorRunner } from "./runner.js";

const checkpoint = { offset: 20, datasetUpdatedAt: "2026-08-05T00:00:00.000Z" };
const nextCheckpoint = { offset: 40, datasetUpdatedAt: "2026-08-05T00:00:00.000Z" };

function sourceContext(): SourceExecutionContext {
  return {
    source: {
      id: "00000000-0000-4000-8000-000000000001",
      code: "himalayas",
      name: "Himalayas",
      scope: "external",
      enabled: true,
      runtimeStatus: "eligible",
      activePolicyId: "00000000-0000-4000-8000-000000000002",
      nextPollAt: "2026-08-04T00:00:00.000Z",
      quarantinedAt: null,
      lastSuccessfulRunAt: null,
    },
    policy: {
      id: "00000000-0000-4000-8000-000000000002",
      sourceCode: "himalayas",
      version: 1,
      scope: "external",
      mechanism: "official_api",
      legalPosture: "approved",
      termsUrl: "https://himalayas.app/docs/remote-jobs-api",
      termsSnapshotRef: "docs/legal/sources/himalayas-2026-08-05.md",
      termsSnapshotSha256: "a".repeat(64),
      attribution: {
        required: true,
        displayText: "Data sourced from Himalayas",
        sourceUrl: "https://himalayas.app",
        originalLinkRequired: true,
        logoPolicy: "text_only",
      },
      polling: {
        pollingFloorSeconds: 86_400,
        maximumConcurrency: 1,
        minimumRequestSpacingMs: 1_000,
        honorRetryAfter: true,
        retryAfterDefaultSeconds: 60,
        officialRequestLimit: null,
      },
      retention: {
        servingTtlSeconds: 86_400,
        inactiveRetentionDays: 90,
        rawPayloadRetentionDays: 90,
        tombstoneSlaSeconds: 300,
      },
      redistribution: "prohibited",
      contentModification: {
        allowedFields: [
          "description_sanitization",
          "compensation_normalization",
          "location_normalization",
          "language_normalization",
          "taxonomy_mapping",
        ],
        translationAllowed: false,
      },
      owner: "integrations",
      verifiedAt: "2026-08-05T00:00:00.000Z",
      validUntil: "2026-11-03T23:59:59.999Z",
      approvedBy: "Product Owner",
      approvedAt: "2026-08-05T00:00:00.000Z",
      createdAt: "2026-08-05T00:00:00.000Z",
    },
    circuit: { state: "closed", consecutiveFailures: 0, openedAt: null, halfOpenAfter: null },
  };
}

const record: SourceOpportunityRecord = {
  externalId: "job-1",
  sourceCode: "himalayas",
  title: "Platform Engineer",
  descriptionHtml: "<p>Build systems</p>",
  employerName: "Jovia",
  engagementType: "contract",
  experienceLevels: ["senior"],
  categories: ["Engineering"],
  technologies: ["TypeScript"],
  languages: ["en"],
  location: { remote: true, countryCodes: ["IQ"], timezoneRestrictions: [] },
  publishedAt: "2026-08-05T00:00:00.000Z",
  originalUrl: "https://example.com/apply/1",
  applicationUrl: "https://example.com/apply/1",
  extension: {},
};

function page(): RawPage<typeof nextCheckpoint> {
  return {
    sequence: 1,
    bytes: new TextEncoder().encode('{"jobs":[]}'),
    contentType: "application/json",
    fetchedAt: "2026-08-05T01:00:00.000Z",
    value: { jobs: [] },
    nextCheckpoint,
    complete: true,
  };
}

function harness(options: { rawFailure?: Error; parseFailure?: Error } = {}) {
  const context = sourceContext();
  const eligible: EligibleSourceContext = {
    decision: { eligible: true, sourceCode: "himalayas", policyId: context.policy.id },
    context,
  };
  const connector: OpportunityConnector<typeof nextCheckpoint> = {
    sourceCode: "himalayas",
    connectorVersion: "1.0.0",
    mapperVersion: "1.0.0",
    plan: vi.fn(async ({ checkpoint: saved }) => ({ checkpoint: saved ?? { offset: 0 } })),
    fetch: async function* () {
      yield page();
    },
    parse: vi.fn(() => {
      if (options.parseFailure) throw options.parseFailure;
      return [record];
    }),
  };
  const rawReference: RawPayloadReference = {
    provider: "s3-compatible",
    bucket: "test-raw",
    objectKey: "himalayas/2026/08/05/run-1/page.json",
    sha256: "b".repeat(64),
    byteLength: 11,
    storedAt: "2026-08-05T01:00:00.000Z",
  };
  const ports: ConnectorRuntimePorts = {
    eligibility: { require: vi.fn(async () => eligible) },
    connectors: { get: vi.fn(() => connector) },
    leases: {
      acquire: vi.fn(async () => ({ id: "lease-1" })),
      release: vi.fn(async () => undefined),
    },
    runs: {
      start: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000010", checkpoint })),
      finish: vi.fn(async () => undefined),
    },
    limiter: { acquire: vi.fn(async () => undefined) },
    rawPayloads: {
      put: vi.fn(async () => {
        if (options.rawFailure) throw options.rawFailure;
        return rawReference;
      }),
      delete: vi.fn(async () => undefined),
    },
    pageTransactions: { commit: vi.fn(async () => undefined) },
    quarantine: { record: vi.fn(async () => undefined) },
    circuits: {
      recordRetryableFailure: vi.fn(async () => undefined),
      recordSchemaFailure: vi.fn(async () => undefined),
      recordSuccess: vi.fn(async () => undefined),
    },
    metrics: { increment: vi.fn(), observe: vi.fn() },
    normalize: vi.fn(() => ({ contentSignature: "c".repeat(64) }) as NormalizedOpportunity),
    clock: { now: () => new Date("2026-08-05T01:00:00.000Z") },
    requestTimeoutMs: 30_000,
    sleep: vi.fn(async () => undefined),
    backoffMs: () => 1,
  };
  return { connector, ports, runner: new ConnectorRunner(ports) };
}

describe("ConnectorRunner", () => {
  it("resumes from the last committed checkpoint and commits the next checkpoint atomically", async () => {
    const { connector, ports, runner } = harness();
    await expect(
      runner.run("himalayas", "resume-test", new AbortController().signal),
    ).resolves.toMatchObject({
      outcome: "completed",
      committedPages: 1,
      committedRecords: 1,
    });
    expect(connector.plan).toHaveBeenCalledWith(
      expect.objectContaining({ checkpoint, policy: sourceContext().policy }),
    );
    expect(ports.pageTransactions.commit).toHaveBeenCalledWith(
      expect.objectContaining({ nextCheckpoint, records: expect.any(Array) }),
    );
    expect(ports.runs.finish).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000010",
      "completed",
      expect.any(Date),
    );
  });

  it("does not parse or advance a checkpoint when durable raw storage fails", async () => {
    const { connector, ports, runner } = harness({ rawFailure: new Error("storage unavailable") });
    await expect(runner.run("himalayas", "raw-test", new AbortController().signal)).rejects.toThrow(
      "storage unavailable",
    );
    expect(connector.parse).not.toHaveBeenCalled();
    expect(ports.pageTransactions.commit).not.toHaveBeenCalled();
  });

  it("quarantines schema failures and does not advance the checkpoint", async () => {
    const { ports, runner } = harness({ parseFailure: new Error("jobs.0.guid expected string") });
    await expect(
      runner.run("himalayas", "schema-test", new AbortController().signal),
    ).resolves.toMatchObject({
      outcome: "quarantined",
      committedPages: 0,
    });
    expect(ports.quarantine.record).toHaveBeenCalledWith(
      expect.objectContaining({ safeFieldPaths: ["jobs.0.guid"] }),
    );
    expect(ports.pageTransactions.commit).not.toHaveBeenCalled();
    expect(ports.circuits.recordSchemaFailure).toHaveBeenCalledOnce();
  });

  it("evaluates eligibility before connector lookup", async () => {
    const { ports, runner } = harness();
    vi.mocked(ports.eligibility.require).mockRejectedValueOnce(new Error("policy denied"));
    await expect(
      runner.run("himalayas", "denied-test", new AbortController().signal),
    ).rejects.toThrow("policy denied");
    expect(ports.connectors.get).not.toHaveBeenCalled();
    expect(ports.leases.acquire).not.toHaveBeenCalled();
  });

  it("closes a superseded run and restarts once from offset zero", async () => {
    const { connector, ports, runner } = harness();
    vi.mocked(connector.parse)
      .mockImplementationOnce(() => {
        throw new DatasetSupersededError("himalayas");
      })
      .mockReturnValueOnce([record]);
    vi.mocked(ports.runs.start)
      .mockResolvedValueOnce({ id: "00000000-0000-4000-8000-000000000010", checkpoint })
      .mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000011",
        checkpoint: undefined,
      });

    await expect(
      runner.run("himalayas", "superseded-test", new AbortController().signal),
    ).resolves.toMatchObject({
      runId: "00000000-0000-4000-8000-000000000011",
      outcome: "completed",
    });
    expect(ports.runs.finish).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000010",
      "superseded",
      expect.any(Date),
    );
    expect(ports.runs.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ restartFromBeginning: true }),
    );
    expect(connector.plan).toHaveBeenLastCalledWith(
      expect.objectContaining({ checkpoint: undefined }),
    );
  });
});
