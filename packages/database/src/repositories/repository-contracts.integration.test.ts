import { createHash, randomUUID } from "node:crypto";

import type { RawPayloadReference } from "@jovia/contracts";
import type { NormalizedOpportunity, PageCommit } from "@jovia/opportunity-ingestion";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyMigrations } from "../../scripts/migrate.js";
import { PostgresAuthenticator, PostgresPublishingOwnershipRepository } from "./auth.js";
import { PostgresIngestionRepository } from "./ingestion.js";
import { PostgresOpportunityRepository } from "./opportunities.js";
import { PostgresOutboxRepository } from "./outbox.js";
import { PostgresSourceGovernanceRepository } from "./source-governance.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "true";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://jovia:jovia_local@127.0.0.1:5432/jovia";
const HIMALAYAS_SOURCE_ID = "10000000-0000-4000-8000-000000000001";
const HIMALAYAS_POLICY_ID = "10000000-0000-4000-8000-000000000002";

function normalized(externalId: string, signature: string): NormalizedOpportunity {
  return {
    externalId,
    sourceCode: "himalayas",
    sourcePolicyId: HIMALAYAS_POLICY_ID,
    title: `Platform Engineer ${externalId}`,
    descriptionHtml: "<p>Build reliable systems</p>",
    descriptionText: "Build reliable systems",
    employerName: "Jovia Test",
    employerKey: "jovia test",
    engagementType: "contract",
    experienceLevels: ["senior"],
    categories: ["engineering"],
    technologies: ["TypeScript"],
    languages: ["en"],
    location: { remote: true, countryCodes: ["IQ"], timezoneRestrictions: [] },
    compensation: {
      kind: "hourly",
      minimum: "50",
      maximum: "80",
      currency: "USD",
      sourcePeriod: "hourly",
      annualizedMinimum: "104000",
      annualizedMaximum: "166400",
    },
    publishedAt: "2026-08-05T00:00:00.000Z",
    sourceUpdatedAt: null,
    expiresAt: null,
    deadlineAt: null,
    originalUrl: `https://himalayas.app/jobs/${externalId}`,
    applicationUrl: `https://himalayas.app/jobs/${externalId}`,
    normalizedAt: "2026-08-05T01:00:00.000Z",
    contentSignature: signature,
    deduplicationStrategy: "deterministic",
    extension: {},
  };
}

function raw(runId: string, suffix: string): RawPayloadReference {
  return {
    provider: "s3-compatible",
    bucket: "integration-raw",
    objectKey: `himalayas/2026/08/05/${runId}/${suffix}.json`,
    sha256: createHash("sha256").update(`${runId}:${suffix}`).digest("hex"),
    byteLength: 42,
    contentType: "application/json",
    storedAt: "2026-08-05T01:00:00.000Z",
  };
}

function pageCommit(
  runId: string,
  pageSequence: number,
  record: NormalizedOpportunity,
  nextCheckpoint: unknown,
): PageCommit {
  return {
    runId,
    sourceId: HIMALAYAS_SOURCE_ID,
    policyId: HIMALAYAS_POLICY_ID,
    pageSequence,
    raw: raw(runId, String(pageSequence)),
    records: [record],
    nextCheckpoint,
    correlationId: `integration-${runId}`,
    connectorVersion: "himalayas/1.0.0",
    mapperVersion: "himalayas/1.0.0",
    normalizationVersion: "opportunity-normalizer/1.0.0",
    fetchedAt: "2026-08-05T01:00:00.000Z",
  };
}

describe.runIf(enabled)("PostgreSQL opportunity repository contracts", () => {
  const sql = postgres(databaseUrl, { max: 8, prepare: false });
  const ingestion = new PostgresIngestionRepository(sql);
  const opportunities = new PostgresOpportunityRepository(sql);

  beforeAll(async () => {
    await applyMigrations(databaseUrl);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("rolls opportunity, provenance, audit, checkpoint and outbox back together", async () => {
    const externalId = `rollback-${randomUUID()}`;
    const signature = createHash("sha256").update(externalId).digest("hex");
    const run = await ingestion.runs.start({
      sourceCode: "himalayas",
      policyId: HIMALAYAS_POLICY_ID,
      correlationId: externalId,
      startedAt: new Date("2026-08-05T01:00:00.000Z"),
    });

    await expect(
      ingestion.pageTransactions.commit(
        pageCommit(run.id, 0, normalized(externalId, signature), []),
      ),
    ).rejects.toThrow();
    const [counts] = await sql<
      {
        opportunities: number;
        provenance: number;
        audits: number;
        checkpoints: number;
        outbox: number;
      }[]
    >`
      SELECT
        (SELECT count(*)::int FROM opportunities WHERE content_signature = ${signature}) AS opportunities,
        (SELECT count(*)::int FROM opportunity_provenance WHERE external_id = ${externalId}) AS provenance,
        (SELECT count(*)::int FROM opportunity_audits a JOIN opportunities o ON o.id = a.opportunity_id
          WHERE o.content_signature = ${signature}) AS audits,
        (SELECT count(*)::int FROM connector_checkpoints WHERE last_committed_page_sha256 = ${raw(run.id, "0").sha256}) AS checkpoints,
        (SELECT count(*)::int FROM outbox_events WHERE event_key LIKE ${`%${externalId}%`}) AS outbox
    `;
    expect(counts).toEqual({
      opportunities: 0,
      provenance: 0,
      audits: 0,
      checkpoints: 0,
      outbox: 0,
    });
  });

  it("serializes exact-signature deduplication and resumes from committed checkpoints", async () => {
    const seed = randomUUID();
    const signature = createHash("sha256").update(seed).digest("hex");
    const runA = await ingestion.runs.start({
      sourceCode: "himalayas",
      policyId: HIMALAYAS_POLICY_ID,
      correlationId: `${seed}-a`,
      startedAt: new Date("2026-08-05T01:00:00.000Z"),
    });
    const runB = await ingestion.runs.start({
      sourceCode: "himalayas",
      policyId: HIMALAYAS_POLICY_ID,
      correlationId: `${seed}-b`,
      startedAt: new Date("2026-08-05T01:00:01.000Z"),
    });
    await Promise.all([
      ingestion.pageTransactions.commit(
        pageCommit(runA.id, 0, normalized(`${seed}-a`, signature), { offset: 20 }),
      ),
      ingestion.pageTransactions.commit(
        pageCommit(runB.id, 0, normalized(`${seed}-b`, signature), { offset: 40 }),
      ),
    ]);
    const occurrences = await sql<{ canonical_opportunity_id: string }[]>`
      SELECT o.canonical_opportunity_id
      FROM opportunities o JOIN opportunity_provenance pr ON pr.opportunity_id = o.id
      WHERE pr.external_id IN (${`${seed}-a`}, ${`${seed}-b`})
    `;
    expect(occurrences).toHaveLength(2);
    expect(
      new Set(occurrences.map(({ canonical_opportunity_id }) => canonical_opportunity_id)).size,
    ).toBe(1);
    const resumed = await ingestion.runs.start({
      sourceCode: "himalayas",
      policyId: HIMALAYAS_POLICY_ID,
      correlationId: `${seed}-resume`,
      startedAt: new Date("2026-08-05T01:01:00.000Z"),
    });
    expect(resumed.checkpoint).toEqual({ offset: 40 });
  });

  it("persists direct publication provenance and authenticates tenant-scoped publishers", async () => {
    const actorId = randomUUID();
    const organizationId = randomUUID();
    const opaqueToken = `integration-token-${randomUUID()}-${randomUUID()}`;
    await sql.begin(async (tx) => {
      await tx`INSERT INTO auth_actors (id) VALUES (${actorId})`;
      await tx`
        INSERT INTO publisher_organizations (id, name, publishing_terms_version)
        VALUES (${organizationId}, 'Integration Publisher', '2026-08-05')
      `;
      await tx`
        INSERT INTO organization_memberships (
          actor_id, organization_id, role, accepted_publishing_terms_version,
          accepted_publishing_terms_at
        ) VALUES (${actorId}, ${organizationId}, 'publisher', '2026-08-05', now())
      `;
      await tx`
        INSERT INTO auth_actor_capabilities (actor_id, capability)
        VALUES (${actorId}, 'opportunity:publish')
      `;
      await tx`
        INSERT INTO auth_sessions (actor_id, opaque_token_sha256, expires_at)
        VALUES (
          ${actorId}, ${createHash("sha256").update(opaqueToken).digest("hex")},
          now() + interval '1 hour'
        )
      `;
    });
    const authenticator = new PostgresAuthenticator(sql, { now: () => new Date() });
    await expect(authenticator.authenticate(opaqueToken)).resolves.toMatchObject({ id: actorId });
    const ownership = new PostgresPublishingOwnershipRepository(sql);
    await expect(
      ownership.requirePublisherMembership(actorId, organizationId, "2026-08-05"),
    ).resolves.toBeUndefined();

    const governance = new PostgresSourceGovernanceRepository(sql);
    const source = await governance.getExecutionContext("jovia-direct");
    if (!source) throw new Error("jovia-direct source context is missing");
    const externalId = `direct-${randomUUID()}`;
    const signature = createHash("sha256").update(externalId).digest("hex");
    const normalizedDirect: NormalizedOpportunity = {
      ...normalized(externalId, signature),
      sourceCode: "jovia-direct",
      sourcePolicyId: source.policy.id,
    };
    const result = await opportunities.commitCreate({
      actor: { id: actorId },
      idempotencyKey: `direct-key-${randomUUID()}`,
      requestSha256: createHash("sha256").update(externalId).digest("hex"),
      command: {
        publisherOrganizationId: organizationId,
        publishingTermsVersion: "2026-08-05",
        title: normalizedDirect.title,
        descriptionHtml: normalizedDirect.descriptionHtml,
        employerName: normalizedDirect.employerName,
        engagementType: normalizedDirect.engagementType,
        experienceLevels: normalizedDirect.experienceLevels,
        categories: normalizedDirect.categories,
        technologies: normalizedDirect.technologies,
        languages: normalizedDirect.languages,
        location: normalizedDirect.location,
        publishedAt: normalizedDirect.publishedAt,
        applicationUrl: normalizedDirect.applicationUrl,
        extension: {},
      },
      source: {
        decision: { eligible: true, sourceCode: "jovia-direct", policyId: source.policy.id },
        context: source,
      },
      raw: raw(`direct-${actorId}`, externalId),
      normalized: normalizedDirect,
      correlationId: externalId,
    });
    expect(result).toMatchObject({
      publisherOrganizationId: organizationId,
      attribution: { source: "jovia-direct" },
      provenance: [expect.objectContaining({ externalId })],
    });
  });

  it("claims outbox rows once and preserves failed events for retry", async () => {
    const repository = new PostgresOutboxRepository(sql, 60_000);
    const [opportunity] = await sql<{ id: string }[]>`
      SELECT id FROM opportunities ORDER BY updated_at DESC LIMIT 1
    `;
    if (!opportunity) throw new Error("outbox opportunity fixture is missing");
    const eventId = randomUUID();
    const eventKey = `integration-outbox-${eventId}`;
    const event = {
      eventId,
      eventKey,
      type: "opportunity.updated.v1" as const,
      occurredAt: new Date().toISOString(),
      correlationId: eventKey,
      opportunityId: opportunity.id,
      lifecycle: "active" as const,
    };
    await sql`
      INSERT INTO outbox_events (
        id, event_key, event_type, opportunity_id, payload, correlation_id, occurred_at, available_at
      ) VALUES (
        ${eventId}, ${eventKey}, ${event.type}, ${opportunity.id}, ${sql.json(event)},
        ${eventKey}, ${new Date(event.occurredAt)}, ${new Date(0)}
      )
    `;
    const [claimed] = await repository.claim(1, new Date());
    if (!claimed) throw new Error("outbox row was not claimed");
    await repository.scheduleRetry({
      id: claimed.id,
      claimToken: claimed.claimToken,
      attemptNumber: claimed.attemptNumber,
      availableAt: new Date(0),
      errorCategory: "integration_retry",
      attemptedAt: new Date(),
    });
    const [retried] = await repository.claim(1, new Date());
    expect(retried).toMatchObject({ id: eventId, attemptNumber: 2 });
    if (!retried) throw new Error("outbox retry was not claimed");
    await repository.markPublished(
      retried.id,
      retried.claimToken,
      retried.attemptNumber,
      new Date(),
    );
    expect(await repository.claim(1, new Date())).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: eventId })]),
    );
  });
});
