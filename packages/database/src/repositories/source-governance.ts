import { SourceExecutionContextSchema, type SourceExecutionContext } from "@jovia/contracts";
import type {
  SourceAuditPort,
  SourceEligibilityAuditRecord,
  SourcePolicyRepository,
} from "@jovia/opportunity-ingestion";
import type postgres from "postgres";

interface ExecutionContextRow {
  source_id: string;
  source_code: string;
  source_name: string;
  source_scope: string;
  enabled: boolean;
  runtime_status: string;
  active_policy_id: string | null;
  next_poll_at: Date | null;
  quarantined_at: Date | null;
  last_successful_run_at: Date | null;
  policy_id: string;
  policy_version: number;
  mechanism: string;
  legal_posture: string;
  terms_url: string;
  terms_snapshot_ref: string;
  terms_snapshot_sha256: string;
  attribution_required: boolean;
  attribution_text: string;
  attribution_source_url: string;
  original_link_required: boolean;
  logo_policy: string;
  polling_floor_seconds: number;
  maximum_concurrency: number;
  minimum_request_spacing_ms: number;
  official_limit_requests: number | null;
  official_limit_window_seconds: number | null;
  honor_retry_after: boolean;
  retry_after_default_seconds: number;
  serving_ttl_seconds: number;
  inactive_retention_days: number;
  raw_payload_retention_days: number;
  tombstone_sla_seconds: number;
  redistribution: string;
  content_modification: unknown;
  owner: string;
  verified_at: Date;
  valid_until: Date;
  approved_by: string;
  approved_at: Date;
  policy_created_at: Date;
  approval_id: string | null;
  circuit_state: string;
  consecutive_failures: number;
  opened_at: Date | null;
  half_open_after: Date | null;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toExecutionContext(row: ExecutionContextRow): SourceExecutionContext {
  return SourceExecutionContextSchema.parse({
    source: {
      id: row.source_id,
      code: row.source_code,
      name: row.source_name,
      scope: row.source_scope,
      enabled: row.enabled,
      runtimeStatus: row.runtime_status,
      activePolicyId: row.active_policy_id,
      nextPollAt: iso(row.next_poll_at),
      quarantinedAt: iso(row.quarantined_at),
      lastSuccessfulRunAt: iso(row.last_successful_run_at),
    },
    policy: {
      id: row.policy_id,
      sourceCode: row.source_code,
      version: row.policy_version,
      scope: row.source_scope,
      mechanism: row.mechanism,
      legalPosture: row.legal_posture,
      termsUrl: row.terms_url,
      termsSnapshotRef: row.terms_snapshot_ref,
      termsSnapshotSha256: row.terms_snapshot_sha256,
      attribution: {
        required: row.attribution_required,
        displayText: row.attribution_text,
        sourceUrl: row.attribution_source_url,
        originalLinkRequired: row.original_link_required,
        logoPolicy: row.logo_policy,
      },
      polling: {
        pollingFloorSeconds: row.polling_floor_seconds,
        maximumConcurrency: row.maximum_concurrency,
        minimumRequestSpacingMs: row.minimum_request_spacing_ms,
        honorRetryAfter: row.honor_retry_after,
        retryAfterDefaultSeconds: row.retry_after_default_seconds,
        officialRequestLimit:
          row.official_limit_requests === null || row.official_limit_window_seconds === null
            ? null
            : {
                requests: row.official_limit_requests,
                windowSeconds: row.official_limit_window_seconds,
              },
      },
      retention: {
        servingTtlSeconds: row.serving_ttl_seconds,
        inactiveRetentionDays: row.inactive_retention_days,
        rawPayloadRetentionDays: row.raw_payload_retention_days,
        tombstoneSlaSeconds: row.tombstone_sla_seconds,
      },
      redistribution: row.redistribution,
      contentModification: row.content_modification,
      owner: row.owner,
      verifiedAt: row.verified_at.toISOString(),
      validUntil: row.valid_until.toISOString(),
      approvedBy: row.approved_by,
      approvedAt: row.approved_at.toISOString(),
      createdAt: row.policy_created_at.toISOString(),
    },
    circuit: {
      state: row.circuit_state,
      consecutiveFailures: row.consecutive_failures,
      openedAt: iso(row.opened_at),
      halfOpenAfter: iso(row.half_open_after),
    },
  });
}

export interface DueSource {
  sourceCode: string;
  policyVersion: number;
  nextPollAt: Date;
}

export class PostgresSourceGovernanceRepository implements SourcePolicyRepository, SourceAuditPort {
  constructor(private readonly sql: postgres.Sql) {}

  async getExecutionContext(sourceCode: string): Promise<SourceExecutionContext | undefined> {
    const [row] = await this.sql<ExecutionContextRow[]>`
      SELECT
        s.id AS source_id, s.code AS source_code, s.name AS source_name,
        s.scope AS source_scope, s.enabled, s.runtime_status, s.active_policy_id,
        s.next_poll_at, s.quarantined_at, s.last_successful_run_at,
        p.id AS policy_id, p.version AS policy_version, p.mechanism, p.legal_posture,
        p.terms_url, p.terms_snapshot_ref, p.terms_snapshot_sha256,
        p.attribution_required, p.attribution_text, p.attribution_source_url,
        p.original_link_required, p.logo_policy, p.polling_floor_seconds,
        p.maximum_concurrency, p.minimum_request_spacing_ms, p.official_limit_requests,
        p.official_limit_window_seconds, p.honor_retry_after, p.retry_after_default_seconds,
        p.serving_ttl_seconds, p.inactive_retention_days, p.raw_payload_retention_days,
        p.tombstone_sla_seconds, p.redistribution, p.content_modification, p.owner,
        p.verified_at, p.valid_until, p.approved_by, p.approved_at,
        p.created_at AS policy_created_at, a.id AS approval_id,
        c.state AS circuit_state, c.consecutive_failures, c.opened_at, c.half_open_after
      FROM source_registry s
      JOIN source_policy_versions p ON p.id = s.active_policy_id
      LEFT JOIN source_policy_approvals a ON a.policy_id = p.id
      JOIN connector_circuits c ON c.source_id = s.id
      WHERE s.code = ${sourceCode} AND a.id IS NOT NULL
      LIMIT 1
    `;
    return row ? toExecutionContext(row) : undefined;
  }

  async recordEligibilityDecision(record: SourceEligibilityAuditRecord): Promise<void> {
    const reason = record.decision.eligible ? "eligible" : record.decision.reason;
    await this.sql`
      INSERT INTO source_audits (
        source_id, policy_id, operation, eligible, reason, correlation_id, details, occurred_at
      )
      SELECT s.id, s.active_policy_id, ${record.operation}, ${record.decision.eligible},
        ${reason}, ${record.correlationId},
        ${this.sql.json({ sourceCode: record.sourceCode, decision: record.decision })},
        ${new Date(record.evaluatedAt)}
      FROM source_registry s
      WHERE s.code = ${record.sourceCode}
    `;
  }

  async listDueSources(now: Date, limit = 100): Promise<readonly DueSource[]> {
    return this.sql<DueSource[]>`
      SELECT s.code AS "sourceCode", p.version AS "policyVersion", s.next_poll_at AS "nextPollAt"
      FROM source_registry s
      JOIN source_policy_versions p ON p.id = s.active_policy_id
      JOIN source_policy_approvals a ON a.policy_id = p.id
      WHERE s.enabled = true AND s.kill_switch = false AND s.scope = 'external'
        AND s.runtime_status <> 'quarantined' AND p.legal_posture = 'approved'
        AND p.valid_until >= ${now} AND s.next_poll_at <= ${now}
      ORDER BY s.next_poll_at, s.id
      LIMIT ${limit}
    `;
  }

  async listSources(limit = 100): Promise<readonly SourceExecutionContext[]> {
    const rows = await this.sql<{ code: string }[]>`
      SELECT code FROM source_registry ORDER BY code LIMIT ${limit}
    `;
    const contexts = await Promise.all(rows.map(({ code }) => this.getExecutionContext(code)));
    return contexts.filter((context): context is SourceExecutionContext => context !== undefined);
  }
}
