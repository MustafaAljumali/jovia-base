import { describe, expect, it, vi } from "vitest";

import { OpportunityLifecycleService, type OpportunityLifecyclePort } from "./service.js";

describe("OpportunityLifecycleService", () => {
  it("tombstones only the occurrence and preserves an active multi-source canon", async () => {
    const lifecycle: OpportunityLifecyclePort = {
      tombstoneOccurrence: vi.fn(async () => ({
        canonicalOpportunityId: "00000000-0000-4000-8000-000000000001",
        canonicalRemainsActive: true,
      })),
      expireDue: vi.fn(async () => 0),
      reconcileCompletedRun: vi.fn(async () => 0),
      purgeDue: vi.fn(async () => 0),
    };
    const service = new OpportunityLifecycleService(lifecycle, {
      now: () => new Date("2026-08-05T00:00:00.000Z"),
    });

    await expect(
      service.tombstoneOccurrence(
        "00000000-0000-4000-8000-000000000010",
        "publisher_deleted",
        "delete-test",
      ),
    ).resolves.toMatchObject({ canonicalRemainsActive: true });
    expect(lifecycle.tombstoneOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "publisher_deleted", occurredAt: expect.any(Date) }),
    );
  });

  it("reconciles only through the completed-run repository boundary", async () => {
    const lifecycle: OpportunityLifecyclePort = {
      tombstoneOccurrence: vi.fn(async () => ({
        canonicalOpportunityId: "id",
        canonicalRemainsActive: false,
      })),
      expireDue: vi.fn(async () => 0),
      reconcileCompletedRun: vi.fn(async () => 3),
      purgeDue: vi.fn(async () => 0),
    };
    const service = new OpportunityLifecycleService(lifecycle, { now: () => new Date(0) });
    await expect(service.reconcileCompletedRun("run-1", "himalayas", "reconcile-1")).resolves.toBe(
      3,
    );
  });

  it("delegates bounded expiry and purge sweeps with a single clock reading", async () => {
    const now = new Date("2026-08-05T02:00:00.000Z");
    const lifecycle: OpportunityLifecyclePort = {
      tombstoneOccurrence: vi.fn(async () => ({
        canonicalOpportunityId: "id",
        canonicalRemainsActive: false,
      })),
      expireDue: vi.fn(async () => 7),
      reconcileCompletedRun: vi.fn(async () => 0),
      purgeDue: vi.fn(async () => 2),
    };
    const service = new OpportunityLifecycleService(lifecycle, { now: () => now });

    await expect(service.expireDue(25)).resolves.toBe(7);
    await expect(service.purgeDue(10)).resolves.toBe(2);
    expect(lifecycle.expireDue).toHaveBeenCalledWith({ limit: 25, occurredAt: now });
    expect(lifecycle.purgeDue).toHaveBeenCalledWith({ limit: 10, occurredAt: now });
  });
});
