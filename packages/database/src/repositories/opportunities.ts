import { createHash } from "node:crypto";

import {
  AppError,
  CanonicalOpportunitySchema,
  type CanonicalOpportunity,
  type OpportunityEvent,
} from "@jovia/contracts";
import type {
  DirectOpportunityTransactionPort,
  OpportunityLifecyclePort,
  StoredIdempotentOpportunity,
} from "@jovia/opportunity-ingestion";
import type { NormalizedOpportunity } from "@jovia/opportunity-ingestion";
import type postgres from "postgres";

interface OpportunityRow {
  id: string;
  publisher_organization_id: string | null;
  lifecycle: string;
  title: string;
  description_html: string;
  description_text: string;
  employer_name: string;
  employer_key: string;
  engagement_type: string;
  experience_levels: string[];
  categories: string[];
  technologies: string[];
  languages: string[];
  location_raw: string | null;
  country_codes: string[];
  timezone_restrictions: string[];
  remote: boolean;
  compensation_kind: string | null;
  compensation_minimum: string | null;
  compensation_maximum: string | null;
  compensation_currency: string | null;
  compensation_source_period: string | null;
  compensation_annual_minimum: string | null;
  compensation_annual_maximum: string | null;
  published_at: Date;
  source_updated_at: Date | null;
  expires_at: Date | null;
  deadline_at: Date | null;
  first_seen_at: Date;
  last_seen_at: Date;
  normalized_at: Date;
  updated_at: Date;
  original_url: string;
  application_url: string;
  content_signature: string;
  canonical_opportunity_id: string;
  deduplication_strategy: string;
  deletion_state: string;
  tombstone_reason: string | null;
  tombstoned_at: Date | null;
  purge_eligible_at: Date | null;
  purged_at: Date | null;
  extension: unknown;
}

interface ProvenanceRow {
  id: string;
  source_code: string;
  source_name: string;
  policy_id: string;
  external_id: string;
  original_url: string;
  object_key: string;
  raw_sha256: string;
  fetched_at: Date;
  source_published_at: Date | null;
  source_updated_at: Date | null;
  ingestion_run_id: string;
  connector_version: string;
  mapper_version: string;
  normalization_version: string;
  deletion_state: string;
  tombstoned_at: Date | null;
  purged_at: Date | null;
  attribution_text: string;
  attribution_source_url: string;
}

interface DirectSourceRow {
  source_id: string;
  policy_id: string;
  raw_retention_days: number;
}

function asJson(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function stateDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function compensation(row: OpportunityRow) {
  if (!row.compensation_kind || !row.compensation_currency || !row.compensation_source_period) {
    return null;
  }
  return {
    kind: row.compensation_kind,
    ...(row.compensation_minimum === null ? {} : { minimum: row.compensation_minimum }),
    ...(row.compensation_maximum === null ? {} : { maximum: row.compensation_maximum }),
    currency: row.compensation_currency,
    sourcePeriod: row.compensation_source_period,
    ...(row.compensation_annual_minimum === null
      ? {}
      : { annualizedMinimum: row.compensation_annual_minimum }),
    ...(row.compensation_annual_maximum === null
      ? {}
      : { annualizedMaximum: row.compensation_annual_maximum }),
  };
}

async function directSource(sql: postgres.TransactionSql): Promise<DirectSourceRow> {
  const [source] = await sql<DirectSourceRow[]>`
    SELECT s.id AS source_id, p.id AS policy_id,
      p.raw_payload_retention_days AS raw_retention_days
    FROM source_registry s
    JOIN source_policy_versions p ON p.id = s.active_policy_id
    WHERE s.code = 'jovia-direct'
    FOR UPDATE OF s
  `;
  if (!source) throw new Error("jovia-direct active policy is missing");
  return source;
}

async function createDirectRun(
  sql: postgres.Sql | postgres.TransactionSql,
  source: DirectSourceRow,
  correlationId: string,
  now: Date,
): Promise<string> {
  const [run] = await sql<{ id: string }[]>`
    INSERT INTO ingestion_runs (
      source_id, policy_id, status, starting_checkpoint, final_checkpoint,
      pages_committed, records_committed, correlation_id, started_at, finished_at
    ) VALUES (
      ${source.source_id}, ${source.policy_id}, 'completed', '{}'::jsonb, '{}'::jsonb,
      1, 1, ${correlationId}, ${now}, ${now}
    ) RETURNING id
  `;
  if (!run) throw new Error("direct ingestion run was not created");
  return run.id;
}

async function registerDirectRaw(
  sql: postgres.TransactionSql,
  source: DirectSourceRow,
  runId: string,
  raw: Parameters<DirectOpportunityTransactionPort["commitCreate"]>[0]["raw"],
): Promise<string> {
  const retention = new Date(
    new Date(raw.storedAt).getTime() + source.raw_retention_days * 86_400_000,
  );
  const [stored] = await sql<{ id: string }[]>`
    INSERT INTO raw_payload_references (
      source_id, policy_id, run_id, provider, bucket, object_key, sha256,
      byte_length, content_type, stored_at, retention_deadline
    ) VALUES (
      ${source.source_id}, ${source.policy_id}, ${runId}, ${raw.provider}, ${raw.bucket},
      ${raw.objectKey}, ${raw.sha256}, ${raw.byteLength},
      ${raw.contentType ?? "application/json"}, ${new Date(raw.storedAt)}, ${retention}
    )
    ON CONFLICT (provider, bucket, object_key) DO UPDATE SET object_key = EXCLUDED.object_key
    RETURNING id
  `;
  if (!stored) throw new Error("direct raw payload reference was not persisted");
  return stored.id;
}

async function storeOutbox(
  sql: postgres.Sql | postgres.TransactionSql,
  type: OpportunityEvent["type"],
  opportunityId: string,
  lifecycle: OpportunityEvent["lifecycle"],
  eventKey: string,
  correlationId: string,
  occurredAt: Date,
): Promise<void> {
  const [eventId] = await sql<{ id: string }[]>`SELECT gen_random_uuid() AS id`;
  if (!eventId) throw new Error("event id generation failed");
  const event: OpportunityEvent = {
    eventId: eventId.id,
    eventKey,
    type,
    occurredAt: occurredAt.toISOString(),
    correlationId,
    opportunityId,
    lifecycle,
  };
  await sql`
    INSERT INTO outbox_events (
      id, event_key, event_type, opportunity_id, payload, correlation_id, occurred_at
    ) VALUES (
      ${event.eventId}, ${eventKey}, ${type}, ${opportunityId}, ${sql.json(event)},
      ${correlationId}, ${occurredAt}
    ) ON CONFLICT (event_key) DO NOTHING
  `;
}

async function insertNormalized(
  sql: postgres.TransactionSql,
  normalized: NormalizedOpportunity,
  publisherOrganizationId: string,
  source: DirectSourceRow,
  runId: string,
  rawPayloadId: string,
  rawSha256: string,
  correlationId: string,
): Promise<string> {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${normalized.contentSignature}, 0))`;
  const now = new Date(normalized.normalizedAt);
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO opportunities (
      publisher_organization_id, lifecycle, title, description_html, description_text,
      employer_name, employer_key, engagement_type, experience_levels, categories,
      technologies, languages, location_raw, country_codes, timezone_restrictions, remote,
      compensation_kind, compensation_minimum, compensation_maximum, compensation_currency,
      compensation_source_period, compensation_annual_minimum, compensation_annual_maximum,
      published_at, source_updated_at, expires_at, deadline_at, first_seen_at, last_seen_at,
      normalized_at, updated_at, original_url, application_url, content_signature,
      deduplication_strategy, deletion_state, extension
    ) VALUES (
      ${publisherOrganizationId}, 'active', ${normalized.title}, ${normalized.descriptionHtml},
      ${normalized.descriptionText}, ${normalized.employerName}, ${normalized.employerKey},
      ${normalized.engagementType}, ${normalized.experienceLevels}, ${normalized.categories},
      ${normalized.technologies}, ${normalized.languages}, ${normalized.location.raw ?? null},
      ${normalized.location.countryCodes}, ${normalized.location.timezoneRestrictions},
      ${normalized.location.remote}, ${normalized.compensation?.kind ?? null},
      ${normalized.compensation?.minimum ?? null}, ${normalized.compensation?.maximum ?? null},
      ${normalized.compensation?.currency ?? null},
      ${normalized.compensation?.sourcePeriod ?? null},
      ${normalized.compensation?.annualizedMinimum ?? null},
      ${normalized.compensation?.annualizedMaximum ?? null}, ${new Date(normalized.publishedAt)},
      ${normalized.sourceUpdatedAt ? new Date(normalized.sourceUpdatedAt) : null},
      ${normalized.expiresAt ? new Date(normalized.expiresAt) : null},
      ${normalized.deadlineAt ? new Date(normalized.deadlineAt) : null}, ${now}, ${now}, ${now}, ${now},
      ${normalized.originalUrl}, ${normalized.applicationUrl}, ${normalized.contentSignature},
      'deterministic', 'present', ${sql.json(asJson(normalized.extension))}
    ) RETURNING id
  `;
  if (!created) throw new Error("direct opportunity was not created");
  await sql`
    INSERT INTO opportunity_provenance (
      opportunity_id, source_id, policy_id, external_id, original_url, raw_payload_id,
      raw_sha256, fetched_at, source_published_at, source_updated_at, ingestion_run_id,
      connector_version, mapper_version, normalization_version, first_seen_at, last_seen_at
    ) VALUES (
      ${created.id}, ${source.source_id}, ${source.policy_id}, ${normalized.externalId},
      ${normalized.originalUrl}, ${rawPayloadId}, ${rawSha256}, ${now},
      ${new Date(normalized.publishedAt)},
      ${normalized.sourceUpdatedAt ? new Date(normalized.sourceUpdatedAt) : null}, ${runId},
      'jovia-direct/1.0.0', 'jovia-direct/1.0.0', 'opportunity-normalizer/1.0.0', ${now}, ${now}
    )
  `;
  const [winner] = await sql<{ id: string }[]>`
    SELECT o.id
    FROM opportunities o
    JOIN opportunity_provenance pr ON pr.opportunity_id = o.id
    JOIN source_policy_versions p ON p.id = pr.policy_id
    WHERE o.content_signature = ${normalized.contentSignature}
      AND o.published_at BETWEEN ${new Date(new Date(normalized.publishedAt).getTime() - 86_400_000)}
        AND ${new Date(new Date(normalized.publishedAt).getTime() + 86_400_000)}
      AND o.deletion_state = 'present'
    ORDER BY (p.scope = 'first_party') DESC, p.reliability_score DESC, o.first_seen_at, o.id
    LIMIT 1
  `;
  const canonicalId = winner?.id ?? created.id;
  await sql`
    UPDATE opportunities SET canonical_opportunity_id = ${canonicalId}
    WHERE content_signature = ${normalized.contentSignature}
      AND published_at BETWEEN ${new Date(new Date(normalized.publishedAt).getTime() - 86_400_000)}
        AND ${new Date(new Date(normalized.publishedAt).getTime() + 86_400_000)}
      AND deletion_state = 'present'
  `;
  await sql`
    INSERT INTO opportunity_duplicate_links (
      canonical_opportunity_id, duplicate_opportunity_id, strategy, content_signature
    )
    SELECT ${canonicalId}, id, 'deterministic', ${normalized.contentSignature}
    FROM opportunities
    WHERE content_signature = ${normalized.contentSignature} AND id <> ${canonicalId}
      AND published_at BETWEEN ${new Date(new Date(normalized.publishedAt).getTime() - 86_400_000)}
        AND ${new Date(new Date(normalized.publishedAt).getTime() + 86_400_000)}
    ON CONFLICT (duplicate_opportunity_id) DO UPDATE
    SET canonical_opportunity_id = EXCLUDED.canonical_opportunity_id,
        strategy = EXCLUDED.strategy, content_signature = EXCLUDED.content_signature
  `;
  await sql`
    INSERT INTO opportunity_audits (
      opportunity_id, action, actor_id, source_id, correlation_id, reason,
      resulting_state_sha256, occurred_at
    ) VALUES (
      ${created.id}, 'created', NULL, ${source.source_id}, ${correlationId},
      'direct_publication', ${stateDigest({ id: created.id, canonicalId, signature: normalized.contentSignature })}, ${now}
    )
  `;
  await storeOutbox(
    sql,
    "opportunity.discovered.v1",
    canonicalId,
    "active",
    `jovia-direct:${normalized.externalId}:discovered`,
    correlationId,
    now,
  );
  await sql`
    INSERT INTO ingestion_pages (
      run_id, page_sequence, raw_payload_id, page_sha256, next_checkpoint, record_count
    ) VALUES (
      ${runId}, 0, ${rawPayloadId}, ${rawSha256},
      ${sql.json({ directExternalId: normalized.externalId })}, 1
    )
  `;
  return canonicalId;
}

export class PostgresOpportunityRepository
  implements DirectOpportunityTransactionPort, OpportunityLifecyclePort
{
  constructor(private readonly sql: postgres.Sql) {}

  async getById(id: string): Promise<CanonicalOpportunity | undefined> {
    const [row] = await this.sql<OpportunityRow[]>`SELECT * FROM opportunities WHERE id = ${id}`;
    if (!row) return undefined;
    const provenance = await this.sql<ProvenanceRow[]>`
      SELECT pr.id, s.code AS source_code, s.name AS source_name, pr.policy_id,
        pr.external_id, pr.original_url, raw.object_key, pr.raw_sha256, pr.fetched_at,
        pr.source_published_at, pr.source_updated_at, pr.ingestion_run_id,
        pr.connector_version, pr.mapper_version, pr.normalization_version,
        pr.deletion_state, pr.tombstoned_at, pr.purged_at,
        p.attribution_text, p.attribution_source_url
      FROM opportunity_provenance pr
      JOIN source_registry s ON s.id = pr.source_id
      JOIN source_policy_versions p ON p.id = pr.policy_id
      JOIN raw_payload_references raw ON raw.id = pr.raw_payload_id
      WHERE pr.opportunity_id = ${id}
      ORDER BY pr.first_seen_at, pr.id
    `;
    const primary = provenance[0];
    if (!primary) throw new Error("opportunity provenance is missing");
    return CanonicalOpportunitySchema.parse({
      id: row.id,
      publisherOrganizationId: row.publisher_organization_id,
      lifecycle: row.lifecycle,
      title: row.title,
      descriptionHtml: row.description_html,
      descriptionText: row.description_text,
      employerName: row.employer_name,
      employerKey: row.employer_key,
      engagementType: row.engagement_type,
      experienceLevels: row.experience_levels,
      categories: row.categories,
      technologies: row.technologies,
      languages: row.languages,
      location: {
        remote: row.remote,
        ...(row.location_raw === null ? {} : { raw: row.location_raw }),
        countryCodes: row.country_codes,
        timezoneRestrictions: row.timezone_restrictions,
      },
      compensation: compensation(row),
      publishedAt: row.published_at.toISOString(),
      sourceUpdatedAt: iso(row.source_updated_at),
      expiresAt: iso(row.expires_at),
      deadlineAt: iso(row.deadline_at),
      firstSeenAt: row.first_seen_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      normalizedAt: row.normalized_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      originalUrl: row.original_url,
      applicationUrl: row.application_url,
      contentSignature: row.content_signature,
      canonicalOpportunityId: row.canonical_opportunity_id,
      deduplicationStrategy: row.deduplication_strategy,
      deletionState: row.deletion_state,
      tombstoneReason: row.tombstone_reason,
      tombstonedAt: iso(row.tombstoned_at),
      purgeEligibleAt: iso(row.purge_eligible_at),
      purgedAt: iso(row.purged_at),
      extension: row.extension,
      attribution: {
        source: primary.source_code,
        sourceName: primary.source_name,
        attributionText: primary.attribution_text,
        sourceUrl: primary.attribution_source_url,
        originalUrl: primary.original_url,
      },
      provenance: provenance.map((item) => ({
        id: item.id,
        sourceCode: item.source_code,
        sourcePolicyId: item.policy_id,
        externalId: item.external_id,
        originalUrl: item.original_url,
        rawObjectKey: item.object_key,
        rawSha256: item.raw_sha256,
        fetchedAt: item.fetched_at.toISOString(),
        sourcePublishedAt: iso(item.source_published_at),
        sourceUpdatedAt: iso(item.source_updated_at),
        ingestionRunId: item.ingestion_run_id,
        connectorVersion: item.connector_version,
        mapperVersion: item.mapper_version,
        normalizationVersion: item.normalization_version,
        deletionState: item.deletion_state,
        tombstonedAt: iso(item.tombstoned_at),
        purgedAt: iso(item.purged_at),
      })),
    });
  }

  async listActive(input: {
    limit: number;
    cursor?: { publishedAt: Date; id: string };
  }): Promise<readonly CanonicalOpportunity[]> {
    const rows = input.cursor
      ? await this.sql<{ id: string }[]>`
          SELECT id FROM opportunities
          WHERE lifecycle = 'active' AND deletion_state = 'present'
            AND canonical_opportunity_id = id
            AND (published_at, id) < (${input.cursor.publishedAt}, ${input.cursor.id})
          ORDER BY published_at DESC, id DESC LIMIT ${input.limit}
        `
      : await this.sql<{ id: string }[]>`
          SELECT id FROM opportunities
          WHERE lifecycle = 'active' AND deletion_state = 'present'
            AND canonical_opportunity_id = id
          ORDER BY published_at DESC, id DESC LIMIT ${input.limit}
        `;
    const results = await Promise.all(rows.map(({ id }) => this.getById(id)));
    return results.filter((item): item is CanonicalOpportunity => item !== undefined);
  }

  async findIdempotent(
    actorId: string,
    idempotencyKey: string,
  ): Promise<StoredIdempotentOpportunity | undefined> {
    const [record] = await this.sql<{ request_sha256: string; opportunity_id: string }[]>`
      SELECT request_sha256, opportunity_id
      FROM opportunity_idempotency
      WHERE actor_id = ${actorId} AND idempotency_key = ${idempotencyKey}
        AND expires_at > now() AND opportunity_id IS NOT NULL
      LIMIT 1
    `;
    if (!record) return undefined;
    const opportunity = await this.getById(record.opportunity_id);
    return opportunity ? { requestSha256: record.request_sha256, opportunity } : undefined;
  }

  async commitCreate(
    input: Parameters<DirectOpportunityTransactionPort["commitCreate"]>[0],
  ): Promise<CanonicalOpportunity> {
    const opportunityId = await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.actor.id}:${input.idempotencyKey}`}, 0))`;
      const [replay] = await tx<{ request_sha256: string; opportunity_id: string | null }[]>`
        SELECT request_sha256, opportunity_id FROM opportunity_idempotency
        WHERE actor_id = ${input.actor.id} AND idempotency_key = ${input.idempotencyKey}
      `;
      if (replay) {
        if (replay.request_sha256 !== input.requestSha256 || !replay.opportunity_id) {
          throw new AppError({
            code: "idempotency_conflict",
            status: 409,
            title: "Idempotency conflict",
          });
        }
        return replay.opportunity_id;
      }
      const source = await directSource(tx);
      const now = new Date(input.normalized.normalizedAt);
      const runId = await createDirectRun(tx, source, input.correlationId, now);
      const rawPayloadId = await registerDirectRaw(tx, source, runId, input.raw);
      const canonicalId = await insertNormalized(
        tx,
        input.normalized,
        input.command.publisherOrganizationId,
        source,
        runId,
        rawPayloadId,
        input.raw.sha256,
        input.correlationId,
      );
      await tx`
        INSERT INTO opportunity_idempotency (
          actor_id, publisher_organization_id, idempotency_key, request_sha256,
          opportunity_id, response_status, response_body, expires_at
        ) VALUES (
          ${input.actor.id}, ${input.command.publisherOrganizationId}, ${input.idempotencyKey},
          ${input.requestSha256}, ${canonicalId}, 201,
          ${tx.json({ opportunityId: canonicalId })}, ${new Date(now.getTime() + 86_400_000)}
        )
      `;
      return canonicalId;
    });
    const opportunity = await this.getById(opportunityId);
    if (!opportunity) throw new Error("committed opportunity could not be loaded");
    return opportunity;
  }

  async commitReplace(
    input: Parameters<DirectOpportunityTransactionPort["commitReplace"]>[0],
  ): Promise<CanonicalOpportunity> {
    const [owned] = await this.sql<{ id: string }[]>`
      SELECT id FROM opportunities
      WHERE id = ${input.opportunityId}
        AND publisher_organization_id = ${input.command.publisherOrganizationId}
        AND deletion_state = 'present'
    `;
    if (!owned) {
      throw new AppError({ code: "not_found", status: 404, title: "Opportunity not found" });
    }
    const replacement = await this.commitCreate(input);
    await this.sql`
      UPDATE opportunities SET lifecycle = 'removed', deletion_state = 'tombstoned',
        tombstone_reason = 'publisher_replaced', tombstoned_at = now()
      WHERE id = ${input.opportunityId}
        AND publisher_organization_id = ${input.command.publisherOrganizationId}
        AND id <> ${replacement.id}
    `;
    return replacement;
  }

  async commitRemove(
    input: Parameters<DirectOpportunityTransactionPort["commitRemove"]>[0],
  ): Promise<CanonicalOpportunity> {
    const [updated] = await this.sql<{ id: string }[]>`
      UPDATE opportunities SET lifecycle = 'removed', deletion_state = 'tombstoned',
        tombstone_reason = 'publisher_deleted', tombstoned_at = now(),
        purge_eligible_at = now() + interval '90 days', updated_at = now()
      WHERE id = ${input.opportunityId}
        AND publisher_organization_id = ${input.organizationId}
        AND deletion_state = 'present'
      RETURNING id
    `;
    if (!updated)
      throw new AppError({ code: "not_found", status: 404, title: "Opportunity not found" });
    await storeOutbox(
      this.sql,
      "opportunity.tombstoned.v1",
      updated.id,
      "removed",
      `jovia-direct:${updated.id}:removed`,
      input.correlationId,
      new Date(),
    );
    const result = await this.getById(updated.id);
    if (!result) throw new Error("removed opportunity could not be loaded");
    return result;
  }

  async tombstoneOccurrence(
    input: Parameters<OpportunityLifecyclePort["tombstoneOccurrence"]>[0],
  ): Promise<{ canonicalOpportunityId: string; canonicalRemainsActive: boolean }> {
    return this.sql.begin(async (tx) => {
      const [occurrence] = await tx<{ opportunity_id: string; canonical_id: string }[]>`
        SELECT pr.opportunity_id, o.canonical_opportunity_id AS canonical_id
        FROM opportunity_provenance pr JOIN opportunities o ON o.id = pr.opportunity_id
        WHERE pr.id = ${input.provenanceId} FOR UPDATE OF pr, o
      `;
      if (!occurrence)
        throw new AppError({ code: "not_found", status: 404, title: "Provenance not found" });
      await tx`
        UPDATE opportunity_provenance SET deletion_state = 'tombstoned',
          tombstone_reason = ${input.reason}, tombstoned_at = ${input.occurredAt},
          purge_eligible_at = ${new Date(input.occurredAt.getTime() + 90 * 86_400_000)}
        WHERE id = ${input.provenanceId} AND deletion_state = 'present'
      `;
      const [active] = await tx<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM opportunity_provenance pr
          JOIN opportunities o ON o.id = pr.opportunity_id
          WHERE o.canonical_opportunity_id = ${occurrence.canonical_id}
            AND pr.deletion_state = 'present'
        ) AS exists
      `;
      const remains = active?.exists ?? false;
      if (!remains) {
        await tx`
          UPDATE opportunities SET lifecycle = 'removed', deletion_state = 'tombstoned',
            tombstone_reason = ${input.reason}, tombstoned_at = ${input.occurredAt},
            purge_eligible_at = ${new Date(input.occurredAt.getTime() + 90 * 86_400_000)}
          WHERE canonical_opportunity_id = ${occurrence.canonical_id}
        `;
        await storeOutbox(
          tx,
          "opportunity.tombstoned.v1",
          occurrence.canonical_id,
          "removed",
          `${occurrence.canonical_id}:tombstoned:${input.reason}`,
          input.correlationId,
          input.occurredAt,
        );
      }
      return { canonicalOpportunityId: occurrence.canonical_id, canonicalRemainsActive: remains };
    });
  }

  async expireDue(input: { limit: number; occurredAt: Date }): Promise<number> {
    const expired = await this.sql<{ id: string }[]>`
      WITH due AS (
        SELECT id FROM opportunities
        WHERE lifecycle = 'active' AND deletion_state = 'present' AND expires_at <= ${input.occurredAt}
        ORDER BY expires_at, id FOR UPDATE SKIP LOCKED LIMIT ${input.limit}
      )
      UPDATE opportunities o SET lifecycle = 'expired', updated_at = ${input.occurredAt}
      FROM due WHERE o.id = due.id RETURNING o.id
    `;
    for (const row of expired) {
      await storeOutbox(
        this.sql,
        "opportunity.expired.v1",
        row.id,
        "expired",
        `${row.id}:expired`,
        "expiry-sweep",
        input.occurredAt,
      );
    }
    return expired.length;
  }

  async reconcileCompletedRun(
    input: Parameters<OpportunityLifecyclePort["reconcileCompletedRun"]>[0],
  ): Promise<number> {
    const [run] = await this.sql<{ source_id: string; status: string }[]>`
      SELECT r.source_id, r.status FROM ingestion_runs r
      JOIN source_registry s ON s.id = r.source_id
      WHERE r.id = ${input.runId} AND s.code = ${input.sourceCode}
    `;
    if (!run || run.status !== "completed") return 0;
    const stale = await this.sql<{ id: string }[]>`
      UPDATE opportunity_provenance pr SET deletion_state = 'tombstoned',
        tombstone_reason = 'source_removed', tombstoned_at = ${input.occurredAt},
        purge_eligible_at = ${new Date(input.occurredAt.getTime() + 90 * 86_400_000)}
      WHERE pr.source_id = ${run.source_id} AND pr.deletion_state = 'present'
        AND NOT EXISTS (
          SELECT 1 FROM ingestion_run_seen seen
          WHERE seen.run_id = ${input.runId} AND seen.source_id = pr.source_id
            AND seen.external_id = pr.external_id
        )
      RETURNING pr.id
    `;
    return stale.length;
  }

  async purgeDue(input: { limit: number; occurredAt: Date }): Promise<number> {
    const purged = await this.sql`
      WITH due AS (
        SELECT id FROM opportunities
        WHERE deletion_state = 'tombstoned' AND purge_eligible_at <= ${input.occurredAt}
        ORDER BY purge_eligible_at, id FOR UPDATE SKIP LOCKED LIMIT ${input.limit}
      )
      UPDATE opportunities o SET deletion_state = 'purged', purged_at = ${input.occurredAt},
        description_html = '', description_text = '', extension = '{}'::jsonb
      FROM due WHERE o.id = due.id RETURNING o.id
    `;
    return purged.length;
  }
}
