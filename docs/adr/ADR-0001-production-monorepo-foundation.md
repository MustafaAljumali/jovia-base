---
document: ADR-0001 Production Monorepo Foundation
version: 1.0.0
status: Accepted
authority: Architecture Decision Record
ai_context: Read Before Architecture or Implementation Work
read_before:
  - Jovia_Engineering_Constitution_v2.0.md
  - Jovia_Strategic_Product_Vision.md
  - Jovia_Governance_and_Business_Operations.md
read_after:
  - Jovia_Technical_Research_and_Integration_Blueprint.docx
owner: Jovia Architecture Council
decision_date: 2026-08-04
approved_by: Product Owner
approval_date: 2026-08-04
governance_note: Until a formal Architecture Council is established, the Product Owner acts as the interim approving authority for this foundational ADR.
last_revised: 2026-08-04
last_verified: 2026-08-04
---

# ADR-0001: Production Monorepo Foundation

## Status

**Accepted.** Approved by the Product Owner on 2026-08-04. Until a formal
Architecture Council is established, the Product Owner acts as the interim
approving authority for this foundational ADR. Implementation may proceed on a
review branch under the approved execution instruction.

## Context

The official `MustafaAljumali/jovia-base` repository is the single source of
truth for Jovia. At the time of this decision it contains the governing product,
engineering, governance, research, experience, and knowledge-base documents,
but no production application source code.

A separate prototype exists outside the official repository. It demonstrates a
large UI surface and several product concepts, but it cannot be imported as the
production baseline because it:

- uses MySQL-specific Drizzle configuration and persistence code while the
  approved blueprint requires PostgreSQL 16 and pgvector;
- directly depends on Manus for LLM access, authentication, storage, scheduling,
  runtime behavior, build tooling, UI assets, and branding;
- presents mock Upwork, Fiverr, and Freelancer data while no lawful production
  connectors for those sources exist;
- contains a notification job labelled as an opportunity radar even though it
  only reads opportunities that were already stored and scored;
- has a missing email-notification module that prevents type checking, tests,
  and the server production build from passing;
- does not provide the required AI provider registry, task routing, failover,
  cost accounting, health monitoring, prompt versioning, or audit boundary;
- does not meet the approved bounded-context, observability, configuration,
  security, and automated quality-gate requirements.

Importing the prototype wholesale would make non-compliant assumptions the
default architecture and would make their later removal more expensive and
risky. Discarding every prototype artifact would also waste reviewed design and
product work that can be migrated safely.

## Decision Drivers

- The Engineering Constitution is the supreme engineering authority.
- Jovia must become an AI operating system for freelancers, not a conventional
  dashboard with AI-labelled actions.
- The system must remain deployable as a modular monolith for the initial
  release while preserving bounded-context extraction points.
- PostgreSQL 16 is the system of record and pgvector supplies vector storage.
- External opportunity sources must be lawful, attributable, observable, and
  governed through a source registry.
- Product code must be independent of Manus and of any single AI, identity,
  storage, queue, or deployment provider.
- Every migration unit must be reviewed independently and protected by tests.
- Local development and CI must be reproducible without production credentials.

## Decision

Create a new production-grade TypeScript monorepo inside the official
`jovia-base` repository. Begin with a modular monolith and independent background
workers. Preserve domain boundaries in packages and services; do not deploy each
boundary as a microservice until scale, ownership, or release cadence justifies
the operational cost through another ADR.

The existing prototype is a migration source only. No prototype directory may
be copied wholesale. Each candidate file or module must be classified, reviewed,
adapted where necessary, tested, and migrated through an ordinary pull request.

### Repository topology

```text
apps/
  web/                    React web client
  api/                    HTTP API composition root and modular monolith
  worker/                 Background-task composition root
packages/
  ai/                     Provider-neutral AI contracts and orchestration
  auth/                   Provider-neutral identity and session contracts
  config/                 Typed environment and runtime configuration
  contracts/              Versioned API and event contracts
  database/               PostgreSQL schema, migrations, and repositories
  localization/           Locale contracts, catalogues, and formatting
  notifications/          Channel-neutral notification contracts
  observability/          Logging, tracing, metrics, and correlation context
  security/               Security policies and reusable enforcement helpers
  testing/                Shared test factories and infrastructure helpers
  ui/                     Reviewed design tokens and reusable components
services/
  opportunity-ingestion/  Source registry, connectors, raw capture, normalization
  opportunity-scoring/    Explainable scoring feature computation
  opportunity-ranking/    User-specific ranking and retrieval orchestration
  proposal-generation/    Proposal context and generation workflow
  notification-delivery/  Notification policy and channel delivery workflow
docs/
  adr/
  api/
  architecture/
  database/
  migration/
  operations/
  security/
```

Top-level `services/*` directories are workspace libraries during the initial
release. They expose application interfaces consumed by `apps/api` and
`apps/worker`; they are not independently deployed services. This preserves the
requested future extraction boundaries without creating an initial distributed
system.

### Approved technical baseline

- **Language:** TypeScript with strict compiler settings for application,
  worker, package, test, and build code.
- **Workspace:** pnpm workspaces with one committed lockfile. Workspace scripts
  provide deterministic formatting, linting, type checking, testing, building,
  and security checks. A separate build orchestrator is not introduced initially.
- **Web:** React with Vite. Web code consumes versioned contracts and cannot
  import database, provider SDK, or server implementation packages.
- **API:** a Node.js HTTP application with a contract-first, versioned REST
  boundary and generated OpenAPI documentation. The initial API composition root
  hosts bounded-context modules in one process.
- **Workers:** Node.js worker processes for ingestion, scoring, ranking,
  notification, and AI tasks. Workers share contracts but not presentation code.
- **Database:** PostgreSQL 16 with pgvector. Drizzle ORM may be used only through
  PostgreSQL drivers, forward-only migrations, bounded repositories, and database
  tests. MySQL and TiDB drivers are prohibited by this ADR.
- **Coordination:** Redis supplies caching, queue coordination, distributed
  locks, and rate limiting through abstractions owned by the relevant package.
- **Object storage:** an S3-compatible port stores raw source payloads and other
  objects. Domain code cannot import an S3 vendor SDK.
- **Contracts:** HTTP, event, provider, and persistence-boundary inputs are
  runtime validated. Contract versions are explicit and compatibility is tested.
- **Observability:** structured JSON logs, correlation IDs, OpenTelemetry-
  compatible traces and metrics, secret redaction, and documented error codes.
- **Configuration:** environment-derived, runtime-validated configuration with
  separate secret and non-secret schemas. Invalid configuration fails closed at
  process startup.
- **Local development:** containers provide PostgreSQL 16 with pgvector and Redis.
  Applications run locally or in containers using the same validated settings.
- **Quality gates:** CI enforces formatting, linting, type checking, tests,
  production builds, secret detection, dependency review, and security scanning.

Framework and dependency versions will be pinned in the first implementation
commit and reviewed through the lockfile. No production dependency may use an
unbounded or `latest` version selector.

## Architecture Boundaries

### Dependency direction

Business and application logic depend on Jovia-owned contracts. Provider,
database, identity, queue, storage, and HTTP implementations depend inward on
those contracts. External SDKs may appear only in adapter modules.

`apps/web` -> `packages/contracts`, `packages/ui`, `packages/localization`

`apps/api` and `apps/worker` -> application services and shared platform packages

application services -> domain contracts and provider-neutral ports

adapters -> application ports and external SDKs

No bounded context may query another context's tables directly. Cross-context
access uses a documented application interface or versioned event.

### AI provider boundary

`packages/ai` owns the provider-neutral request, streaming, structured-output,
usage, cost, health, and error contracts. Gemini is the primary initial adapter,
but the registry selects providers by task policy. Business logic cannot import
Gemini or any other model SDK.

The first implementation must include:

- a provider registry and explicit provider capabilities;
- task-based routing with pinned model identifiers supplied by validated config;
- streaming and non-streaming invocation contracts;
- retry, timeout, circuit-breaker, and failover policies;
- schema validation for structured output;
- normalized token and cost usage records;
- versioned prompt identifiers and audit metadata;
- safety-policy hooks and secret/PII redaction boundaries;
- health state and observable provider failures;
- a deterministic fake provider for tests.

Failover never silently changes a task's safety policy or output contract.
Provider failures use normalized, non-secret error categories.

### Authentication boundary

`packages/auth` owns Jovia identity, authentication result, session, authorization,
and audit contracts. API and domain modules depend on these contracts rather than
on an identity vendor. The first batch supplies an in-memory test adapter and the
integration boundary; selecting or enabling a production identity vendor requires
the required security review and, if it changes the security model, a dedicated
ADR.

### Opportunity source boundary

Every external source is disabled by default and registered with a legal posture,
mechanism, terms reference, attribution rule, polling floor, retention/cache rule,
redistribution rule, owner, and last-verification timestamp.

Allowed mechanism classifications are:

- Official API
- Partner or commercial agreement
- RSS or public feed
- User-authorized import
- Manual submission
- Unsupported

Unsupported or unverified sources cannot execute ingestion. The initial connector
sequence follows the approved Technical Research and Integration Blueprint:
Himalayas, Jobicy, Remotive, RemoteOK, Arbeitnow, We Work Remotely, The Muse,
Reed, Adzuna, and Jooble. Credentials or commercial approvals are provided only
through an external, authorized secrets process.

Upwork has no launch connector under its standard commercial restrictions.
Fiverr has no launch connector without a written partnership. LinkedIn and Indeed
are not read-aggregation launch sources. No scraping, undocumented endpoint use,
browser circumvention, or fabricated integration is permitted.

## Prototype Migration Strategy

Create a version-controlled inventory that assigns every prototype file or module
exactly one disposition:

1. **Reuse unchanged** — provider-neutral, compliant, tested, and compatible.
2. **Refactor before reuse** — product value is retained after dependencies,
   boundaries, accessibility, localization, or tests are corrected.
3. **Rewrite** — behavior is useful but the implementation conflicts with the
   approved architecture or quality requirements.
4. **Reject** — insecure, misleading, broken, dead, duplicated, or prohibited.
5. **Archive for reference** — useful historical or visual context that must not
   enter the production dependency graph.

Each inventory row records the original path, owner context, disposition, reason,
target path when applicable, Manus coupling, persistence coupling, test evidence,
security notes, and migration commit. A candidate remains outside the production
tree until its target tests pass.

Prioritize design tokens, accessible UI primitives, stable presentational
components, test fixtures, and provider-neutral business rules. Reject Manus
runtime code, MySQL persistence, mock integrations presented as real, broken
services, untested critical logic, duplicated code, and visible Manus branding.

## Compatibility Boundaries

- The prototype database is not a migration source of record. Any later data
  migration requires a separate mapping, integrity checks, rehearsal, and rollback
  plan.
- Prototype HTTP and tRPC shapes are not public compatibility guarantees.
  Production contracts begin versioned at `/v1` after review.
- Prototype environment-variable names are accepted only when independently
  justified; Manus-specific variables are prohibited in the new runtime.
- Prototype UI behavior may be retained when it passes accessibility,
  localization, responsive-layout, security, and design-system review.
- No compatibility shim may import MySQL, Manus, or an external AI SDK into domain
  or application packages.
- The official repository never depends on the prototype directory at build or
  runtime. Migration uses reviewed copies with recorded provenance.

## Security and Privacy Consequences

- Secrets remain outside source control and are validated at startup.
- Logs, traces, metrics, error responses, and AI audit records redact credentials,
  tokens, and sensitive personal information.
- AI adapters receive only task-minimal data after safety and PII policy checks.
- Source ingestion stores immutable provenance and raw-payload references before
  normalization when the source policy permits storage.
- Authentication and authorization failures are explicit, auditable, and fail
  closed.
- Dependency additions require justification, pinned versions, lockfile review,
  and automated vulnerability checks.

## Operational Consequences

### Positive

- The official repository becomes a reproducible production baseline.
- Provider and infrastructure independence are enforced by dependency direction.
- The initial system avoids premature microservice complexity.
- Background workloads can scale independently from request handling.
- Lawful-source status becomes executable configuration rather than marketing text.
- Selective migration preserves useful work without inheriting prototype debt.
- Quality and security gates exist before feature growth accelerates.

### Negative

- Initial delivery spends time on foundations before visible feature expansion.
- Some prototype features must be rewritten even when their UI appears complete.
- Provider-neutral interfaces add deliberate adapter and contract code.
- A modular monolith still requires disciplined boundaries because process
  isolation does not enforce them automatically.
- PostgreSQL, Redis, and local containers increase setup requirements compared
  with a frontend-only prototype.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| The skeleton becomes architecture without working software | Every foundation package must have executable tests and be consumed by a composition root. |
| Premature service extraction | `services/*` remain workspace libraries until another ADR proves independent deployment value. |
| Provider abstraction collapses to Gemini-specific types | Contract tests and a deterministic fake provider must pass without the Gemini SDK. |
| Prototype migration reintroduces Manus or MySQL | Inventory checks, forbidden-import rules, repository scans, and reviewer evidence gate each migration. |
| Marketing outruns lawful integrations | UI source labels derive from the governed source registry; disabled and unsupported sources cannot be presented as connected. |
| Configuration leaks secrets | Typed redacted config objects, secret scanning, documented example values, and no real credentials in tests. |
| Cross-context database coupling grows inside the monolith | Repository ownership and architecture tests reject imports and table access outside the owning context. |
| CI becomes slow or flaky | Deterministic unit/contract tests form the required fast gate; container integration tests use health checks and bounded timeouts. |

## Alternatives Considered

### Alternative A: Import the existing prototype wholesale

Rejected. This is the fastest path to a visible application but would make MySQL,
Manus coupling, broken imports, mock platform claims, and unreviewed boundaries the
official baseline. Correcting these after feature work would be a higher-risk
rewrite inside a live dependency graph.

### Alternative B: Build the clean monorepo and migrate reviewed units selectively

Selected. This produces a compliant foundation while retaining reusable UI,
assets, tests, and business logic. It creates explicit evidence for every migrated
unit and permits incremental user-visible progress.

### Alternative C: Discard the prototype and rewrite everything without reference

Rejected. It provides the strongest isolation but wastes product learning and
reviewable UI work. Selective migration provides equivalent architectural
protection with lower product and design rework.

### Alternative D: Begin with independently deployed microservices

Rejected for the initial release. It matches the long-term connector-mesh vision
but adds network failure modes, deployment coordination, distributed tracing,
schema compatibility, and operational cost before team and traffic evidence
justify them.

## Rollout Plan

1. Commit this Proposed ADR on a review branch.
2. Create the monorepo workspace, root quality tooling, local containers, and
   minimal `web`, `api`, and `worker` composition roots.
3. Add PostgreSQL 16/pgvector and Redis health-checked development services plus
   the first forward-only database migration.
4. Add provider-neutral AI contracts, the deterministic fake, registry, policies,
   Gemini adapter, usage accounting, and provider health checks.
5. Add authentication contracts, test adapter, typed configuration, structured
   logging, correlation IDs, and normalized error handling.
6. Add CI gates and security checks; demonstrate clean install, checks, tests, and
   production builds in a credential-free environment.
7. Commit the prototype migration inventory and documentation status report.
8. Begin feature work only after the foundation evidence is green.

Each step is delivered through a conventional commit and remains revertible until
accepted into the shared branch.

## Rollback Approach

Before production data exists, rollback is a Git revert of the foundation commits
or deletion of the review branch; the documentation-only source-of-truth commit
remains recoverable in Git history.

After database migrations begin, application rollback uses the previous build and
forward-compatible schema. Production migrations are never edited or rolled back
destructively. A corrective forward migration restores the previous application
contract while preserving data created by newer code.

Prototype migration is independently revertible per migrated unit. The prototype
remains an external read-only reference during the first batch, so rejecting or
reverting a migrated unit does not destroy the original artifact.

## Architectural Review

Review performed on 2026-08-04 against the approved Engineering Constitution,
Strategic Product Vision, Governance and Business Operations document, Technical
Research and Integration Blueprint, Product Experience Design, and repository
knowledge-base authority rules.

- Clean Architecture and dependency inversion: **conforms**.
- DDD bounded contexts and data ownership: **conforms**, with module ownership
  enforced before extraction.
- Monorepo default and anti-premature-microservice rule: **conforms**.
- PostgreSQL 16 and pgvector system-of-record decision: **conforms**.
- AI provider independence, auditability, and versioning: **conforms**.
- Lawful source integration and anti-scraping policy: **conforms**.
- Manus independence: **conforms by replacement-first migration rule**.
- Security, configuration, observability, and rollback requirements: **conforms**.
- Automated quality gates: **conforms as a first-batch acceptance condition**.
- Human approval boundary: **conforms; Product Owner acceptance is recorded under
  the interim governance authority defined for this foundational ADR**.

No conflict with an approved constitutional document was identified. No legal or
commercial connector authorization is created by this ADR.

## Acceptance Criteria

This Accepted ADR remains valid while the following conditions continue to hold:

- the dependency direction and bounded-context ownership are preserved;
- no initial top-level service is treated as an independently deployed
  microservice;
- PostgreSQL 16/pgvector remains the only production system-of-record baseline;
- business logic cannot import Manus, Gemini, or infrastructure SDKs directly;
- source enablement remains gated by recorded legal posture;
- the first delivery batch passes every required quality and security gate.

## References

- `Jovia_Engineering_Constitution_v2.0.md`
- `Jovia_Strategic_Product_Vision.md`
- `Jovia_Governance_and_Business_Operations.md`
- `Jovia_Technical_Research_and_Integration_Blueprint.docx`
- `Jovia_Product_Experience_Design_Phase_2.pdf`
- Product Owner decision: “Create a new production-grade monorepo inside the
  official jovia-base repository,” approved 2026-08-04.
