---
document: Opportunity Core and Lawful Discovery Architecture
version: 1.0.0
status: Implemented
authority: Product Owner Approved Batch 2 Specification
ai_context: Always Read for Opportunity Work
read_before:
  - docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
  - docs/adr/ADR-0001-production-monorepo-foundation.md
read_after:
  - docs/api/opportunities-v1.md
  - docs/operations/opportunity-discovery-runbook.md
owner: Opportunity Intelligence Domain
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity Core and Lawful Discovery

This Batch 2 slice is the durable foundation for future scoring, matching, memory,
recommendation, and notifications. Those layers consume versioned canonical events;
they do not poll sources and do not bypass source governance.

## Runtime boundaries

```text
approved policy -> eligibility audit -> lease -> source rate limit -> fetch
  -> private raw storage -> schema validation -> normalization -> deterministic lock
  -> opportunity + provenance + audit + checkpoint + outbox (one transaction)
  -> versioned event consumers

authorized publisher -> ownership + terms + idempotency -> private raw storage
  -> the same normalization, deduplication, provenance, audit, lifecycle and outbox model
```

The `source_registry` identity is mutable operational state. Each
`source_policy_versions` row and approval is immutable evidence. Execution fails
closed unless the active policy has an approval, permitted mechanism, current legal
verification, attribution, polling, retention, redistribution, ownership, and
verification metadata. A kill switch, quarantine state, open circuit, or future
poll time also denies execution and produces an audit record.

Himalayas is the first implemented external connector. It uses only the documented
`GET https://himalayas.app/jobs/api?offset=<n>&limit=20` contract, preserves the
application link and attribution, rejects redirects, stores bytes before parsing,
and tolerates only additive response fields. It is seeded **disabled**, so the
connector's existence is never represented as an active connection.

Jovia Direct is the first-party source. Publisher membership, capability, current
publishing-terms acceptance, source eligibility, and organization-scoped database
predicates are all required. Replays return the original response only when the
request digest is identical.

## Consistency and extension points

- Source/external identity and unique event keys make replays idempotent.
- A transaction advisory lock on the deterministic content signature serializes
  exact deduplication. First-party scope, policy reliability, first-seen time, and
  ID form a stable canonical tie-breaker.
- `DeduplicationStrategy.kind` reserves `semantic` without changing the storage or
  public contract. Batch 2 performs deterministic matching only.
- Opportunity, provenance, audit, checkpoint, seen identity, and outbox changes are
  atomic. HTTP, object storage, and event publication never occur inside that
  transaction.
- Outbox claims use `FOR UPDATE SKIP LOCKED`, an expiring claim token, attempt
  history, bounded retry, and dead-letter state.
- Matching and notification jobs may re-score already collected records frequently.
  Only the policy scheduler can enqueue source polling, and it uses `next_poll_at`
  plus the immutable source-specific floor.
- Completed full runs may reconcile unseen occurrences. Partial, failed,
  superseded, quarantined, denied, rate-limited, or circuit-open runs may not.

Raw payloads are private, encrypted, non-cacheable objects with a content digest.
Retention deletes the object before marking its database reference purged. Canonical
content cannot be purged while any provenance raw reference is still retained.
