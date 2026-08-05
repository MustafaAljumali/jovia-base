import { createHash } from "node:crypto";

import type { RawPayloadReference } from "@jovia/contracts";
import type {
  ConnectorLease,
  ConnectorRun,
  ConnectorRuntimePorts,
  PageCommit,
} from "@jovia/opportunity-ingestion";
import type postgres from "postgres";

interface SourceRow {
  source_id: string;
  policy_id: string;
  checkpoint: unknown | null;
  raw_retention_days: number;
}

function asJson(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function hashState(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function eventPayload(input: {
  eventId: string;
  eventKey: string;
  type: "opportunity.discovered.v1" | "opportunity.updated.v1";
  occurredAt: Date;
  correlationId: string;
  opportunityId: string;
}) {
  return {
    eventId: input.eventId,
    eventKey: input.eventKey,
    type: input.type,
    occurredAt: input.occurredAt.toISOString(),
    correlationId: input.correlationId,
    opportunityId: input.opportunityId,
    lifecycle: "active" as const,
  };
}

async function sourceForRun(
  sql: postgres.TransactionSql,
  sourceCode: string,
  policyId: string,
): Promise<SourceRow> {
  const [source] = await sql<SourceRow[]>`
    SELECT s.id AS source_id, p.id AS policy_id, c.state AS checkpoint,
      p.raw_payload_retention_days AS raw_retention_days
    FROM source_registry s
    JOIN source_policy_versions p ON p.id = s.active_policy_id
    LEFT JOIN connector_checkpoints c ON c.source_id = s.id
    WHERE s.code = ${sourceCode} AND p.id = ${policyId}
    FOR UPDATE OF s
  `;
  if (!source) throw new Error("active source policy was not found");
  return source;
}

async function sourceById(
  sql: postgres.TransactionSql,
  sourceId: string,
  policyId: string,
): Promise<SourceRow> {
  const [source] = await sql<SourceRow[]>`
    SELECT s.id AS source_id, p.id AS policy_id, c.state AS checkpoint,
      p.raw_payload_retention_days AS raw_retention_days
    FROM source_registry s
    JOIN source_policy_versions p ON p.id = s.active_policy_id
    LEFT JOIN connector_checkpoints c ON c.source_id = s.id
    WHERE s.id = ${sourceId} AND p.id = ${policyId}
    FOR UPDATE OF s
  `;
  if (!source) throw new Error("active source policy was not found");
  return source;
}

async function registerRawPayload(
  sql: postgres.TransactionSql,
  source: SourceRow,
  runId: string,
  raw: RawPayloadReference,
): Promise<string> {
  const retentionDeadline = new Date(
    new Date(raw.storedAt).getTime() + source.raw_retention_days * 86_400_000,
  );
  const [stored] = await sql<{ id: string }[]>`
    INSERT INTO raw_payload_references (
      source_id, policy_id, run_id, provider, bucket, object_key, sha256,
      byte_length, content_type, stored_at, retention_deadline
    ) VALUES (
      ${source.source_id}, ${source.policy_id}, ${runId}, ${raw.provider}, ${raw.bucket},
      ${raw.objectKey}, ${raw.sha256}, ${raw.byteLength},
      ${raw.contentType ?? "application/octet-stream"}, ${new Date(raw.storedAt)},
      ${retentionDeadline}
    )
    ON CONFLICT (provider, bucket, object_key) DO UPDATE SET object_key = EXCLUDED.object_key
    RETURNING id
  `;
  if (!stored) throw new Error("raw payload reference was not persisted");
  return stored.id;
}

async function persistOpportunity(
  sql: postgres.TransactionSql,
  input: PageCommit,
  source: SourceRow,
  rawPayloadId: string,
  record: PageCommit["records"][number],
): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${record.contentSignature}, 0))`;
  const now = new Date(record.normalizedAt);
  const [existing] = await sql<{ opportunity_id: string }[]>`
    SELECT opportunity_id
    FROM opportunity_provenance
    WHERE source_id = ${source.source_id} AND external_id = ${record.externalId}
    LIMIT 1
  `;
  let opportunityId = existing?.opportunity_id;
  let eventType: "opportunity.discovered.v1" | "opportunity.updated.v1" = "opportunity.updated.v1";
  if (opportunityId) {
    await sql`
      UPDATE opportunities SET
        title = ${record.title}, description_html = ${record.descriptionHtml},
        description_text = ${record.descriptionText}, employer_name = ${record.employerName},
        employer_key = ${record.employerKey}, engagement_type = ${record.engagementType},
        experience_levels = ${record.experienceLevels}, categories = ${record.categories},
        technologies = ${record.technologies}, languages = ${record.languages},
        location_raw = ${record.location.raw ?? null}, country_codes = ${record.location.countryCodes},
        timezone_restrictions = ${record.location.timezoneRestrictions}, remote = ${record.location.remote},
        compensation_kind = ${record.compensation?.kind ?? null},
        compensation_minimum = ${record.compensation?.minimum ?? null},
        compensation_maximum = ${record.compensation?.maximum ?? null},
        compensation_currency = ${record.compensation?.currency ?? null},
        compensation_source_period = ${record.compensation?.sourcePeriod ?? null},
        compensation_annual_minimum = ${record.compensation?.annualizedMinimum ?? null},
        compensation_annual_maximum = ${record.compensation?.annualizedMaximum ?? null},
        source_updated_at = ${record.sourceUpdatedAt ? new Date(record.sourceUpdatedAt) : null},
        expires_at = ${record.expiresAt ? new Date(record.expiresAt) : null},
        deadline_at = ${record.deadlineAt ? new Date(record.deadlineAt) : null},
        last_seen_at = ${now}, normalized_at = ${now}, updated_at = ${now},
        original_url = ${record.originalUrl}, application_url = ${record.applicationUrl},
        content_signature = ${record.contentSignature}, deletion_state = 'present',
        tombstone_reason = NULL, tombstoned_at = NULL, purge_eligible_at = NULL,
        extension = ${sql.json(asJson(record.extension))}
      WHERE id = ${opportunityId}
    `;
    await sql`
      UPDATE opportunity_provenance SET
        policy_id = ${source.policy_id}, raw_payload_id = ${rawPayloadId},
        raw_sha256 = ${input.raw.sha256}, fetched_at = ${new Date(input.fetchedAt)},
        source_published_at = ${new Date(record.publishedAt)},
        source_updated_at = ${record.sourceUpdatedAt ? new Date(record.sourceUpdatedAt) : null},
        ingestion_run_id = ${input.runId}, connector_version = ${input.connectorVersion},
        mapper_version = ${input.mapperVersion}, normalization_version = ${input.normalizationVersion},
        deletion_state = 'present', tombstone_reason = NULL, tombstoned_at = NULL,
        purge_eligible_at = NULL, last_seen_at = ${now}
      WHERE source_id = ${source.source_id} AND external_id = ${record.externalId}
    `;
  } else {
    eventType = "opportunity.discovered.v1";
    const [inserted] = await sql<{ id: string }[]>`
      INSERT INTO opportunities (
        lifecycle, title, description_html, description_text, employer_name, employer_key,
        engagement_type, experience_levels, categories, technologies, languages,
        location_raw, country_codes, timezone_restrictions, remote,
        compensation_kind, compensation_minimum, compensation_maximum, compensation_currency,
        compensation_source_period, compensation_annual_minimum, compensation_annual_maximum,
        published_at, source_updated_at, expires_at, deadline_at, first_seen_at, last_seen_at,
        normalized_at, updated_at, original_url, application_url, content_signature,
        deduplication_strategy, deletion_state, extension
      ) VALUES (
        'active', ${record.title}, ${record.descriptionHtml}, ${record.descriptionText},
        ${record.employerName}, ${record.employerKey}, ${record.engagementType},
        ${record.experienceLevels}, ${record.categories}, ${record.technologies}, ${record.languages},
        ${record.location.raw ?? null}, ${record.location.countryCodes},
        ${record.location.timezoneRestrictions}, ${record.location.remote},
        ${record.compensation?.kind ?? null}, ${record.compensation?.minimum ?? null},
        ${record.compensation?.maximum ?? null}, ${record.compensation?.currency ?? null},
        ${record.compensation?.sourcePeriod ?? null},
        ${record.compensation?.annualizedMinimum ?? null},
        ${record.compensation?.annualizedMaximum ?? null}, ${new Date(record.publishedAt)},
        ${record.sourceUpdatedAt ? new Date(record.sourceUpdatedAt) : null},
        ${record.expiresAt ? new Date(record.expiresAt) : null},
        ${record.deadlineAt ? new Date(record.deadlineAt) : null}, ${now}, ${now}, ${now}, ${now},
        ${record.originalUrl}, ${record.applicationUrl}, ${record.contentSignature},
        'deterministic', 'present', ${sql.json(asJson(record.extension))}
      ) RETURNING id
    `;
    if (!inserted) throw new Error("opportunity insert failed");
    opportunityId = inserted.id;
    await sql`
      INSERT INTO opportunity_provenance (
        opportunity_id, source_id, policy_id, external_id, original_url, raw_payload_id,
        raw_sha256, fetched_at, source_published_at, source_updated_at, ingestion_run_id,
        connector_version, mapper_version, normalization_version, first_seen_at, last_seen_at
      ) VALUES (
        ${opportunityId}, ${source.source_id}, ${source.policy_id}, ${record.externalId},
        ${record.originalUrl}, ${rawPayloadId}, ${input.raw.sha256}, ${new Date(input.fetchedAt)},
        ${new Date(record.publishedAt)},
        ${record.sourceUpdatedAt ? new Date(record.sourceUpdatedAt) : null}, ${input.runId},
        ${input.connectorVersion}, ${input.mapperVersion}, ${input.normalizationVersion}, ${now}, ${now}
      )
    `;
    const [winner] = await sql<{ id: string }[]>`
      SELECT o.id
      FROM opportunities o
      JOIN opportunity_provenance pr ON pr.opportunity_id = o.id
      JOIN source_policy_versions p ON p.id = pr.policy_id
      WHERE o.content_signature = ${record.contentSignature}
        AND o.published_at BETWEEN ${new Date(new Date(record.publishedAt).getTime() - 86_400_000)}
          AND ${new Date(new Date(record.publishedAt).getTime() + 86_400_000)}
        AND o.deletion_state = 'present'
      ORDER BY (p.scope = 'first_party') DESC, p.reliability_score DESC, o.first_seen_at, o.id
      LIMIT 1
    `;
    const canonicalId = winner?.id ?? opportunityId;
    await sql`
      UPDATE opportunities
      SET canonical_opportunity_id = ${canonicalId}
      WHERE content_signature = ${record.contentSignature}
        AND published_at BETWEEN ${new Date(new Date(record.publishedAt).getTime() - 86_400_000)}
          AND ${new Date(new Date(record.publishedAt).getTime() + 86_400_000)}
        AND deletion_state = 'present'
    `;
    await sql`
      INSERT INTO opportunity_duplicate_links (
        canonical_opportunity_id, duplicate_opportunity_id, strategy, content_signature
      )
      SELECT ${canonicalId}, id, 'deterministic', ${record.contentSignature}
      FROM opportunities
      WHERE content_signature = ${record.contentSignature} AND id <> ${canonicalId}
        AND published_at BETWEEN ${new Date(new Date(record.publishedAt).getTime() - 86_400_000)}
          AND ${new Date(new Date(record.publishedAt).getTime() + 86_400_000)}
      ON CONFLICT (duplicate_opportunity_id) DO UPDATE
      SET canonical_opportunity_id = EXCLUDED.canonical_opportunity_id,
          strategy = EXCLUDED.strategy, content_signature = EXCLUDED.content_signature
    `;
    opportunityId = canonicalId;
  }
  const resultingHash = hashState({ opportunityId, signature: record.contentSignature, eventType });
  await sql`
    INSERT INTO opportunity_audits (
      opportunity_id, action, source_id, correlation_id, reason, resulting_state_sha256, occurred_at
    ) VALUES (
      ${opportunityId}, ${eventType === "opportunity.discovered.v1" ? "created" : "updated"},
      ${source.source_id}, ${input.correlationId}, 'source_ingestion', ${resultingHash}, ${now}
    )
  `;
  const [outbox] = await sql<{ id: string }[]>`SELECT gen_random_uuid() AS id`;
  if (!outbox) throw new Error("event id generation failed");
  const eventKey = `${record.sourceCode}:${record.externalId}:${eventType}:${record.contentSignature}`;
  const payload = eventPayload({
    eventId: outbox.id,
    eventKey,
    type: eventType,
    occurredAt: now,
    correlationId: input.correlationId,
    opportunityId,
  });
  await sql`
    INSERT INTO outbox_events (
      id, event_key, event_type, opportunity_id, payload, correlation_id, occurred_at
    ) VALUES (
      ${outbox.id}, ${eventKey}, ${eventType}, ${opportunityId}, ${sql.json(payload)},
      ${input.correlationId}, ${now}
    ) ON CONFLICT (event_key) DO NOTHING
  `;
  await sql`
    INSERT INTO ingestion_run_seen (run_id, source_id, external_id)
    VALUES (${input.runId}, ${source.source_id}, ${record.externalId})
    ON CONFLICT DO NOTHING
  `;
}

export class PostgresIngestionRepository {
  constructor(
    private readonly sql: postgres.Sql,
    private readonly leaseTtlMs = 300_000,
  ) {}

  readonly leases: ConnectorRuntimePorts["leases"] = {
    acquire: async (input): Promise<ConnectorLease | undefined> => {
      if (input.maximumConcurrency !== 1) {
        throw new Error("current connector lease schema requires maximumConcurrency=1");
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.leaseTtlMs);
      const [lease] = await this.sql<{ lease_id: string }[]>`
        INSERT INTO connector_leases (
          source_id, policy_id, lease_id, owner_correlation_id, acquired_at, expires_at
        )
        SELECT s.id, ${input.policyId}, gen_random_uuid(), ${input.correlationId}, ${now}, ${expiresAt}
        FROM source_registry s WHERE s.code = ${input.sourceCode}
        ON CONFLICT (source_id) DO UPDATE SET
          policy_id = EXCLUDED.policy_id, lease_id = EXCLUDED.lease_id,
          owner_correlation_id = EXCLUDED.owner_correlation_id,
          acquired_at = EXCLUDED.acquired_at, expires_at = EXCLUDED.expires_at, released_at = NULL
        WHERE connector_leases.released_at IS NOT NULL OR connector_leases.expires_at <= ${now}
        RETURNING lease_id
      `;
      return lease ? { id: lease.lease_id } : undefined;
    },
    release: async (lease): Promise<void> => {
      await this
        .sql`UPDATE connector_leases SET released_at = now() WHERE lease_id = ${lease.id} AND released_at IS NULL`;
    },
  };

  readonly runs: ConnectorRuntimePorts["runs"] = {
    start: async (input): Promise<ConnectorRun> => {
      return this.sql.begin(async (tx) => {
        const source = await sourceForRun(tx, input.sourceCode, input.policyId);
        const checkpoint = input.restartFromBeginning
          ? undefined
          : (source.checkpoint ?? undefined);
        const [run] = await tx<{ id: string }[]>`
          INSERT INTO ingestion_runs (
            source_id, policy_id, status, starting_checkpoint, correlation_id, started_at
          ) VALUES (
            ${source.source_id}, ${source.policy_id}, 'running',
            ${checkpoint === undefined ? null : tx.json(asJson(checkpoint))},
            ${input.correlationId}, ${input.startedAt}
          ) RETURNING id
        `;
        if (!run) throw new Error("ingestion run was not created");
        return { id: run.id, checkpoint };
      });
    },
    finish: async (runId, outcome, finishedAt): Promise<void> => {
      await this.sql.begin(async (tx) => {
        await tx`
          UPDATE ingestion_runs SET status = ${outcome}, finished_at = ${finishedAt},
            final_checkpoint = (
              SELECT c.state FROM connector_checkpoints c WHERE c.source_id = ingestion_runs.source_id
            )
          WHERE id = ${runId} AND status = 'running'
        `;
        if (outcome === "completed") {
          await tx`
            UPDATE source_registry s SET
              last_successful_run_at = ${finishedAt}, runtime_status = 'eligible',
              next_poll_at = ${finishedAt} + make_interval(secs => p.polling_floor_seconds),
              updated_at = ${finishedAt}
            FROM ingestion_runs r
            JOIN source_policy_versions p ON p.id = r.policy_id
            WHERE r.id = ${runId} AND s.id = r.source_id
          `;
        }
      });
    },
    recordSupersededPage: async (runId, raw, correlationId): Promise<void> => {
      await this.sql`
        INSERT INTO source_audits (source_id, policy_id, operation, correlation_id, details)
        SELECT source_id, policy_id, 'dataset_superseded', ${correlationId},
          ${this.sql.json({ rawObjectKey: raw.objectKey, rawSha256: raw.sha256 })}
        FROM ingestion_runs WHERE id = ${runId}
      `;
    },
  };

  readonly pageTransactions: ConnectorRuntimePorts["pageTransactions"] = {
    commit: async (input): Promise<void> => {
      await this.sql.begin(async (tx) => {
        const [alreadyCommitted] = await tx<{ id: string }[]>`
          SELECT id FROM ingestion_pages
          WHERE run_id = ${input.runId} AND page_sequence = ${input.pageSequence}
          FOR UPDATE
        `;
        if (alreadyCommitted) return;
        const source = await sourceById(tx, input.sourceId, input.policyId);
        const rawPayloadId = await registerRawPayload(tx, source, input.runId, input.raw);
        for (const record of input.records) {
          await persistOpportunity(tx, input, source, rawPayloadId, record);
        }
        await tx`
          INSERT INTO ingestion_pages (
            run_id, page_sequence, raw_payload_id, page_sha256, next_checkpoint, record_count
          ) VALUES (
            ${input.runId}, ${input.pageSequence}, ${rawPayloadId}, ${input.raw.sha256},
            ${tx.json(asJson(input.nextCheckpoint))}, ${input.records.length}
          )
        `;
        await tx`
          INSERT INTO connector_checkpoints (
            source_id, policy_id, state, last_committed_page_sha256, updated_at
          ) VALUES (
            ${source.source_id}, ${source.policy_id}, ${tx.json(asJson(input.nextCheckpoint))},
            ${input.raw.sha256}, ${new Date(input.fetchedAt)}
          )
          ON CONFLICT (source_id) DO UPDATE SET
            policy_id = EXCLUDED.policy_id, state = EXCLUDED.state,
            last_committed_page_sha256 = EXCLUDED.last_committed_page_sha256,
            updated_at = EXCLUDED.updated_at
        `;
        await tx`
          UPDATE ingestion_runs SET pages_committed = pages_committed + 1,
            records_committed = records_committed + ${input.records.length}
          WHERE id = ${input.runId} AND status = 'running'
        `;
      });
    },
  };

  readonly quarantine: ConnectorRuntimePorts["quarantine"] = {
    record: async (input): Promise<void> => {
      await this.sql.begin(async (tx) => {
        const [run] = await tx<SourceRow[]>`
          SELECT r.source_id, r.policy_id, NULL::jsonb AS checkpoint,
            p.raw_payload_retention_days AS raw_retention_days
          FROM ingestion_runs r JOIN source_policy_versions p ON p.id = r.policy_id
          WHERE r.id = ${input.runId}
        `;
        if (!run) throw new Error("ingestion run was not found for quarantine");
        const rawPayloadId = await registerRawPayload(tx, run, input.runId, input.raw);
        await tx`
          INSERT INTO quarantine_records (
            source_id, run_id, raw_payload_id, reason, safe_field_paths,
            connector_version, correlation_id
          ) VALUES (
            ${run.source_id}, ${input.runId}, ${rawPayloadId}, ${input.reason},
            ${[...input.safeFieldPaths]}, ${input.connectorVersion}, ${input.correlationId}
          )
        `;
        await tx`UPDATE ingestion_runs SET status = 'quarantined' WHERE id = ${input.runId}`;
        await tx`
          UPDATE source_registry SET runtime_status = 'quarantined', quarantined_at = now()
          WHERE id = ${run.source_id}
        `;
      });
    },
  };

  readonly circuits: ConnectorRuntimePorts["circuits"] = {
    recordRetryableFailure: async (sourceCode, at): Promise<void> => {
      await this.sql`
        UPDATE connector_circuits c SET
          consecutive_failures = c.consecutive_failures + 1,
          state = CASE WHEN c.consecutive_failures + 1 >= 5 THEN 'open' ELSE c.state END,
          opened_at = CASE WHEN c.consecutive_failures + 1 >= 5 THEN ${at} ELSE c.opened_at END,
          half_open_after = CASE WHEN c.consecutive_failures + 1 >= 5
            THEN ${new Date(at.getTime() + 300_000)} ELSE c.half_open_after END,
          version = c.version + 1, updated_at = ${at}
        FROM source_registry s WHERE s.id = c.source_id AND s.code = ${sourceCode}
      `;
    },
    recordSchemaFailure: async (sourceCode, at): Promise<void> => {
      await this.sql`
        UPDATE connector_circuits c SET state = 'open', opened_at = ${at},
          half_open_after = ${new Date(at.getTime() + 3_600_000)},
          consecutive_failures = c.consecutive_failures + 1,
          version = c.version + 1, updated_at = ${at}
        FROM source_registry s WHERE s.id = c.source_id AND s.code = ${sourceCode}
      `;
    },
    recordSuccess: async (sourceCode, at): Promise<void> => {
      await this.sql`
        UPDATE connector_circuits c SET state = 'closed', consecutive_failures = 0,
          opened_at = NULL, half_open_after = NULL, version = c.version + 1, updated_at = ${at}
        FROM source_registry s WHERE s.id = c.source_id AND s.code = ${sourceCode}
      `;
    },
  };

  async listRuns(limit = 100) {
    return this.sql<
      {
        id: string;
        sourceCode: string;
        policyId: string;
        status: string;
        pagesCommitted: number;
        recordsCommitted: number;
        correlationId: string;
        startedAt: Date;
        finishedAt: Date | null;
      }[]
    >`
      SELECT r.id, s.code AS "sourceCode", r.policy_id AS "policyId", r.status,
        r.pages_committed AS "pagesCommitted", r.records_committed AS "recordsCommitted",
        r.correlation_id AS "correlationId", r.started_at AS "startedAt",
        r.finished_at AS "finishedAt"
      FROM ingestion_runs r JOIN source_registry s ON s.id = r.source_id
      ORDER BY r.started_at DESC, r.id DESC LIMIT ${limit}
    `;
  }

  async listRawPayloadsDue(
    now: Date,
    limit = 100,
  ): Promise<readonly (RawPayloadReference & { id: string })[]> {
    const rows = await this.sql<
      {
        id: string;
        provider: "s3-compatible";
        bucket: string;
        objectKey: string;
        sha256: string;
        byteLength: number;
        contentType: string;
        storedAt: Date;
      }[]
    >`
      SELECT id, provider, bucket, object_key AS "objectKey", sha256,
        byte_length::int AS "byteLength", content_type AS "contentType", stored_at AS "storedAt"
      FROM raw_payload_references
      WHERE purged_at IS NULL AND retention_deadline <= ${now}
      ORDER BY retention_deadline, id
      LIMIT ${limit}
    `;
    return rows.map((row) => ({ ...row, storedAt: row.storedAt.toISOString() }));
  }

  async markRawPayloadPurged(id: string, purgedAt: Date): Promise<void> {
    await this.sql`
      UPDATE raw_payload_references SET purged_at = ${purgedAt}
      WHERE id = ${id} AND purged_at IS NULL
    `;
  }

  async operationalMetrics(now: Date) {
    const sources = await this.sql<
      {
        sourceCode: string;
        freshnessLagSeconds: number;
        tombstoneLagSeconds: number;
        quarantineCount: number;
        circuitState: "closed" | "open" | "half_open";
      }[]
    >`
      SELECT s.code AS "sourceCode",
        GREATEST(0, EXTRACT(EPOCH FROM (${now} - COALESCE(s.last_successful_run_at, s.created_at))))::float8
          AS "freshnessLagSeconds",
        COALESCE((
          SELECT GREATEST(0, MAX(EXTRACT(EPOCH FROM (${now} - pr.tombstoned_at))))::float8
          FROM opportunity_provenance pr WHERE pr.source_id = s.id AND pr.deletion_state = 'tombstoned'
        ), 0) AS "tombstoneLagSeconds",
        (SELECT count(*)::int FROM quarantine_records q WHERE q.source_id = s.id AND q.released_at IS NULL)
          AS "quarantineCount",
        c.state AS "circuitState"
      FROM source_registry s JOIN connector_circuits c ON c.source_id = s.id
      ORDER BY s.code
    `;
    const pending = await this.sql<{ eventType: string; count: number }[]>`
      SELECT event_type AS "eventType", count(*)::int AS count FROM outbox_events
      WHERE published_at IS NULL AND dead_lettered_at IS NULL GROUP BY event_type ORDER BY event_type
    `;
    return { sources, pendingOutbox: pending };
  }
}
