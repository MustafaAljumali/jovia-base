---
document: Opportunity Discovery Operations Runbook
version: 1.0.0
status: Implemented
authority: Production Operations Procedure
ai_context: Read Before Operating Opportunity Pipelines
read_before:
  - docs/architecture/opportunity-core-lawful-discovery.md
  - docs/security/opportunity-ingestion-threat-model.md
read_after: []
owner: Platform Operations
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity Discovery Operations Runbook

All investigation queries are read-only until the affected source, run, event, or
quarantine ID is known. Never print raw bodies, tokens, credentials, or presigned
URLs.

## Detect and contain

Inspect source freshness, runtime state, circuit, policy expiry, and next poll:

```sql
SELECT s.code, s.enabled, s.kill_switch, s.runtime_status, s.next_poll_at,
       s.last_successful_run_at, p.version, p.valid_until, c.state
FROM source_registry s
JOIN source_policy_versions p ON p.id = s.active_policy_id
JOIN connector_circuits c ON c.source_id = s.id
ORDER BY s.code;
```

If legality, attribution, schema safety, or unexpected traffic is uncertain, set
the exact source kill switch through the authorized operations path. Do not change
immutable policy rows. A new policy version and approval is required to resume
after policy change.

## Scenario procedures

- **Policy denied/expired:** confirm the eligibility audit reason; obtain a new
  legal verification and approval; create a new immutable version; activate it;
  clear the kill switch only after tests.
- **429/rate limit:** inspect `Retry-After`, source spacing metrics, and next poll.
  Do not increase polling. Matching can continue from stored data.
- **Circuit open/network failure:** confirm bounded retries and upstream health.
  Wait for half-open or use the authorized recovery path; never bypass the circuit.
- **Schema drift/quarantine:** inspect safe field paths and immutable raw reference,
  update and test the mapper, then release with `admin:operate` and a changed mapper
  version. The old raw object is replay input.
- **Checkpoint/restart:** restart the failed job. The connector resumes only from
  the last committed page; raw and checkpoint advancement are atomic.
- **Dataset superseded:** verify the old run is `superseded`; a single replacement
  run starts from zero. Superseded runs never tombstone unseen rows.
- **Stale or removed opportunity:** reconcile only a completed full run. Confirm
  other active provenance before the canonical record is tombstoned.
- **Outbox backlog:** inspect claim expiry, attempts, last safe error category, and
  dead letters. Expired claims are recoverable; never mark unpublished events as
  published.
- **Retention failure:** retry object deletion. Mark `raw_payload_references.purged_at`
  only after successful deletion; canonical purge waits for every raw reference.
- **Duplicate anomaly:** inspect signature, policy scope/reliability, and duplicate
  links. Do not silently apply semantic merging in Batch 2.

After remediation run `pnpm db:check`, the focused integration test, and the full
quality gate. Record correlation IDs and safe aggregate metrics in the incident;
do not copy private payloads.
