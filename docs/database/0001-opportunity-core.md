---
document: Opportunity Core Database Migrations
version: 1.0.0
status: Implemented
authority: Product Owner Approved Batch 2 Specification
ai_context: Read Before Opportunity Schema Changes
read_before:
  - docs/architecture/opportunity-core-lawful-discovery.md
read_after:
  - docs/operations/opportunity-discovery-runbook.md
owner: Data Platform
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity Core Database Migrations

`0001_opportunity_core.sql` is the forward-only domain migration. It adds immutable
source policies and approvals, source audits, publisher/auth records, ingestion
runs and pages, raw references, checkpoints, leases, quarantine, circuits, seen
identities, canonical opportunities, provenance, audits, idempotency, duplicate
links, and the transactional outbox. `0002_outbox_claims.sql` adds expiring claim
ownership without mutating the applied migration.

Every migration is discovered lexically, hashed with SHA-256, recorded in
`jovia_migration_checksums`, and rejected if applied content changes. The runner is
transactional and safe to repeat. It adopts the pre-ledger `0000` foundation only
after confirming that foundation tables exist.

CI proves:

- fresh application to PostgreSQL 16 with pgvector;
- application twice with no duplicate effects;
- checksum mismatch fail-closed behavior;
- required tables, constraints, foreign-key indexes, and partial indexes;
- exact seed state: Himalayas disabled, Jovia Direct eligible;
- transaction rollback and concurrent deterministic deduplication;
- checkpoint resume and outbox claim/retry behavior.

Use `pnpm db:migrate` followed by `pnpm db:check`. Never edit an applied migration;
add the next numbered forward migration and its repeat/checksum tests.
