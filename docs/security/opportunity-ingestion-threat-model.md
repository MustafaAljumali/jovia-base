---
document: Opportunity Ingestion Threat Model
version: 1.0.0
status: Implemented
authority: Security Architecture Evidence
ai_context: Read Before Opportunity Security Changes
read_before:
  - docs/architecture/opportunity-core-lawful-discovery.md
read_after:
  - docs/operations/opportunity-discovery-runbook.md
owner: Security Engineering
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity Ingestion Threat Model

| Threat | Control and evidence |
|---|---|
| Unlawful or unsupported collection | Immutable approved policy, executable fail-closed eligibility, kill switch, decision audit |
| SSRF and redirect abuse | Connector owns a fixed HTTPS endpoint; redirects rejected; downstream domains cannot schedule ingestion |
| Schema drift/poisoned payload | Private raw capture before parse, strict required fields, additive tolerance, quarantine and circuit open |
| Stored XSS | Allowlist HTML sanitizer, safe URL protocols, plain-text derivation, normalization tests |
| Credential or payload leakage | SDK isolated to object-storage package; logger redaction; private/no-store objects; no bodies in metrics/docs |
| Cross-tenant publication | Opaque session hash, explicit capability, organization membership/current terms, tenant mutation predicate |
| Authentication lookup exhaustion | Per-instance IP limiter before bearer database lookup plus distributed actor/route Redis limit after authentication |
| Replay/idempotency abuse | Actor-scoped key plus request digest; conflict on changed body; unique source identity and event key |
| Duplicate or lost events | Opportunity change and outbox insert are atomic; expiring claim token; attempt history; publish acknowledgement before mark |
| Race in deduplication | Transaction-scoped advisory signature lock and deterministic canonical priority |
| Accidental source over-polling | Policy floor and source limiter are independent of user matching/notification cadence |
| Incomplete-run deletion | Reconciliation accepts completed full runs only; seen identities and tombstones are durable |
| Retention failure | Object delete before database purge mark; retryable due query; content purge blocked by live raw reference |
| Policy expiry or stale evidence | `valid_until`, verification date, approval row, runtime metrics, and eligibility denial |

Security gates include strict TypeScript, ESLint, secret scanning, dependency audit,
architecture policy, CodeQL, migration checks, API authorization contracts, connector
fixtures, and PostgreSQL integration tests. No test adapter is described as a live
external integration.
