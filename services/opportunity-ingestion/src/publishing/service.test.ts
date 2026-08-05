import type {
  CanonicalOpportunity,
  DirectOpportunityCommand,
  RawPayloadReference,
} from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import type { NormalizedOpportunity } from "../normalization/normalize.js";
import type { EligibleSourceContext } from "../ports.js";
import {
  DirectOpportunityService,
  type DirectOpportunityServicePorts,
  type StoredIdempotentOpportunity,
} from "./service.js";

const command: DirectOpportunityCommand = {
  publisherOrganizationId: "00000000-0000-4000-8000-000000000010",
  publishingTermsVersion: "2026-08-05",
  title: "Senior Platform Engineer",
  descriptionHtml: "<p>Build Jovia</p>",
  employerName: "Jovia",
  engagementType: "contract",
  experienceLevels: ["senior"],
  categories: ["Engineering"],
  technologies: ["TypeScript"],
  languages: ["en"],
  location: { remote: true, countryCodes: ["IQ"], timezoneRestrictions: [] },
  compensation: { kind: "hourly", minimum: "50", maximum: "80", currency: "USD" },
  publishedAt: "2026-08-05T00:00:00.000Z",
  applicationUrl: "https://jovia.dev/opportunities/platform-engineer",
  extension: {},
};

const opportunity = { id: "00000000-0000-4000-8000-000000000020" } as CanonicalOpportunity;
const raw: RawPayloadReference = {
  provider: "s3-compatible",
  bucket: "test",
  objectKey: "direct/page.json",
  sha256: "a".repeat(64),
  byteLength: 10,
  storedAt: "2026-08-05T00:00:00.000Z",
};
const eligible = {
  context: { policy: { id: "00000000-0000-4000-8000-000000000002" } },
} as EligibleSourceContext;

function harness() {
  const idempotency = new Map<string, StoredIdempotentOpportunity>();
  const ports: DirectOpportunityServicePorts = {
    ownership: { requirePublisherMembership: vi.fn(async () => undefined) },
    eligibility: { require: vi.fn(async () => eligible) },
    rawPayloads: { put: vi.fn(async () => raw), delete: vi.fn(async () => undefined) },
    transactions: {
      findIdempotent: vi.fn(async (actorId, key) => idempotency.get(`${actorId}:${key}`)),
      commitCreate: vi.fn(async (input) => {
        idempotency.set(`${input.actor.id}:${input.idempotencyKey}`, {
          requestSha256: input.requestSha256,
          opportunity,
        });
        return opportunity;
      }),
      commitReplace: vi.fn(async () => opportunity),
      commitRemove: vi.fn(async () => opportunity),
    },
    normalize: vi.fn(() => ({ sourceCode: "jovia-direct" }) as NormalizedOpportunity),
    clock: { now: () => new Date("2026-08-05T00:00:00.000Z") },
  };
  return { ports, service: new DirectOpportunityService(ports) };
}

describe("DirectOpportunityService", () => {
  it("captures, normalizes and commits a direct publication exactly once on replay", async () => {
    const { ports, service } = harness();
    const actor = { id: "00000000-0000-4000-8000-000000000001" };
    const first = await service.create(actor, command, "publish-key-0001", "publish-test");
    const replay = await service.create(actor, command, "publish-key-0001", "publish-replay");

    expect(replay).toBe(first);
    expect(ports.ownership.requirePublisherMembership).toHaveBeenCalledTimes(2);
    expect(ports.eligibility.require).toHaveBeenCalledOnce();
    expect(ports.rawPayloads.put).toHaveBeenCalledOnce();
    expect(ports.normalize).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCode: "jovia-direct", title: command.title }),
      expect.objectContaining({ normalizedAt: expect.any(Date) }),
    );
    expect(ports.transactions.commitCreate).toHaveBeenCalledOnce();
  });

  it("rejects reuse of an idempotency key for a different command before raw capture", async () => {
    const { ports, service } = harness();
    const actor = { id: "00000000-0000-4000-8000-000000000001" };
    await service.create(actor, command, "publish-key-0002", "first");
    await expect(
      service.create(actor, { ...command, title: "Different title" }, "publish-key-0002", "second"),
    ).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });
    expect(ports.rawPayloads.put).toHaveBeenCalledOnce();
  });
});
