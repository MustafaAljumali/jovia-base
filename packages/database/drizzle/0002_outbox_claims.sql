ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

CREATE INDEX outbox_events_claimable_idx ON outbox_events (available_at, claim_expires_at, occurred_at, id)
WHERE published_at IS NULL AND dead_lettered_at IS NULL;
