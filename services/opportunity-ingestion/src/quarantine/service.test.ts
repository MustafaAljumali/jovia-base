import type { QuarantineRecord } from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import { QuarantineService, type QuarantineRepositoryPort } from "./service.js";

const record: QuarantineRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  sourceCode: "himalayas",
  runId: "00000000-0000-4000-8000-000000000002",
  rawReference: {
    provider: "s3-compatible",
    bucket: "raw",
    objectKey: "himalayas/raw.json",
    sha256: "a".repeat(64),
    byteLength: 10,
    storedAt: "2026-08-05T00:00:00.000Z",
  },
  reason: "schema_invalid",
  safeFieldPaths: ["jobs.0.guid"],
  connectorVersion: "1.0.0",
  correlationId: "quarantine-test",
  createdAt: "2026-08-05T00:00:00.000Z",
  releasedAt: null,
};

function harness() {
  const repository: QuarantineRepositoryPort = {
    record: vi.fn(async () => undefined),
    find: vi.fn(async () => record),
    releaseForReplay: vi.fn(async ({ releasedAt }) => ({
      ...record,
      releasedAt: releasedAt.toISOString(),
    })),
  };
  return {
    repository,
    service: new QuarantineService(repository, {
      now: () => new Date("2026-08-05T01:00:00.000Z"),
    }),
  };
}

describe("QuarantineService", () => {
  it("requires admin capability and a changed mapper version for replay", async () => {
    const { service } = harness();
    await expect(
      service.releaseForReplay({ id: "actor", capabilities: new Set() }, record.id, "2.0.0"),
    ).rejects.toMatchObject({ code: "capability_denied" });
    await expect(
      service.releaseForReplay(
        { id: "actor", capabilities: new Set(["admin:operate"]) },
        record.id,
        "1.0.0",
      ),
    ).rejects.toMatchObject({ code: "mapper_version_unchanged" });
  });

  it("releases immutable raw evidence for replay after an authorized mapper change", async () => {
    const { repository, service } = harness();
    await expect(
      service.releaseForReplay(
        { id: "actor", capabilities: new Set(["admin:operate"]) },
        record.id,
        "2.0.0",
      ),
    ).resolves.toMatchObject({ rawReference: record.rawReference, releasedAt: expect.any(String) });
    expect(repository.releaseForReplay).toHaveBeenCalledWith(
      expect.objectContaining({ mapperVersion: "2.0.0", releasedAt: expect.any(Date) }),
    );
  });

  it("records safe quarantine metadata without transforming immutable evidence", async () => {
    const { repository, service } = harness();
    const input = {
      sourceCode: record.sourceCode,
      runId: record.runId,
      raw: record.rawReference,
      reason: record.reason,
      safeFieldPaths: record.safeFieldPaths,
      connectorVersion: record.connectorVersion,
      correlationId: record.correlationId,
    } as const;

    await expect(service.record(input)).resolves.toBeUndefined();
    expect(repository.record).toHaveBeenCalledWith(input);
  });

  it("fails closed for missing and already released quarantine records", async () => {
    const { repository, service } = harness();
    const actor = { id: "actor", capabilities: new Set(["admin:operate"]) };
    vi.mocked(repository.find)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        ...record,
        releasedAt: "2026-08-05T00:30:00.000Z",
      });

    await expect(service.releaseForReplay(actor, record.id, "2.0.0")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(service.releaseForReplay(actor, record.id, "2.0.0")).rejects.toMatchObject({
      code: "quarantine_already_released",
    });
    expect(repository.releaseForReplay).not.toHaveBeenCalled();
  });
});
