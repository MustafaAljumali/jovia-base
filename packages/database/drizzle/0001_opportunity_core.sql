CREATE TABLE IF NOT EXISTS jovia_migration_checksums (
  name text PRIMARY KEY,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE source_registry DROP CONSTRAINT IF EXISTS source_registry_mechanism_check;
ALTER TABLE source_registry
  ADD CONSTRAINT source_registry_mechanism_check CHECK (
    mechanism IN (
      'official_api', 'licensed_feed', 'approved_partnership', 'rss',
      'user_authorized_import', 'manual_submission', 'unsupported'
    )
  );
ALTER TABLE source_registry
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'external'
    CHECK (scope IN ('external', 'first_party')),
  ADD COLUMN IF NOT EXISTS runtime_status text NOT NULL DEFAULT 'disabled'
    CHECK (runtime_status IN ('disabled', 'eligible', 'polling', 'rate_limited', 'stale', 'quarantined', 'circuit_open')),
  ADD COLUMN IF NOT EXISTS active_policy_id uuid,
  ADD COLUMN IF NOT EXISTS kill_switch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_poll_at timestamptz,
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_request_at timestamptz;

CREATE TABLE source_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES source_registry(id) ON DELETE RESTRICT,
  source_code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  scope text NOT NULL CHECK (scope IN ('external', 'first_party')),
  mechanism text NOT NULL CHECK (
    mechanism IN (
      'official_api', 'licensed_feed', 'approved_partnership', 'rss',
      'user_authorized_import', 'manual_submission', 'unsupported'
    )
  ),
  legal_posture text NOT NULL CHECK (legal_posture IN ('approved', 'conditional', 'blocked', 'unreviewed')),
  terms_url text NOT NULL,
  terms_snapshot_ref text NOT NULL,
  terms_snapshot_sha256 text NOT NULL CHECK (terms_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  attribution_required boolean NOT NULL,
  attribution_text text NOT NULL,
  attribution_source_url text NOT NULL,
  original_link_required boolean NOT NULL,
  logo_policy text NOT NULL CHECK (logo_policy IN ('text_only', 'approved_logo')),
  polling_floor_seconds integer NOT NULL CHECK (polling_floor_seconds > 0),
  maximum_concurrency integer NOT NULL CHECK (maximum_concurrency > 0),
  minimum_request_spacing_ms integer NOT NULL CHECK (minimum_request_spacing_ms >= 0),
  official_limit_requests integer CHECK (official_limit_requests > 0),
  official_limit_window_seconds integer CHECK (official_limit_window_seconds > 0),
  honor_retry_after boolean NOT NULL,
  retry_after_default_seconds integer NOT NULL CHECK (retry_after_default_seconds > 0),
  serving_ttl_seconds integer NOT NULL CHECK (serving_ttl_seconds >= 0),
  inactive_retention_days integer NOT NULL CHECK (inactive_retention_days >= 0),
  raw_payload_retention_days integer NOT NULL CHECK (raw_payload_retention_days >= 0),
  tombstone_sla_seconds integer NOT NULL CHECK (tombstone_sla_seconds >= 0),
  redistribution text NOT NULL CHECK (
    redistribution IN ('prohibited', 'first_party_only', 'attribution_permitted', 'licensed')
  ),
  content_modification jsonb NOT NULL CHECK (jsonb_typeof(content_modification) = 'object'),
  owner text NOT NULL,
  reliability_score smallint NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  verified_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until >= verified_at),
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, version),
  UNIQUE (source_code, version),
  CHECK (
    (official_limit_requests IS NULL AND official_limit_window_seconds IS NULL)
    OR (official_limit_requests IS NOT NULL AND official_limit_window_seconds IS NOT NULL)
  )
);

CREATE INDEX source_policy_versions_source_id_idx ON source_policy_versions (source_id);
CREATE INDEX source_policy_versions_current_idx ON source_policy_versions (source_code, version DESC);

CREATE TABLE source_policy_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL UNIQUE REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL,
  governance_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION jovia_prevent_source_policy_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'source policy versions are immutable';
END;
$$;

CREATE TRIGGER source_policy_versions_immutable
BEFORE UPDATE OR DELETE ON source_policy_versions
FOR EACH ROW EXECUTE FUNCTION jovia_prevent_source_policy_mutation();

CREATE TRIGGER source_policy_approvals_immutable
BEFORE UPDATE OR DELETE ON source_policy_approvals
FOR EACH ROW EXECUTE FUNCTION jovia_prevent_source_policy_mutation();

CREATE TABLE source_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES source_registry(id) ON DELETE RESTRICT,
  policy_id uuid REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  operation text NOT NULL,
  eligible boolean,
  reason text,
  actor_id uuid,
  correlation_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_audits_source_id_idx ON source_audits (source_id);
CREATE INDEX source_audits_policy_id_idx ON source_audits (policy_id);
CREATE INDEX source_audits_occurred_at_idx ON source_audits (occurred_at DESC);

CREATE TABLE publisher_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  publishing_terms_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE source_audits
  ADD CONSTRAINT source_audits_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth_actors(id) ON DELETE RESTRICT;

CREATE INDEX source_audits_actor_id_idx ON source_audits (actor_id);

CREATE TABLE auth_actor_capabilities (
  actor_id uuid NOT NULL REFERENCES auth_actors(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (
    capability IN (
      'profile:read', 'profile:write', 'source:read', 'source:enable',
      'opportunity:read', 'opportunity:publish', 'proposal:generate', 'admin:operate'
    )
  ),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, capability)
);

CREATE TABLE organization_memberships (
  actor_id uuid NOT NULL REFERENCES auth_actors(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES publisher_organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'publisher', 'administrator')),
  accepted_publishing_terms_version text,
  accepted_publishing_terms_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, organization_id)
);

CREATE INDEX organization_memberships_organization_id_idx ON organization_memberships (organization_id);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth_actors(id) ON DELETE CASCADE,
  opaque_token_sha256 text NOT NULL UNIQUE CHECK (opaque_token_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_actor_id_idx ON auth_sessions (actor_id);
CREATE INDEX auth_sessions_active_idx ON auth_sessions (opaque_token_sha256, expires_at)
WHERE revoked_at IS NULL;

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES source_registry(id) ON DELETE RESTRICT,
  policy_id uuid NOT NULL REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (
    status IN ('running', 'completed', 'partial', 'failed', 'superseded', 'quarantined', 'policy_denied', 'circuit_open', 'rate_limited')
  ),
  starting_checkpoint jsonb,
  final_checkpoint jsonb,
  pages_committed integer NOT NULL DEFAULT 0 CHECK (pages_committed >= 0),
  records_committed integer NOT NULL DEFAULT 0 CHECK (records_committed >= 0),
  correlation_id text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  superseded_by uuid REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ingestion_runs_source_id_started_idx ON ingestion_runs (source_id, started_at DESC);
CREATE INDEX ingestion_runs_policy_id_idx ON ingestion_runs (policy_id);
CREATE INDEX ingestion_runs_superseded_by_idx ON ingestion_runs (superseded_by);
CREATE INDEX ingestion_runs_history_idx ON ingestion_runs (started_at DESC, id DESC);

CREATE TABLE raw_payload_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES source_registry(id) ON DELETE RESTRICT,
  policy_id uuid NOT NULL REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  run_id uuid REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider = 's3-compatible'),
  bucket text NOT NULL,
  object_key text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  content_type text NOT NULL,
  stored_at timestamptz NOT NULL,
  retention_deadline timestamptz NOT NULL,
  purged_at timestamptz,
  UNIQUE (provider, bucket, object_key)
);

CREATE INDEX raw_payload_references_source_id_idx ON raw_payload_references (source_id);
CREATE INDEX raw_payload_references_policy_id_idx ON raw_payload_references (policy_id);
CREATE INDEX raw_payload_references_run_id_idx ON raw_payload_references (run_id);
CREATE INDEX raw_payload_references_retention_idx ON raw_payload_references (retention_deadline, id)
WHERE purged_at IS NULL;

CREATE TABLE ingestion_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  page_sequence integer NOT NULL CHECK (page_sequence >= 0),
  raw_payload_id uuid NOT NULL UNIQUE REFERENCES raw_payload_references(id) ON DELETE RESTRICT,
  page_sha256 text NOT NULL CHECK (page_sha256 ~ '^[a-f0-9]{64}$'),
  next_checkpoint jsonb NOT NULL CHECK (jsonb_typeof(next_checkpoint) = 'object'),
  record_count integer NOT NULL CHECK (record_count >= 0),
  committed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, page_sequence)
);

CREATE INDEX ingestion_pages_run_id_idx ON ingestion_pages (run_id);

CREATE TABLE connector_checkpoints (
  source_id uuid PRIMARY KEY REFERENCES source_registry(id) ON DELETE RESTRICT,
  policy_id uuid NOT NULL REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  last_committed_page_sha256 text CHECK (last_committed_page_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX connector_checkpoints_policy_id_idx ON connector_checkpoints (policy_id);

CREATE TABLE connector_leases (
  source_id uuid PRIMARY KEY REFERENCES source_registry(id) ON DELETE RESTRICT,
  policy_id uuid NOT NULL REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  lease_id uuid NOT NULL UNIQUE,
  owner_correlation_id text NOT NULL,
  acquired_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > acquired_at),
  released_at timestamptz
);

CREATE INDEX connector_leases_policy_id_idx ON connector_leases (policy_id);
CREATE INDEX connector_leases_expiry_idx ON connector_leases (expires_at)
WHERE released_at IS NULL;

CREATE TABLE quarantine_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES source_registry(id) ON DELETE RESTRICT,
  run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  raw_payload_id uuid NOT NULL REFERENCES raw_payload_references(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('decode_failed', 'schema_invalid', 'canonical_invalid', 'schema_changed')),
  safe_field_paths text[] NOT NULL,
  connector_version text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES auth_actors(id) ON DELETE RESTRICT,
  replayed_at timestamptz
);

CREATE INDEX quarantine_records_source_id_idx ON quarantine_records (source_id);
CREATE INDEX quarantine_records_run_id_idx ON quarantine_records (run_id);
CREATE INDEX quarantine_records_raw_payload_id_idx ON quarantine_records (raw_payload_id);
CREATE INDEX quarantine_records_released_by_idx ON quarantine_records (released_by);
CREATE INDEX quarantine_records_open_idx ON quarantine_records (created_at, id)
WHERE released_at IS NULL;

CREATE TABLE connector_circuits (
  source_id uuid PRIMARY KEY REFERENCES source_registry(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  opened_at timestamptz,
  half_open_after timestamptz,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_run_seen (
  run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES source_registry(id) ON DELETE RESTRICT,
  external_id text NOT NULL,
  PRIMARY KEY (run_id, source_id, external_id)
);

CREATE INDEX ingestion_run_seen_source_id_idx ON ingestion_run_seen (source_id);

CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_organization_id uuid REFERENCES publisher_organizations(id) ON DELETE RESTRICT,
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft', 'active', 'expired', 'filled', 'removed')),
  title text NOT NULL,
  description_html text NOT NULL,
  description_text text NOT NULL,
  employer_name text NOT NULL,
  employer_key text NOT NULL,
  engagement_type text NOT NULL CHECK (
    engagement_type IN ('full_time', 'part_time', 'contract', 'temporary', 'internship', 'freelance', 'project', 'unknown')
  ),
  experience_levels text[] NOT NULL,
  categories text[] NOT NULL,
  technologies text[] NOT NULL,
  languages text[] NOT NULL,
  location_raw text,
  country_codes text[] NOT NULL,
  timezone_restrictions text[] NOT NULL,
  remote boolean NOT NULL,
  compensation_kind text CHECK (
    compensation_kind IN ('hourly', 'daily', 'weekly', 'fortnightly', 'monthly', 'annual', 'project')
  ),
  compensation_minimum numeric,
  compensation_maximum numeric,
  compensation_currency text,
  compensation_source_period text,
  compensation_annual_minimum numeric,
  compensation_annual_maximum numeric,
  published_at timestamptz NOT NULL,
  source_updated_at timestamptz,
  expires_at timestamptz,
  deadline_at timestamptz,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  normalized_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  original_url text NOT NULL,
  application_url text NOT NULL,
  content_signature text NOT NULL CHECK (content_signature ~ '^[a-f0-9]{64}$'),
  canonical_opportunity_id uuid,
  deduplication_strategy text NOT NULL DEFAULT 'deterministic'
    CHECK (deduplication_strategy IN ('deterministic', 'semantic')),
  deletion_state text NOT NULL DEFAULT 'present' CHECK (deletion_state IN ('present', 'tombstoned', 'purged')),
  tombstone_reason text,
  tombstoned_at timestamptz,
  purge_eligible_at timestamptz,
  purged_at timestamptz,
  extension jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(extension) = 'object'),
  CHECK (compensation_minimum IS NULL OR compensation_minimum >= 0),
  CHECK (compensation_maximum IS NULL OR compensation_maximum >= 0),
  CHECK (
    compensation_minimum IS NULL OR compensation_maximum IS NULL
    OR compensation_minimum <= compensation_maximum
  )
);

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_canonical_opportunity_id_fkey
  FOREIGN KEY (canonical_opportunity_id) REFERENCES opportunities(id) ON DELETE RESTRICT;

CREATE INDEX opportunities_publisher_organization_id_idx ON opportunities (publisher_organization_id);
CREATE INDEX opportunities_canonical_opportunity_id_idx ON opportunities (canonical_opportunity_id);
CREATE INDEX opportunities_signature_published_idx ON opportunities (content_signature, published_at, id);
CREATE INDEX opportunities_active_published_idx ON opportunities (published_at DESC, id DESC)
WHERE lifecycle = 'active' AND deletion_state = 'present' AND purged_at IS NULL;
CREATE INDEX opportunities_expiry_idx ON opportunities (expires_at, id)
WHERE lifecycle = 'active' AND deletion_state = 'present' AND expires_at IS NOT NULL;
CREATE INDEX opportunities_purge_idx ON opportunities (purge_eligible_at, id)
WHERE deletion_state = 'tombstoned' AND purged_at IS NULL;

CREATE TABLE opportunity_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES source_registry(id) ON DELETE RESTRICT,
  policy_id uuid NOT NULL REFERENCES source_policy_versions(id) ON DELETE RESTRICT,
  external_id text NOT NULL,
  original_url text NOT NULL,
  raw_payload_id uuid NOT NULL REFERENCES raw_payload_references(id) ON DELETE RESTRICT,
  raw_sha256 text NOT NULL CHECK (raw_sha256 ~ '^[a-f0-9]{64}$'),
  fetched_at timestamptz NOT NULL,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  connector_version text NOT NULL,
  mapper_version text NOT NULL,
  normalization_version text NOT NULL,
  deletion_state text NOT NULL DEFAULT 'present' CHECK (deletion_state IN ('present', 'tombstoned', 'purged')),
  tombstone_reason text,
  tombstoned_at timestamptz,
  purge_eligible_at timestamptz,
  purged_at timestamptz,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  UNIQUE (source_id, external_id)
);

CREATE INDEX opportunity_provenance_opportunity_id_idx ON opportunity_provenance (opportunity_id);
CREATE INDEX opportunity_provenance_source_id_idx ON opportunity_provenance (source_id);
CREATE INDEX opportunity_provenance_policy_id_idx ON opportunity_provenance (policy_id);
CREATE INDEX opportunity_provenance_raw_payload_id_idx ON opportunity_provenance (raw_payload_id);
CREATE INDEX opportunity_provenance_ingestion_run_id_idx ON opportunity_provenance (ingestion_run_id);
CREATE INDEX opportunity_provenance_active_idx ON opportunity_provenance (opportunity_id, source_id)
WHERE deletion_state = 'present';

CREATE TABLE opportunity_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (
    action IN ('created', 'updated', 'duplicate_linked', 'tombstoned', 'expired', 'restored', 'purged')
  ),
  actor_id uuid REFERENCES auth_actors(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES source_registry(id) ON DELETE RESTRICT,
  correlation_id text NOT NULL,
  reason text NOT NULL,
  prior_state_sha256 text CHECK (prior_state_sha256 ~ '^[a-f0-9]{64}$'),
  resulting_state_sha256 text NOT NULL CHECK (resulting_state_sha256 ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX opportunity_audits_opportunity_id_idx ON opportunity_audits (opportunity_id, occurred_at);
CREATE INDEX opportunity_audits_actor_id_idx ON opportunity_audits (actor_id);
CREATE INDEX opportunity_audits_source_id_idx ON opportunity_audits (source_id);

CREATE TABLE opportunity_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth_actors(id) ON DELETE RESTRICT,
  publisher_organization_id uuid NOT NULL REFERENCES publisher_organizations(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE RESTRICT,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (actor_id, idempotency_key)
);

CREATE INDEX opportunity_idempotency_actor_id_idx ON opportunity_idempotency (actor_id);
CREATE INDEX opportunity_idempotency_publisher_organization_id_idx ON opportunity_idempotency (publisher_organization_id);
CREATE INDEX opportunity_idempotency_opportunity_id_idx ON opportunity_idempotency (opportunity_id);
CREATE INDEX opportunity_idempotency_expiry_idx ON opportunity_idempotency (expires_at);

CREATE TABLE opportunity_duplicate_links (
  canonical_opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  duplicate_opportunity_id uuid NOT NULL UNIQUE REFERENCES opportunities(id) ON DELETE RESTRICT,
  strategy text NOT NULL CHECK (strategy IN ('deterministic', 'semantic')),
  content_signature text NOT NULL CHECK (content_signature ~ '^[a-f0-9]{64}$'),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canonical_opportunity_id, duplicate_opportunity_id),
  CHECK (canonical_opportunity_id <> duplicate_opportunity_id)
);

CREATE INDEX opportunity_duplicate_links_duplicate_id_idx ON opportunity_duplicate_links (duplicate_opportunity_id);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'opportunity.discovered.v1', 'opportunity.updated.v1',
      'opportunity.tombstoned.v1', 'opportunity.expired.v1'
    )
  ),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  published_at timestamptz,
  dead_lettered_at timestamptz,
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_events_opportunity_id_idx ON outbox_events (opportunity_id);
CREATE INDEX outbox_events_pending_idx ON outbox_events (available_at, occurred_at, id)
WHERE published_at IS NULL AND dead_lettered_at IS NULL;

CREATE TABLE outbox_dispatch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome text NOT NULL CHECK (outcome IN ('published', 'retry_scheduled', 'dead_lettered')),
  error_category text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, attempt_number)
);

CREATE INDEX outbox_dispatch_attempts_event_id_idx ON outbox_dispatch_attempts (event_id);

INSERT INTO source_registry (
  id, code, name, mechanism, legal_posture, terms_url, attribution_rule,
  polling_floor_seconds, cache_ttl_seconds, redistribution_rule, owner,
  last_verified_at, enabled, scope, runtime_status, next_poll_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001', 'himalayas', 'Himalayas',
    'official_api', 'approved', 'https://himalayas.app/docs/remote-jobs-api',
    'Data sourced from Himalayas; preserve the original application link',
    86400, 86400, 'Prohibited outside the Jovia end-user experience',
    'integrations', '2026-08-05T00:00:00.000Z', false, 'external', 'disabled',
    '2026-08-05T00:00:00.000Z'
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'jovia-direct', 'Jovia Direct',
    'manual_submission', 'approved', 'https://jovia.dev/legal/opportunity-publishing',
    'Opportunity published through Jovia', 86400, 0, 'First-party publisher content only',
    'Jovia Opportunity Intelligence Domain', '2026-08-05T00:00:00.000Z', true,
    'first_party', 'eligible', NULL
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO source_policy_versions (
  id, source_id, source_code, version, scope, mechanism, legal_posture,
  terms_url, terms_snapshot_ref, terms_snapshot_sha256,
  attribution_required, attribution_text, attribution_source_url,
  original_link_required, logo_policy, polling_floor_seconds, maximum_concurrency,
  minimum_request_spacing_ms, official_limit_requests, official_limit_window_seconds,
  honor_retry_after, retry_after_default_seconds, serving_ttl_seconds,
  inactive_retention_days, raw_payload_retention_days, tombstone_sla_seconds,
  redistribution, content_modification, owner, reliability_score, verified_at,
  valid_until, approved_by, approved_at, created_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000002',
    (SELECT id FROM source_registry WHERE code = 'himalayas'),
    'himalayas', 1, 'external', 'official_api', 'approved',
    'https://himalayas.app/docs/remote-jobs-api',
    'docs/legal/sources/himalayas-2026-08-05.md',
    '5109851959bee07b0e8c8e26722194f3fef1dd68ff8bd4d689125961127a21c8',
    true, 'Data sourced from Himalayas', 'https://himalayas.app', true, 'text_only',
    86400, 1, 1000, NULL, NULL, true, 60, 86400, 90, 90, 300,
    'prohibited',
    '{"allowedFields":["description_sanitization","compensation_normalization","location_normalization","language_normalization","taxonomy_mapping"],"translationAllowed":false}'::jsonb,
    'integrations', 80, '2026-08-05T00:00:00.000Z', '2026-11-03T23:59:59.999Z',
    'Product Owner', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    (SELECT id FROM source_registry WHERE code = 'jovia-direct'),
    'jovia-direct', 1, 'first_party', 'manual_submission', 'approved',
    'https://jovia.dev/legal/opportunity-publishing',
    'docs/legal/sources/jovia-direct-2026-08-05.md',
    'a3f523319e05d424490e88dc646809a7039c43fa56919b4e0f5c2d24f189fd31',
    true, 'Opportunity published through Jovia', 'https://jovia.dev', true, 'text_only',
    86400, 1, 0, NULL, NULL, true, 60, 0, 90, 90, 0,
    'first_party_only',
    '{"allowedFields":["description_sanitization","compensation_normalization","location_normalization","language_normalization","taxonomy_mapping"],"translationAllowed":false}'::jsonb,
    'Jovia Opportunity Intelligence Domain', 100,
    '2026-08-05T00:00:00.000Z', '2027-08-05T23:59:59.999Z',
    'Product Owner', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z'
  );

INSERT INTO source_policy_approvals (id, policy_id, approved_by, approved_at, governance_note)
VALUES
  (
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000002', 'Product Owner',
    '2026-08-05T00:00:00.000Z',
    'Product Owner approval under the accepted Opportunity Core and Lawful Discovery specification.'
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000004', 'Product Owner',
    '2026-08-05T00:00:00.000Z',
    'Product Owner approval under the accepted Opportunity Core and Lawful Discovery specification.'
  );

UPDATE source_registry
SET active_policy_id = CASE code
  WHEN 'himalayas' THEN '10000000-0000-4000-8000-000000000002'::uuid
  WHEN 'jovia-direct' THEN '10000000-0000-4000-8000-000000000004'::uuid
END,
updated_at = now()
WHERE code IN ('himalayas', 'jovia-direct');

ALTER TABLE source_registry
  ADD CONSTRAINT source_registry_active_policy_id_fkey
  FOREIGN KEY (active_policy_id) REFERENCES source_policy_versions(id) ON DELETE RESTRICT;

CREATE INDEX source_registry_active_policy_id_idx ON source_registry (active_policy_id);
CREATE INDEX source_registry_due_poll_idx ON source_registry (next_poll_at, id)
WHERE enabled = true AND kill_switch = false AND scope = 'external';

INSERT INTO connector_circuits (source_id, state)
SELECT id, 'closed' FROM source_registry WHERE code IN ('himalayas', 'jovia-direct');
