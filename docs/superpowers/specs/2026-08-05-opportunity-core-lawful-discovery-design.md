---
document: Opportunity Core and Lawful Discovery Design
version: 1.0.0
status: Approved for Implementation
authority: Product Owner Approved Delivery Design
ai_context: Read Before Opportunity Ingestion, Source, or Publishing Work
read_before:
  - Jovia_Engineering_Constitution_v2.0.md
  - docs/adr/ADR-0001-production-monorepo-foundation.md
  - Jovia_Technical_Research_and_Integration_Blueprint.docx
  - docs/architecture/first-delivery-foundation.md
read_after:
  - docs/superpowers/plans/2026-08-05-opportunity-core-lawful-discovery.md
owner: Jovia Opportunity Intelligence Domain
approved_by: Product Owner
approval_date: 2026-08-05
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity Core & Lawful Discovery

## 1. Decision and Outcome

This delivery creates the first production vertical slice of Jovia's opportunity
intelligence system. It turns source legality into an executable invariant,
implements the first real external connector for Himalayas, accepts first-party
Jovia opportunities, and routes both through one normalization, provenance,
deduplication, lifecycle, persistence, audit, and outbox pipeline.

The slice follows the approved **Integrated Production Slices** strategy. It does
not add scoring, personalized matching, semantic deduplication, or user
notifications. It emits versioned outbox events that those later slices consume.

The accepted modular-monolith boundary remains unchanged:

```text
apps/api       -> opportunity application interfaces -> ports
apps/worker    -> connector runner and lifecycle jobs -> ports
database       -> PostgreSQL adapters for application ports
Himalayas HTTP -> adapter-specific runtime validation -> canonical raw record
```

No new independently deployed microservice is introduced. No Manus code, asset,
runtime, environment variable, or brand enters the dependency graph.

## 2. Governing Invariants

1. An external source cannot make a network request unless it is enabled and its
   latest immutable policy version is complete, approved, current, and permits
   the requested mechanism and operation.
2. Source eligibility is evaluated immediately before work is leased. A queue
   message, feature flag, administrator role, or stale prior approval cannot
   bypass the decision.
3. Source polling cadence comes only from the approved source policy. User-facing
   matching, re-ranking, and notification cadence is a separate downstream
   concern and cannot reduce an upstream polling floor.
4. Every normalized opportunity resolves to an immutable provenance record and
   the exact source-policy version in force when it was collected.
5. Raw payloads are written through a provider-neutral object-storage port before
   normalized records are committed. A production connector fails closed if no
   durable raw-payload adapter is configured.
6. Source schema validation fails closed. Invalid pages are quarantined; they do
   not advance the checkpoint or partially modify the canonical corpus.
7. Opportunity mutation, audit history, checkpoint advancement, and outbox event
   creation are one PostgreSQL transaction per committed page or first-party
   command.
8. Events and connector work are at-least-once. All consumers and persistence
   operations are idempotent.
9. Third-party content always carries text attribution and a deep link to the
   original listing. Upstream logos are not exposed unless an approved policy
   explicitly permits them.
10. Disabled, unsupported, quarantined, simulated, or unverified sources are
    represented by their exact status. They are never described as connected.
11. Applied migrations are immutable. Every new migration is forward-only and
    checksum-verified.
12. Public opportunity APIs are `/v1`, contract-first, runtime validated,
    authorized, rate-limited, observable, cursor-paginated where applicable, and
    documented from the same schemas used at runtime.

## 3. Bounded Components

### 3.1 Contracts

`@jovia/contracts` owns versioned runtime schemas for:

- source registration, immutable policy versions, approval, and runtime status;
- canonical opportunities, provenance, attribution, lifecycle, compensation,
  language, location, and freshness;
- direct-publishing commands and opportunity query responses;
- connector checkpoints, ingestion run outcomes, quarantine records, and metrics
  snapshots;
- `opportunity.discovered.v1`, `opportunity.updated.v1`,
  `opportunity.tombstoned.v1`, and `opportunity.expired.v1` events;
- the OpenAPI document assembled from those same Zod schemas.

Unknown additive response fields remain compatible within `/v1`. Requests are
strict at security-sensitive boundaries and tolerant only where the documented
contract explicitly permits extension metadata.

### 3.2 Source Governance

The source registry is split into a stable source identity and append-only policy
versions. A source row points to its active approved policy and carries only
runtime status and kill-switch state. A policy version records:

| Field | Rule |
| --- | --- |
| `sourceCode`, `version` | Unique immutable policy identity |
| `scope` | `external` or `first_party` |
| `mechanism` | official API, licensed feed, approved partnership, RSS, user-authorized import, manual submission, or unsupported |
| `legalPosture` | approved, conditional, blocked, or unreviewed |
| `termsUrl`, `termsSnapshotRef`, `termsSnapshotSha256` | Official terms evidence and immutable digest |
| `attribution` | required flag, display text, source URL, original-link requirement, logo policy |
| `polling` | hard floor, maximum concurrency, self-imposed request spacing, Retry-After behavior |
| `retention` | serving TTL, inactive retention, raw-payload retention, tombstone SLA |
| `redistribution` | prohibited, first-party only, attribution permitted, or licensed |
| `contentModification` | fields that may be transformed or translated |
| `owner`, `verifiedAt`, `validUntil` | accountable owner and review window |
| `approvedBy`, `approvedAt` | approval evidence |

`SourceEligibilityService` returns a typed decision. It denies before connector
lookup for any missing field, disabled source, unsupported mechanism, non-approved
posture, absent approval, future verification date, expired policy, policy/source
mismatch, quarantine, open circuit, or not-yet-reached poll time. Denials emit an
audit entry and a bounded metric but do not call the connector.

Policy updates create a new version. Existing provenance continues pointing to
the older version; policy history is never overwritten.

### 3.3 Connector Runtime

Every connector implements small Jovia-owned interfaces:

```ts
interface OpportunityConnector<Checkpoint> {
  readonly sourceCode: string;
  plan(context: ConnectorPlanContext<Checkpoint>): Promise<FetchPlan<Checkpoint>>;
  fetch(plan: FetchPlan<Checkpoint>, signal: AbortSignal): AsyncIterable<RawPage<Checkpoint>>;
  parse(page: RawPage<Checkpoint>): readonly SourceOpportunityRecord[];
}

interface RawPayloadStore {
  put(input: RawPayloadWrite): Promise<RawPayloadReference>;
  delete(reference: RawPayloadReference): Promise<void>;
}
```

The shared runner owns source eligibility, a distributed lease, per-source rate
limiting, timeout, bounded retry, persistent circuit state, raw capture, schema
validation, quarantine, normalization, page transaction, checkpoint advancement,
completion reconciliation, metrics, and run audit. Connector adapters own only
source-specific HTTP and field mapping.

Retries apply to network failures, timeouts, HTTP 408, HTTP 429, and HTTP 5xx.
HTTP 4xx contract errors, policy failures, and schema failures do not retry.
`Retry-After` wins when present. Otherwise the runner uses bounded exponential
backoff with deterministic jitter injection for tests. Three attempts are allowed
per page. Five consecutive retryable failures open the source circuit; a
successful half-open probe closes it. Persistent state prevents another worker
from bypassing the circuit.

The per-source limiter is distributed and uses the stricter of an official limit
and Jovia's self-imposed safety limit. Unknown official request quotas are stored
as unknown, never invented. Poll floors and request spacing are different fields.

The worker edge supplies an S3-compatible `RawPayloadStore` adapter. It uses a
pinned SDK only inside the adapter, private object ACLs, TLS, server-side
encryption, content SHA-256 metadata, and deterministic source/date/run object
keys. Production startup requires a bucket, region, approved endpoint, and
workload-provided credentials; it fails closed when any are absent. Unit and
contract tests inject an explicitly named in-memory adapter and a fake SDK client,
never an adapter presented as production storage.

### 3.4 Himalayas Connector

The connector targets the documented browse endpoint only:

```text
GET https://himalayas.app/jobs/api?offset=<n>&limit=20
```

Official references verified on 2026-08-05:

- API reference: `https://himalayas.app/docs/remote-jobs-api`
- OpenAPI 3.1: `https://himalayas.app/docs/openapi.json`
- Data dictionary: `https://himalayas.app/docs/data-dictionary`

The official OpenAPI reports version `1.0.0`, no authentication, a maximum page
size of 20, 24-hour data refresh, HTTP 400 for invalid parameters, and HTTP 429
with a 60-second retry instruction. Display requires a visible Himalayas mention
and link. Himalayas listings must not be submitted to third-party aggregators.

The seeded Himalayas policy is:

- mechanism `official_api`, legal posture `approved`, owner `integrations`;
- verified and Product Owner approved on 2026-08-05;
- hard poll floor `86400` seconds and maximum connector concurrency `1`;
- self-imposed one-second minimum request spacing while walking pages;
- text attribution `Data sourced from Himalayas` plus the original application
  link;
- redistribution `prohibited` outside Jovia's end-user experience;
- source content preserved; generated translations are deferred to the later
  clearly-labelled overlay feature;
- serving cache TTL 24 hours, immediate expiration/tombstone exclusion, inactive
  metadata retention 90 days, and raw-payload retention 90 days;
- policy validity through 2026-11-03, after which ingestion fails closed until a
  new reviewed policy version is approved;
- `enabled=false` by default, as required by ADR-0001.

The policy's terms evidence points to a repository source-review record containing
the official URLs, review date, approved interpretation, and content digest. The
record paraphrases the operative rules and does not copy an external terms page.

The connector validates every page against an adapter-owned Zod schema matching
the official response. It maps `guid`, `companySlug`, compensation and
`salaryPeriod`, seniority, employment type, location and timezone restrictions,
categories, sanitized HTML, publication and expiry timestamps, and
`applicationLink`. `companyLogo` remains in permitted raw metadata but is not
exposed by the public opportunity contract under the text-only logo policy.

The checkpoint contains `offset`, `datasetUpdatedAt`, and the last committed page
hash. Offset advances only after the page transaction commits. A resumed run
continues from that offset. If `datasetUpdatedAt` changes during a partial run,
the runner closes the old run as superseded and restarts once at offset zero.

Unit and contract tests use version-controlled official-shape fixtures and a fake
HTTP transport. They never claim a simulated call is a live integration. An
optional live smoke test is explicitly labelled non-CI and cannot enable the
source or write production data.

### 3.5 First-Party Jovia Publishing

`jovia-direct` is a first-party source with mechanism `manual_submission`. Its
approved policy is seeded separately from Himalayas and can be enabled because it
does not call an external system. It permits Jovia attribution and redistribution
only for publishers who accept the first-party publishing terms.

`POST /v1/opportunities` requires an authenticated actor with
`opportunity:publish`, membership in the submitted publisher organization, and a
valid `Idempotency-Key`. The command is wrapped as a source record and enters the
same raw-capture, normalization, deduplication, provenance, audit, lifecycle, and
outbox pipeline as an external record.

`PUT /v1/opportunities/{id}` replaces an owned first-party draft or active record
through the same pipeline. `DELETE /v1/opportunities/{id}` is idempotent and
creates an immediate tombstone; it does not erase audit evidence. Cross-tenant
mutation fails closed. Administrators require the same capability plus the
documented administrative override.

## 4. Canonical Data Model

### 4.1 Opportunity

The canonical opportunity contains:

- stable Jovia ID and lifecycle `draft`, `active`, `expired`, `filled`, or
  `removed`;
- title, sanitized description HTML, plain text, employer identity/raw name;
- engagement type, experience levels, categories, technologies, and language
  codes;
- raw location, ISO country restrictions, timezone restrictions, and remote
  status;
- compensation kind, decimal-string minimum/maximum, ISO 4217 currency, source
  period, and annualized values when annualization is mathematically valid;
- publication, source update, expiry, deadline, first-seen, last-seen,
  normalized, and canonical-update timestamps;
- original and application URLs;
- deterministic content signature, canonical/duplicate relationship, and the
  future semantic-dedup strategy marker;
- current deletion state, tombstone reason/time, purge eligibility, and purge
  completion time;
- safe source extension metadata.

Compensation never performs currency conversion in this batch. Annualization uses
fixed documented multipliers: hourly `2080`, daily `260`, weekly `52`,
fortnightly `26`, monthly `12`, annual `1`; project budgets are not annualized.
Amounts are decimal strings at application boundaries and PostgreSQL `numeric` in
storage to avoid floating-point corruption.

Language normalization accepts validated ISO 639-1 values, lowercases them, and
sorts/deduplicates them. Missing source language is represented as unknown rather
than guessed. Country codes are uppercase ISO 3166-1 alpha-2. Currency codes are
uppercase supported ISO 4217 values; malformed or unknown values quarantine the
record instead of silently fabricating a currency.

### 4.2 Provenance and Audit

Each source occurrence has a separate provenance row containing source identity,
policy version, external ID, original URL, raw object key, raw SHA-256, fetch and
source timestamps, ingestion run, connector version, mapper version, and
normalization version. A canonical opportunity may therefore have multiple source
occurrences without losing attribution.

Append-only audit rows record created, updated, duplicate-linked, tombstoned,
expired, restored, and purged transitions with actor/source, correlation ID,
reason, prior state hash, resulting state hash, and timestamp. Raw descriptions,
tokens, credentials, and request bodies do not enter audit logs.

### 4.3 Deterministic Deduplication

Idempotency and cross-source deduplication are separate:

1. Source identity is unique on `(source_id, external_id)` and makes replay safe.
2. The exact content signature is SHA-256 over normalized title, canonical
   employer key, location-country set, compensation tuple, and engagement type.
3. Under a PostgreSQL advisory lock derived from the signature, the repository
   searches equal signatures whose publication timestamps are within 24 hours.
4. If a candidate exists, the new provenance is linked to its canonical
   opportunity. Otherwise a new canonical opportunity is created.
5. Canonical selection is deterministic: first-party, then higher approved source
   reliability, then earlier first-seen time, then lexical ID.

The application depends on `DeduplicationStrategy`; this batch supplies
`DeterministicDeduplicationStrategy`. The future matching batch may add a semantic
strategy and `semantic` decisions without altering connector contracts or
rewriting deterministic history. Semantic merging is explicitly out of scope
here.

## 5. Persistence and Forward-Only Migration

Migration `0001_opportunity_core.sql` adds, without modifying
`0000_foundation.sql`:

- versioned source policies, approvals, runtime state, and source audit;
- ingestion runs, page/raw references, checkpoints, distributed leases,
  quarantine records, and connector circuit state;
- canonical opportunities, provenance/source occurrences, audit history,
  idempotency records, and deterministic duplicate links;
- transactional outbox events and dispatch attempts;
- indexes for source identity, active/fresh queries, expiry sweeps, checkpoint
  leasing, pending outbox claims, policy lookup, and provenance foreign keys.

All foreign keys are indexed. Active opportunity and pending outbox queries use
partial indexes. Query APIs use keyset pagination on `(published_at, id)` rather
than `OFFSET`. JSONB is reserved for source extension data, checkpoint state, and
versioned event payloads; frequently filtered values are typed columns.

The migration runner discovers migration files in lexical order, records their
SHA-256 digests after `0001`, applies each once in a transaction, and fails if an
applied file's digest changes. Fresh and previously founded databases both work:
the existing `jovia_migrations` history is preserved and the new checksum ledger
is introduced forward-only.

Database integration tests apply all migrations twice, verify extensions,
constraints, foreign-key indexes, partial indexes, seed policies, idempotent
upserts, transaction rollback, checkpoint resume, advisory-lock deduplication,
outbox claim/retry, and tombstone exclusion.

## 6. Lifecycle and Reliability

### 6.1 Full Sync and Tombstones

Every successful full Himalayas walk records the set of source identities seen.
Only after every page commits does reconciliation tombstone previously active
Himalayas occurrences absent from the completed dataset. Partial, failed,
superseded, or quarantined runs never tombstone unseen records.

An expiry sweep marks opportunities expired when `expiresAt <= now` and emits one
idempotent expiration event. Direct publisher deletion tombstones immediately.
Serving queries exclude tombstoned, expired, filled, removed, or purged records.
If another active provenance still supports a canonical opportunity, removing one
source occurrence does not remove the canonical record; attribution is recalculated
from the remaining canonical occurrence.

The retention sweep uses the policy version attached to each provenance. It
deletes raw objects after their retention deadline through `RawPayloadStore`,
marks `purgedAt`, and preserves the minimum hashed provenance and audit evidence.

### 6.2 Quarantine and Schema Isolation

A raw page that cannot be decoded, violates the source schema, contains an
invalid required canonical value, or changes a required upstream type is written
to quarantine with a safe field-path diff, raw reference, source, run, connector
version, and correlation ID. The source is marked quarantined after the configured
threshold; its circuit opens and future leases fail closed. Operators can fix the
mapper and replay from the immutable raw reference. Quarantine errors never log
the raw payload.

### 6.3 Transactional Outbox

Every canonical state transition creates one versioned outbox row in the same
transaction. A unique event key prevents duplicate events during replay. Dispatch
workers claim rows with `FOR UPDATE SKIP LOCKED`, publish through an injected event
publisher, and mark success only after publication returns. Failures increment a
bounded attempt count and schedule exponential retry; exhausted events remain
visible in a dead-letter state for operator replay. Event payloads contain
identifiers and normalized safe fields, never raw source payloads.

## 7. Scheduling Separation

The connector scheduler computes `nextAllowedPollAt` from the latest successful
or attempted poll and the approved source floor. Himalayas therefore cannot be
polled more frequently than once per 24 hours, regardless of user count, saved
search frequency, queue backlog, or administrator request.

Downstream consumers may re-score, re-match, rank, and notify every three minutes
using already stored active opportunities. Those downstream jobs consume outbox
events or PostgreSQL snapshots and have no method capable of scheduling a source
poll. An architecture test rejects importing connector-scheduling code into
ranking, scoring, notification, or web packages.

## 8. Public API Design

The batch exposes:

| Method and route | Capability | Behavior |
| --- | --- | --- |
| `POST /v1/opportunities` | `opportunity:publish` | First-party create with required idempotency key |
| `PUT /v1/opportunities/{id}` | `opportunity:publish` + owner | Idempotent first-party replacement |
| `DELETE /v1/opportunities/{id}` | `opportunity:publish` + owner | Immediate idempotent tombstone |
| `GET /v1/opportunities` | `opportunity:read` | Active cursor-paginated results |
| `GET /v1/opportunities/{id}` | `opportunity:read` | Active detail with provenance and attribution |
| `GET /v1/admin/opportunity-sources` | `admin:operate` + `source:read` | Exact policy/runtime states; never inferred connectivity |
| `GET /v1/admin/ingestion-runs` | `admin:operate` | Cursor-paginated operational history |
| `GET /v1/openapi.json` | authenticated API consumer | OpenAPI generated from runtime schemas |

`GET /v1/health` remains the non-sensitive liveness exception. All other routes
authenticate a bearer credential through the provider-neutral `Authenticator`,
authorize with deny-by-default capability and organization ownership checks, and
use a Redis-backed distributed rate limiter in production. Test adapters are
named as test adapters and cannot be selected in production configuration.

Errors use the existing RFC 9457 problem contract and stable codes such as
`authentication_required`, `capability_denied`, `organization_scope_denied`,
`validation_failed`, `idempotency_conflict`, `rate_limit_exceeded`,
`source_not_eligible`, and `opportunity_not_found`. Responses include correlation
IDs; 429 responses include `Retry-After`. Internal connector, SQL, storage, and
policy details are not exposed.

Opportunity responses include explicit attribution:

```json
{
  "source": "himalayas",
  "sourceName": "Himalayas",
  "attributionText": "Data sourced from Himalayas",
  "sourceUrl": "https://himalayas.app",
  "originalUrl": "https://example.com/apply"
}
```

For Himalayas, `originalUrl` is the exact source-supplied `applicationLink`; the
connector never fabricates a Himalayas listing path. The attribution value is
persisted policy data, not UI copy invented by clients.

## 9. Observability and Operations

Structured logs include correlation, source, run, page, connector version,
operation, safe outcome, and duration. They exclude payload bodies, credentials,
personal contact data, SQL text, and object-store secrets.

OpenTelemetry-compatible metrics use bounded labels only:

- `jovia_ingestion_fetch_total{source,outcome}`;
- `jovia_ingestion_records_total{source,result}`;
- `jovia_ingestion_run_duration_ms{source,outcome}`;
- `jovia_source_freshness_lag_seconds{source}`;
- `jovia_source_tombstone_lag_seconds{source}`;
- `jovia_ingestion_quarantined_total{source,reason}`;
- `jovia_connector_circuit_state{source}`;
- `jovia_source_rate_limited_total{source}`;
- `jovia_outbox_pending_total{event_type}`;
- API request count, latency, authorization denial, validation failure, and rate
  limit count by route template and outcome.

The operational runbook defines policy denial, upstream 400/429/5xx, dataset
supersession, checkpoint replay, schema drift, quarantine release, stale source,
open circuit, tombstone lag, outbox backlog, retention failure, and kill-switch
procedures. A source kill switch prevents new leases in under one scheduler cycle.

The same pull request creates or updates the Knowledge Base entry, architecture
flow, source-policy evidence, OpenAPI guide, database migration evidence,
operations runbook, and security threat model. Navigation READMEs link each new
document. The frozen root authorities and known duplicate documents are not
renamed, deleted, or silently edited.

## 10. Threat Model

| Threat | Control |
| --- | --- |
| Spoofed source or redirected HTTP | Connector base URL is code-owned and HTTPS-only; redirects to non-approved origins fail |
| Policy or approval tampering | Append-only versions, constrained approver fields, immutable audit, least-privilege repository methods |
| SSRF through source configuration | Runtime never fetches an arbitrary registry URL; each connector owns an allowlisted origin |
| Malicious source HTML | Strict sanitization allowlist, plain-text extraction, CSP-compatible output, no script/style/event attributes |
| Cross-tenant first-party mutation | Authenticated actor, capability check, organization membership, repository predicate |
| Replay or duplicate publish | Required idempotency key, request hash, unique source identity, deterministic dedup |
| Queue redelivery | Transactional idempotency and unique outbox/event keys |
| Schema poisoning | Runtime validation, raw-first capture, quarantine, no checkpoint advance |
| Rate-limit abuse | Distributed upstream and public-API limiters, Retry-After, circuit breaker |
| Data leakage in logs/events | Redaction, safe DTOs, bounded metadata, no raw body logging |
| Migration tampering | Forward-only files, checksum ledger, CI integration tests |
| Misleading connected-source claims | Status is derived from enabled, policy, quarantine, freshness, and observed run evidence |

## 11. Verification Matrix

The batch is not complete until current evidence proves all rows:

| Requirement | Evidence |
| --- | --- |
| Lawful-source enforcement | Unit tests for every denial and one approved path; zero connector calls on denial |
| Himalayas contract | Official-shape fixtures, pagination, 400/429, Retry-After, response-schema and mapping tests |
| Direct Jovia publishing | API-to-pipeline integration covering create, replay, replace, ownership denial, and delete |
| Normalization | Table-driven valid, missing, boundary, unsafe HTML, timestamp, URL, and stable-hash tests |
| Currency/language/compensation | ISO normalization and annualization tests without currency conversion |
| Deterministic dedup | Same-source replay, cross-source exact match, 24-hour window, canonical tie-break, and non-match tests |
| Checkpoint resume | Failure after a committed page resumes at the next offset without duplicate mutation |
| Retry/rate/circuit | Deterministic clock/sleep tests, Retry-After precedence, non-retryable failures, persisted open/half-open/closed behavior |
| Tombstone/expiration | Complete-run reconciliation, partial-run safety, expiry sweep, direct deletion, multi-provenance survival |
| Outbox reliability | Atomic creation, unique keys, failed publish retry, SKIP LOCKED claim, dead-letter visibility |
| Quarantine | Invalid page captured safely, no canonical writes/checkpoint advance, replay after mapper repair |
| Freshness/metrics | Recording meter assertions and bounded-label checks for every required metric |
| Database migrations | Fresh apply, upgrade from foundation, second apply, checksum rejection, constraints/indexes/seed verification |
| API contracts/auth | Zod request/response tests, generated OpenAPI snapshot, authentication/capability/ownership/rate-limit/problem tests |
| Knowledge Base and architecture | New bounded-context entry plus linked architecture, API, database, operations, source-policy, and threat-model documents |
| Full quality | Frozen clean install, format, lint, typecheck, unit/contract/integration tests, coverage, build, architecture, secrets, dependency audit, CodeQL, Gitleaks, dependency review, and green PR CI |

Network smoke output, manually inspected pages, or passing unit tests alone do not
substitute for this matrix. The PR description links the exact commands, CI run,
migration evidence, signed commits, and remaining risks.

## 12. Delivery and Merge Policy

All work occurs on `feat/opportunity-core-lawful-discovery`. Commits are small,
conventional, and SSH-signed with the approved device key. The branch is pushed
to the official repository and submitted as a pull request. It is not merged
directly to `main` and is not declared complete until every required check is
green and GitHub displays the commits as Verified.

The source remains disabled in production configuration unless its executable
policy and operational dependencies are present. External object-store,
production identity, Redis, database, or deployment credentials are never placed
in the repository; obtaining them is an explicit external-access boundary, not a
reason to simulate a connection.

## 13. Deferred Scope

The next slice owns semantic deduplication, embeddings, opportunity scoring,
personalized matching, ranking, explanations, and user feedback learning. A later
notification slice owns user cadence and delivery channels. This slice provides
their versioned events and canonical data but does not label those future systems
as implemented.
