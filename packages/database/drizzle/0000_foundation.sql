CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  mechanism text NOT NULL CHECK (mechanism IN ('official_api', 'licensed_feed', 'approved_partnership', 'rss', 'unsupported')),
  legal_posture text NOT NULL CHECK (legal_posture IN ('approved', 'conditional', 'blocked', 'unreviewed')),
  terms_url text NOT NULL,
  attribution_rule text NOT NULL,
  polling_floor_seconds integer NOT NULL CHECK (polling_floor_seconds > 0),
  cache_ttl_seconds integer NOT NULL CHECK (cache_ttl_seconds >= 0),
  redistribution_rule text NOT NULL,
  owner text NOT NULL,
  last_verified_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  task text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL CHECK (total_tokens >= 0),
  cost_microusd bigint,
  success boolean NOT NULL,
  error_category text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_request_id_idx ON ai_usage_events (request_id);
CREATE INDEX IF NOT EXISTS ai_usage_events_occurred_at_idx ON ai_usage_events (occurred_at);
