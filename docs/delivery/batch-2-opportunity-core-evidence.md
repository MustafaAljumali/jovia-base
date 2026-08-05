---
document: Batch 2 Opportunity Core Delivery Evidence
version: 1.0.0
status: Complete for Review
authority: Product Owner Approved Batch 2 Specification
ai_context: Read Before Declaring Batch 2 Complete
read_before:
  - docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md
  - docs/architecture/opportunity-core-lawful-discovery.md
read_after: []
owner: Opportunity Intelligence Domain
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Batch 2: Opportunity Core and Lawful Discovery Evidence

This record covers the review branch
`feat/opportunity-core-lawful-discovery` and pull request
[`#9`](https://github.com/MustafaAljumali/jovia-base/pull/9). It is implementation
evidence, not a claim that a disabled source or test adapter is connected.

## Required product evidence

| Required evidence | Executable proof |
|---|---|
| Lawful-source policy enforcement | `services/opportunity-ingestion/src/source-eligibility.test.ts` exercises the complete denial matrix, due-time separation, manual publishing, audit, and bounded metrics. `packages/database/src/integration/opportunity-core.integration.test.ts` verifies exact seeded policy state. |
| Himalayas connector contract | `services/opportunity-ingestion/src/himalayas/connector.contract.test.ts` verifies only the official endpoint, limit 20, application-link attribution, schema change failure, 429/60-second classification, and dataset replacement behavior using versioned official-shape fixtures. No live request is used by tests. |
| Direct Jovia publishing | `services/opportunity-ingestion/src/publishing/service.test.ts`, `apps/api/src/routes/opportunities.contract.test.ts`, and the PostgreSQL repository contract “persists direct publication provenance and authenticates tenant-scoped publishers” cover create, replace, remove, ownership, terms, idempotency, raw capture, normalization, provenance, audit, and outbox. |
| Normalization | `services/opportunity-ingestion/src/normalization/normalization.test.ts` covers sanitizer behavior, ISO currency/language/location normalization, stable collections, policy-permitted transformations, and deterministic signatures. |
| Currency, language, compensation | The normalization suite proves ISO currency/language handling, hourly/monthly/yearly annualization, range ordering, and that project budgets are neither annualized nor currency-converted. |
| Deterministic deduplication | `services/opportunity-ingestion/src/deduplication.test.ts` covers strategy boundaries; the PostgreSQL contract “serializes exact-signature deduplication and resumes from committed checkpoints” proves concurrent advisory-lock serialization and a single canonical winner. |
| Checkpoint resume | Connector runner tests prove commit-before-advance and superseded datasets; the PostgreSQL deduplication/checkpoint contract proves resume from the latest committed checkpoint. |
| Retry, rate limit, circuit breaker | `connector/retry.test.ts`, `connector/rate-limiter.test.ts`, `connector/circuit-breaker.test.ts`, `connector/runner.test.ts`, and worker adapter tests cover bounded retry/jitter, `Retry-After`, source spacing, official windows, cancellation, half-open/open state, and schema-failure quarantine. |
| Tombstone and expiration | `lifecycle/service.test.ts` covers multi-source preservation. The PostgreSQL contract “expires due opportunities and reconciles source removals through audited outbox state” proves expiry audit/event and completed-run tombstoning. Retention jobs prove object deletion before database purge. |
| Outbox reliability | `outbox/dispatcher.test.ts` covers retry and dead-letter ceilings. PostgreSQL contracts prove atomic rollback, exclusive expiring claims, attempt history, retry, and publication acknowledgement. |
| Quarantine | `quarantine/service.test.ts` covers safe metadata, immutable raw reference, admin capability, changed mapper version, missing record, and one-time release. Runner contracts cover schema-failure quarantine. |
| Freshness and operational metrics | `apps/worker/src/jobs/jobs.test.ts` and `apps/worker/src/adapters/opportunity-adapters.test.ts` cover bounded source freshness, circuit, quarantine, tombstone, outbox, latency, and eligibility labels. Dynamic/unbounded labels are rejected. |
| Database migrations | `packages/database/src/integration/opportunity-core.integration.test.ts` proves fresh/repeated application, immutable checksums, fail-closed digest mismatch, foreign-key/partial indexes, and exact source seed state. `repository-contracts.integration.test.ts` proves rollback, concurrency, lifecycle, auth, and outbox behavior. |
| API contracts and authorization | `apps/api/src/routes/opportunities.contract.test.ts` covers strict Zod input/output, OpenAPI 3.1 coverage, opaque bearer failure, pre-authentication IP limiting before database lookup, capability and tenant denial, distributed actor/route rate limiting, keyset cursors, versioned routes, stable problem codes, and admin contracts. |

## Quality-gate evidence

The exact locked toolchain is Node `24.14.x` and pnpm `11.20.0`.

| Gate | Result on 2026-08-05 |
|---|---|
| Frozen-lockfile clean install | Passed after the final dependency-boundary correction: all 21 workspace projects already up to date under pnpm 11.20.0. |
| Formatting | Passed: every matched file conforms to Prettier. |
| ESLint | Passed with zero warnings. |
| Type checking | Passed: composite TypeScript build and web no-emit check. |
| Unit and contract tests | Passed: 46 files, 158 tests; 10 PostgreSQL-only tests intentionally skipped in the local unit project. |
| Coverage | Passed: statements 90.62%, branches 80.20%, functions 92.38%, lines 92.65%. Thresholds were not lowered. Declarative Drizzle schema files are excluded; their actual migrations are exercised in PostgreSQL integration tests. |
| Production build | Passed: TypeScript composite build and Vite production web bundle. |
| Architecture policy | Passed: provider, AWS SDK, database, web/server, Manus, mutable-action, and downstream ingestion boundaries. |
| Secret policy | Passed; no private signing material, credential, token, or raw payload is present. |
| Dependency audit | Passed; no known vulnerabilities at the configured high-severity gate. |
| PostgreSQL/Redis integration | Passed in [Foundation CI #21](https://github.com/MustafaAljumali/jovia-base/actions/runs/30964992452), including migrations, database checks, repository contracts, direct lifecycle, expiry/reconciliation, checkpoint, auth, and outbox. |
| Remote quality, gitleaks, CodeQL | Passed in [Foundation CI #21](https://github.com/MustafaAljumali/jovia-base/actions/runs/30964992452). |
| Pull-request dependency review | Passed in [PR CI](https://github.com/MustafaAljumali/jovia-base/actions/runs/30965082051). |

GitHub Advanced Security subsequently identified two high-severity review findings:
an authentication database lookup without a recognized pre-authentication limiter,
and a polynomial end-trimming regular expression. The remediation adds a
dedicated rate-limiting Fastify pre-handler before bearer verification and
replaces regex trimming with bounded linear character scanning. Both paths have
regression tests; the PR must not merge until the follow-up Code Scanning result
closes both alerts.

## Signing evidence

All Batch 2 commits use conventional subjects and SSH signing with the dedicated
development-device Ed25519 public-key fingerprint
`SHA256:fXTH+W+yI0v8loV+QrzQysM0CVVGrR0eZjMf2Y2X074`. The public setup procedure is
documented in `docs/security/development-commit-signing.md`. No private key,
passphrase, askpass response, or production infrastructure key is documented or
stored in the repository.

## Runtime truth and remaining activation work

- Himalayas is a real, contract-tested connector but remains disabled and must not
  be presented as connected. Activation requires an authorized operational policy
  change and a production raw-storage configuration.
- Jovia Direct is the enabled first-party source; production use requires external
  database, Redis, private raw-storage credentials, and publisher account data.
- Every other named external source remains unimplemented and not connected.
- Deployment, production credentials, external accounts, AI scoring, matching,
  memory, personalized notifications, and later product slices are outside Batch 2.
- GitHub reports non-blocking warnings that several pinned actions still declare a
  Node 20 runtime and are being forced to Node 24. The jobs pass; action-pin renewal
  should be handled as CI maintenance with official release verification.
