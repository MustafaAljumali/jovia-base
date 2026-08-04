---
document: Jovia Engineering Constitution
version: 2.0
status: Approved
authority: Constitution
ai_context: Always Read
read_before: [Global INDEX, Folder INDEX, AGENTS.md]
owner: Delta Wave / Jovia Core Team
last_revised: 2026-07-30
---

# THE JOVIA ENGINEERING CONSTITUTION

> This document is the supreme engineering law of the Jovia platform. Every human developer and every AI coding agent (Claude, ChatGPT, Manus, Qoder, Cursor, or any future agent) MUST read and obey this Constitution before writing, modifying, reviewing, or generating a single line of code for Jovia. Where any other document, comment, prompt, or convenience conflicts with this Constitution, this Constitution wins.
>
> **Scope:** This Constitution applies to all code, infrastructure, configuration, documentation, AI models, prompts, data pipelines, and operational procedures that constitute the Jovia platform, regardless of environment (local, staging, production), regardless of authorship (human or AI), and regardless of repository ownership.
>
> **Amendment:** This Constitution may only be amended through a formal governance process involving the Jovia Architecture Council. No individual, team, or AI agent may override, bypass, or selectively apply any section. Additive changes require majority approval; modifications to existing rules require supermajority approval.

---

## Table of Contents

1. Engineering Philosophy
2. Engineering Governance
3. Code Quality Standards
4. Security Standards
5. Architecture Rules
6. Repository Standards
7. API Standards
8. Database Standards
9. Frontend Standards
10. AI Standards
11. Testing Standards
12. Performance Standards
13. Observability & Monitoring Standards
14. Logging Standards
15. Documentation Standards
16. Git Standards
17. DevOps & CI/CD Standards
18. Infrastructure & Cloud Architecture Standards
19. Incident Response & Disaster Recovery
20. Release Management
21. Technical Debt Policy
22. Versioning Policy
23. Migration Policy
24. Rollback Policy
25. Compatibility Policy
26. Privacy & Compliance Standards
27. Accessibility & Usability Standards
28. Internationalization & Localization Standards
29. Package & Dependency Management
30. Secrets & Environment Management
31. Configuration Management
32. Design Patterns & Anti-Patterns
33. Forbidden Practices
34. Instructions for AI Coding Agents
35. AI Self-Review Rules
36. Engineering Decision Rules
37. Quality Gates

---

## 1. Engineering Philosophy

Jovia is built to last, to scale, and to be understood by people who did not write it. Every decision, from naming a variable to choosing a data store, is judged against these principles, in this priority order when they conflict:

1. **Security by default.** No feature ships in a state that is "secure later." Insecure-but-fast is not a valid intermediate state. Security is not a feature to be added; it is a property to be preserved.
2. **Safety over convenience.** Operations that could harm users, data, or system integrity require explicit confirmation, audit trails, and fail-closed behavior. Convenience never overrides safety.
3. **Simplicity over cleverness.** The simplest solution that correctly solves the problem is the correct solution. Clever code is a liability, not an asset. Complexity must justify itself with documented, measured necessity.
4. **Readability over brevity.** Code is read far more often than it is written. A longer, obvious implementation beats a shorter, obscure one. Optimize for the next reader, not the current writer.
5. **Maintainability first.** Every module must be changeable by someone who is not its author, six months from now, without fear. Code that cannot be maintained is debt, not deliverable.
6. **Modular design.** Systems are composed of small, independently testable, independently deployable units with explicit contracts between them. Monoliths are permitted only when bounded contexts are rigorously enforced internally.
7. **AI-first architecture.** Jovia is built assuming AI agents will read, extend, and modify the codebase. Code, data, and documentation must be structured so an agent can reason about them without hidden context or tribal knowledge.
8. **Explicit over implicit.** Configuration, dependencies, contracts, and side effects are declared, not inferred or assumed. Magic is forbidden. Convention must be documented and enforced by tooling, not by memory.
9. **Boring technology wins.** Novelty must justify itself with a concrete, documented advantage backed by evidence. Default to proven, well-understood tools with strong ecosystems. Technology adoption requires an Architecture Decision Record (ADR).
10. **Fail loud, fail early.** Errors are surfaced immediately, with full context, rather than silently swallowed, masked, or deferred. Silent failures are the most dangerous failures.
11. **Everything is disposable, nothing is precious.** Any component may need to be rewritten. Design for replaceability, not permanence of implementation. Interfaces outlive implementations.
12. **Data integrity is non-negotiable.** Data corruption is unacceptable at any scale. Every operation that modifies data must be atomic, consistent, isolated, and durable where those properties are required.
13. **Observability is a requirement, not an option.** If you cannot observe it, you cannot operate it. Every system must emit metrics, logs, and traces sufficient to debug production issues without code changes.
14. **Backward compatibility is a contract.** Breaking changes require explicit versioning, migration paths, and deprecation timelines. Users and downstream systems must never be surprised by breakage.

These principles apply equally to code written by a human and code generated by an AI agent. Authorship does not lower the bar. Environment does not lower the bar. Deadline pressure does not lower the bar.

---

## 2. Engineering Governance

### 2.1 Authority Structure
- The **Architecture Council** is the final arbiter of all architectural decisions, technology adoptions, and constitutional amendments.
- **Domain Owners** own specific bounded contexts and are responsible for their design, quality, and operational health.
- **Tech Leads** enforce this Constitution within their teams and escalate conflicts to the Architecture Council.
- **AI Agents** operate under the same authority structure as human contributors. An AI agent does not have autonomy to override standards, skip gates, or make architectural decisions without human review.

### 2.2 Decision Rights
- **Local decisions** (variable naming, function decomposition, test cases) are made by the implementing engineer or AI agent, subject to code review.
- **Contextual decisions** (module boundaries, API contracts, database schema changes) require Domain Owner approval and an ADR.
- **Global decisions** (new languages, new cloud providers, new architectural patterns, constitutional amendments) require Architecture Council approval.

### 2.3 Escalation Path
- Disagreements about standards interpretation are escalated to the Tech Lead.
- Disagreements about architecture are escalated to the Domain Owner.
- Disagreements about cross-domain impact are escalated to the Architecture Council.
- No decision may be made by bypassing the escalation path due to urgency. Urgency is not a justification for circumventing governance.

### 2.4 Review Cadence
- This Constitution is reviewed annually by the Architecture Council.
- ADRs are reviewed quarterly for relevance and obsolescence.
- Technology radar is updated bi-annually to assess tool lifecycle status.

---

## 3. Code Quality Standards

All code in Jovia — regardless of language or layer — must satisfy the following, without exception:

### 3.1 Clean Code
- Names reveal intent: no abbreviations, no single-letter variables outside trivial loop counters, no `data`, `temp`, `obj`, `handler2`, `manager`, `utils`, `helper`, `processor`, `service` without qualifying context.
- Functions do one thing, are small (as a guideline, under ~30 lines), and operate at a single level of abstraction. A function that does two things violates the Single Responsibility Principle.
- Comments explain *why*, never *what* — code that needs a comment to explain what it does should be rewritten to be self-explanatory. Comments must be kept current; outdated comments are defects.
- No dead code, no commented-out code, no debug `console.log`/`print` left in committed code. No TODO comments without a linked ticket number and expiration date.
- No magic numbers or magic strings. All constants are named and centralized in configuration or named constants.
- No nested control structures deeper than three levels. Extract into well-named functions.

### 3.2 SOLID
- **S**ingle Responsibility: one class/module, one reason to change. A class with more than one responsibility is a class that will be changed for more than one reason, increasing fragility.
- **O**pen/Closed: extend behavior via composition or interfaces, not by modifying stable, tested code. The stable parts of the system must remain closed to modification.
- **L**iskov Substitution: subtypes must be usable anywhere their base type is expected, without surprises. Violations of LSP break polymorphism and trust in abstractions.
- **I**nterface Segregation: many small, focused interfaces over one large interface. Clients must not depend on methods they do not use.
- **D**ependency Inversion: high-level modules depend on abstractions, never on concrete low-level implementations. Concrete details depend on abstractions.

### 3.3 DRY, KISS, YAGNI
- **DRY**: duplicated logic is extracted into a single, shared, tested source of truth. Duplication of *knowledge*, not incidental similarity of code shape, is what must be eliminated. Copy-paste is a code smell, not a solution.
- **KISS**: the straightforward solution is preferred unless a documented, measured requirement demands more complexity. Complexity is a cost that compounds.
- **YAGNI**: no speculative abstraction, no configuration flags for features that do not yet exist, no extensibility hooks for requirements that are not yet defined, no premature optimization without profiling data.

### 3.4 Composition & Structure
- Prefer composition over inheritance; inheritance is reserved for genuine "is-a" relationships with stable hierarchies. Favor "has-a" over "is-a".
- Dependency Injection is mandatory for all services, repositories, and external integrations — no hard-coded `new SomeExternalClient()` inside business logic. Use constructor injection as the default pattern.
- Separation of Concerns is enforced at every layer: presentation, application/use-case, domain, and infrastructure never bleed into one another. A domain model must not import an HTTP framework. A repository must not format JSON responses.

### 3.5 Style & Consistency
- One formatter, one linter configuration per language, enforced automatically in CI — never by convention alone. Pre-commit hooks must run formatting and linting.
- Naming, casing, and file layout are consistent across the entire codebase; local style preferences are not permitted. The project style guide is the single source of truth.
- Import order is standardized and enforced by tooling. Wildcard imports are forbidden.
- Maximum line length, file length, and function length are enforced by linting rules, not by human judgment during review.

### 3.6 Error Handling
- All errors are handled explicitly. Silent catch blocks are forbidden.
- Exceptions are used for exceptional conditions, not for control flow.
- Error messages are actionable, specific, and include context (correlation IDs, operation names, relevant identifiers) without exposing sensitive data.
- Custom exception hierarchies are preferred over generic exceptions. Each layer throws domain-appropriate exceptions.
- Fail-fast validation at system boundaries prevents invalid data from propagating inward.

### 3.7 Concurrency & Parallelism
- Shared mutable state is minimized. Prefer immutable data structures and message passing.
- Locks, mutexes, and semaphores are used only when necessary and always with documented invariants and timeout policies.
- Race conditions are prevented by design, not by hope. Every concurrent data structure choice is justified in code comments.
- Thread pool sizes, connection pool sizes, and queue sizes are explicitly configured and bounded. Unbounded queues and pools are forbidden.

---

## 4. Security Standards

Jovia treats security as a default state, not a feature. Every AI agent and developer must apply the following before code is considered complete.

### 4.1 Foundational Posture
- **Zero Trust**: no request, service, or user is trusted by default — every call is authenticated and authorized, including internal service-to-service calls. The network is assumed hostile.
- **Least Privilege**: every identity (user, service, token, database role, CI/CD runner) receives the minimum permissions required, nothing more. Permissions are granted explicitly, never by default.
- **Defense in Depth**: security controls exist at every layer (network, infrastructure, application, data). No single control is the sole line of defense.
- **OWASP Top 10** is the non-negotiable baseline threat model for every feature: injection, broken authentication, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, vulnerable components, insufficient logging.
- **Supply Chain Security**: all dependencies are scanned for known vulnerabilities on every build; critical/high findings block release. Software Bills of Materials (SBOMs) are generated for every release.
- **Threat Modeling**: every new feature, API, or architectural change undergoes lightweight threat modeling (STRIDE or equivalent) before implementation. Threat models are reviewed in pull requests.

### 4.2 Authentication & Authorization
- Passwords are hashed with a modern, slow, salted algorithm (Argon2id or bcrypt with an appropriate work factor) — never MD5, SHA1, or unsalted hashes. Password complexity requirements are documented and enforced.
- JWTs are short-lived, signed with strong algorithms (never `alg: none`), validated for signature/issuer/audience/expiry on every request, and never store sensitive data in the payload. Refresh tokens are single-use and rotated.
- Sessions are invalidated on logout, password change, and privilege change; session tokens are rotated on privilege escalation.
- Authorization checks happen on the server for every protected resource, never trusting client-side role claims alone. Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) are implemented at the API gateway and service layer.
- Multi-Factor Authentication (MFA) is required for all production administrative access and for all user accounts with elevated privileges.

### 4.3 Web Application Security
- **CSRF**: state-changing requests require anti-CSRF tokens or equivalent same-site/double-submit protections.
- **XSS**: all user-supplied content is output-encoded for its context; templating engines' auto-escaping is never disabled without documented justification. Content Security Policy (CSP) headers are enforced.
- **SQL Injection**: parameterized queries or ORM query builders only — string concatenation into queries is forbidden. Raw SQL requires explicit security review.
- **SSRF**: outbound requests built from user input are validated against an allow-list of destinations; internal network ranges are blocked by default.
- **File Upload**: file uploads are validated for type, size, and content; stored outside the web root; served with correct MIME types and without execution permissions.

### 4.4 Secrets & Data Protection
- Secrets (API keys, credentials, private keys, database passwords) live only in a secrets manager or environment-injected configuration — never in source control, logs, client-side code, or container images.
- Data is encrypted in transit (TLS 1.3 everywhere) and at rest for sensitive fields; encryption keys are managed and rotated, never hard-coded. Key rotation procedures are documented and tested.
- Personally Identifiable Information (PII) is minimized, encrypted at rest, and access-logged. Data retention policies are enforced automatically.
- Cryptographic agility is maintained: algorithms and key lengths are documented, and migration paths to stronger algorithms are planned before current algorithms become deprecated.

### 4.5 API & Operational Security
- All public endpoints are rate-limited; authentication endpoints have stricter limits with exponential backoff.
- Every security-relevant event (login, permission change, data export, failed auth, privilege escalation) is captured in an immutable audit log with tamper-evident properties.
- Dependencies are scanned for known vulnerabilities on every build; critical/high findings block release. Vulnerability scanning includes containers, base images, and transitive dependencies.
- Penetration testing is conducted annually by an independent third party. Findings are tracked to resolution with SLA-based timelines.

---

## 5. Architecture Rules

### 5.1 Layered Architecture
- **Clean Architecture / Layered boundaries**: dependencies point inward — domain logic never imports from infrastructure or presentation layers. The Domain layer knows nothing of HTTP, SQL, or UI frameworks.
- **Domain-Driven Design**: business logic is organized around bounded contexts with a shared, precise ubiquitous language; domain models are free of framework or persistence concerns. Aggregates, Entities, Value Objects, and Domain Services are used appropriately.
- **Modular Architecture**: each module exposes a narrow, explicit public interface; internals are never reached into from outside the module. Package-private or internal visibility modifiers enforce this.
- **CQRS**, where a bounded context has meaningfully divergent read/write scaling or complexity needs, separates command (write) and query (read) models — never applied by default for simple CRUD.
- **Event-Driven Architecture**: cross-context communication that does not require an immediate synchronous response uses events; producers do not depend on knowledge of consumers. Event schemas are versioned and documented.
- **Microservice/module boundaries** align with bounded contexts and team ownership, not with arbitrary technical layering; a boundary is only justified when it reduces coupling more than it adds operational cost.
- **Layer responsibilities** are fixed and never mixed:
  - **Presentation** (I/O, validation of shape, serialization)
  - **Application** (use-case orchestration, transaction boundaries, DTO mapping)
  - **Domain** (business rules, invariants, domain events)
  - **Infrastructure** (persistence, external systems, messaging, file storage)

### 5.2 API Gateway & Service Mesh
- All external traffic enters through an API Gateway that handles authentication, rate limiting, request routing, and SSL termination.
- Service-to-service communication uses mutual TLS (mTLS) where feasible. Service mesh is used for traffic management, observability, and security policy enforcement.
- Circuit breakers are implemented for all external service calls. Fallback behavior is defined and tested.

### 5.3 Data Architecture
- Data ownership follows bounded context boundaries. No context directly accesses another context's database.
- The API is the contract; the database is an implementation detail. No external system queries another system's database directly.
- Eventual consistency is acknowledged and designed for. Sagas or outbox patterns are used for distributed transactions where strong consistency is required across contexts.

### 5.4 Scalability & Resilience
- Services are stateless where possible. Session state is externalized to Redis or equivalent.
- Horizontal scaling is preferred over vertical scaling. Auto-scaling policies are defined with scale-up and scale-down triggers.
- Graceful degradation is designed into every feature. Core functionality must survive the failure of non-critical dependencies.
- Bulkheads and circuit breakers prevent cascading failures. Timeouts are explicit and generous but bounded.

---

## 6. Repository Standards

### 6.1 Folder & File Organization
- **Folder naming**: lowercase, kebab-case for directories; consistent depth and grouping by feature/domain over by technical type where the codebase scale warrants it.
- **File naming**: consistent, descriptive, and matching the primary export/class/component name; test files mirror the file they test with a standard suffix (e.g., `.test`, `.spec`).
- **Package organization**: each package/module has a single clear purpose, an explicit public entry point (e.g., `index.ts`, `__init__.py`), and no circular dependencies between packages.
- **Import rules**: no deep-reaching into another module's internal files; only a module's declared public API may be imported. Absolute imports are preferred over long relative paths (`../../../` is a smell).

### 6.2 Dependency Management
- **New third-party dependencies require justification**: they cannot be reasonably built in-house within scope, must be actively maintained (commits within last 6 months, responsive maintainers), have an acceptable license (OSI-approved for open source, commercially viable for proprietary), and a clean security posture (no unpatched critical CVEs).
- **Dependency versions are pinned** and updated deliberately, not silently. Lock files are committed and reviewed.
- **Vulnerability scanning** runs on every build. Critical and high-severity vulnerabilities in dependencies block deployment until remediated or explicitly accepted with risk documentation.
- **Dependency drift** is monitored. Dependencies more than two major versions behind are flagged for upgrade planning.
- **Internal dependencies** are versioned and published to a private artifact registry. Cross-service dependencies use semantic versioning.

### 6.3 Monorepo vs. Polyrepo
- The default is a monorepo for tightly coupled domains to enable atomic changes and shared tooling.
- Polyrepo is permitted only when services are truly independent (separate deployment cadence, separate teams, no shared domain logic) and the operational overhead is justified by an ADR.

---

## 7. API Standards

### 7.1 REST Conventions
- Resources are nouns, HTTP verbs express intent (GET/POST/PUT/PATCH/DELETE), URLs are consistent and hierarchical (e.g., `/farms/{id}/sensors`).
- Collection endpoints use plural nouns (`/users`, not `/user`).
- Filtering, sorting, and pagination are exposed through explicit, documented, validated query parameters — never raw pass-through of client input into queries.
- **Pagination**: all list endpoints are paginated by default (cursor-based preferred for large/real-time datasets); unbounded result sets are forbidden.
- **Idempotency**: all mutating endpoints that are not naturally idempotent (POST for creation) support idempotency keys to prevent duplicate operations.
- **HTTP status codes** are used correctly and consistently: 200/201/204 for success variants, 400 for validation, 401 for unauthenticated, 403 for unauthorized, 404 for missing resources, 409 for conflicts, 422 for semantic errors, 429 for rate limits, 5xx reserved strictly for server faults.

### 7.2 GraphQL (where used)
- Schema-first design, explicit nullability, no over-fetching by default, depth/complexity limiting to prevent abuse.
- Query cost analysis prevents expensive queries. Persisted queries are preferred for production.
- Mutations are single-purpose and return the modified resource or a mutation payload pattern.

### 7.3 API Versioning
- Breaking changes require a new API version; old versions are deprecated on a published, documented timeline — never removed silently.
- Version is indicated in the URL path (`/v1/`, `/v2/`) or via a stable `Accept` header with versioned media types.
- Deprecation notices include sunset dates, migration guides, and proactive communication to consumers.
- At minimum, one previous major version remains supported for 6 months after deprecation notice.

### 7.4 Error Responses
- A single, consistent error envelope across every endpoint: `code`, `message`, `details`, `trace_id`/`correlation_id`, `timestamp`.
- Error codes are machine-readable and documented in a central registry.
- Stack traces and internal details are never exposed in production error responses.
- Validation errors include field-level detail indicating which fields failed and why.

### 7.5 Rate Limiting & Throttling
- All public endpoints are rate-limited per client identity.
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included in responses.
- Authentication endpoints have stricter rate limits with exponential backoff to prevent brute force.

### 7.6 Documentation
- OpenAPI (Swagger) specifications are maintained for all REST APIs and kept in sync with code.
- GraphQL schemas are introspectable and documented.
- API documentation includes request/response examples, error scenarios, rate limits, and authentication requirements.

---

## 8. Database Standards

### 8.1 Schema Design
- **Naming conventions**: snake_case for tables and columns, singular or plural applied consistently across the entire schema, foreign keys named `{referenced_table_singular}_id`.
- **Constraints**: NOT NULL, UNIQUE, CHECK, and foreign key constraints are enforced at the database level — application-level validation alone is never sufficient.
- **Indexing**: every foreign key and every column used in frequent filtering, sorting, or joining is indexed; indexes are reviewed against actual query plans (EXPLAIN ANALYZE), not guessed.
- **Foreign keys**: relationships are always enforced with real foreign key constraints, not just implied by naming convention.
- **Soft delete policy**: records subject to audit, recovery, or regulatory requirements use a soft-delete flag/timestamp rather than physical deletion; all queries must explicitly account for soft-deleted rows via query builders or repository patterns.

### 8.2 Transactions
- Any multi-step write that must succeed or fail atomically is wrapped in a database transaction.
- Isolation level is chosen deliberately, not left at a silent default when correctness depends on it. Document why the chosen isolation level is sufficient.
- Distributed transactions across services use the Saga pattern or Outbox pattern, not two-phase commit.

### 8.3 Migrations
- Schema changes are versioned, forward-only in production, reversible in design where feasible, and never edited after being applied to a shared environment.
- Migrations are idempotent where possible and tested in staging before production.
- Backward-compatible migrations are required: additive changes only (new columns, new tables). Destructive changes (dropping columns, changing types) require a multi-step migration process: add new, dual-write, migrate data, switch reads, remove old.
- Migration scripts are reviewed like application code. No manual DDL in production except in documented emergency procedures.

### 8.4 Query Standards
- N+1 queries are forbidden. Use eager loading, JOINs, or batch queries.
- SELECT * is forbidden in production code. Explicit column lists are required.
- Queries are reviewed for performance with EXPLAIN ANALYZE before deployment.
- Database views and materialized views are documented, versioned, and have defined refresh strategies.

### 8.5 Replication & High Availability
- Production databases run with streaming replication and automatic failover.
- Read replicas are used for read-heavy workloads. Write operations never target read replicas.
- Backup strategies are documented: point-in-time recovery (PITR) is the target RPO. Backup restoration is tested quarterly.

---

## 9. Frontend Standards

### 9.1 Component Design
- Components are small, single-purpose, and composable; presentational components are separated from container/state-owning components.
- Component files do not exceed 200 lines. Extraction into sub-components is mandatory beyond this limit.
- Props are explicitly typed (TypeScript interfaces, PropTypes, or equivalent). `any` is forbidden without documented justification.
- Side effects are isolated in dedicated hooks or lifecycle methods, not scattered through render logic.

### 9.2 Accessibility (a11y)
- **WCAG 2.1 AA** is the minimum bar — semantic HTML, keyboard navigability, sufficient color contrast (4.5:1 for normal text, 3:1 for large text), ARIA only where semantic HTML is insufficient.
- All interactive elements are keyboard accessible. Focus management is explicit and visible.
- Screen reader testing is performed for critical user journeys. Automated a11y testing (axe-core, Lighthouse) runs in CI for every build.
- Color is never the sole means of conveying information. Status indicators use color + text + icon.
- Form validation errors are associated with fields via `aria-describedby`, and focus is moved to errors on submission failure.

### 9.3 Performance
- Code-splitting and lazy loading for non-critical routes/components; images and assets are optimized and sized appropriately; Core Web Vitals are tracked, not assumed.
- Bundle size budgets are enforced in CI. Regressions block merge.
- Images use modern formats (WebP, AVIF), responsive sizing, and lazy loading.
- Third-party scripts are loaded asynchronously and their impact on performance is monitored.

### 9.4 State Management
- Local state stays local; shared/global state is introduced only when genuinely shared, with a single, explicit source of truth per piece of state.
- State mutations are immutable. Direct state mutation is forbidden.
- Side effects (API calls, local storage) are managed through consistent patterns (Redux-Saga, RTK Query, React Query, or equivalent).

### 9.5 UI Consistency
- A shared design system/token set (color, spacing, typography) is the only source of visual values — no ad-hoc magic numbers or one-off colors in component code.
- Design tokens are versioned and consumed via a shared package.
- Component library changes require visual regression testing.

### 9.6 Responsive Behavior
- Layouts are designed mobile-first and validated across breakpoints; no fixed-pixel layouts that break on smaller viewports.
- CSS logical properties (`inline-start`, `block-end`) are preferred over directional properties (`left`, `right`) to support RTL languages.
- Touch targets are minimum 44x44 CSS pixels.

---

## 10. AI Standards

Jovia's own AI features (and the AI agents that build Jovia) are held to explicit engineering discipline, not treated as a black box.

### 10.1 Prompt Management
- Prompts are version-controlled, not hard-coded inline scattered across the codebase; changes to production prompts go through the same review process as code.
- Prompts are stored in dedicated files or a prompt registry, not embedded as string literals in application code.
- Prompt versions are tagged and correlated with model versions. A change to a prompt is a code change.

### 10.2 Context Management
- Only the minimum necessary context is passed to a model; context sources and their trust level are explicit and documented.
- Context windows are monitored and managed. Token usage is tracked and optimized.
- PII is never passed to external LLM APIs without explicit anonymization or data processing agreements.

### 10.3 Embeddings & Vector Stores
- Embedding model choice, dimensionality, and versioning are documented; re-embedding strategy is defined for model upgrades.
- Vector store schemas are versioned. Metadata filters are explicit and access-controlled.
- Similarity thresholds are tuned and monitored. Retrieval results are logged for quality analysis.

### 10.4 RAG (Retrieval-Augmented Generation)
- Retrieval sources are curated and access-controlled; retrieved content is never blindly trusted — provenance is tracked and surfaced.
- Retrieved context is ranked and filtered before injection into prompts. Low-relevance retrieval is discarded, not stuffed.
- RAG pipelines include evaluation metrics: relevance, precision, recall, and answer faithfulness.

### 10.5 Hallucination Prevention
- Outputs that state facts must be grounded in retrieved or verifiable data where the domain requires accuracy (e.g., agricultural recommendations); unverified model output is clearly distinguished from verified data in the UI.
- High-stakes AI outputs (medical, financial, safety-critical) require human-in-the-loop review or explicit confidence thresholds.
- Confidence scores or uncertainty indicators are surfaced to users for AI-generated recommendations.

### 10.6 AI Explainability
- Any AI-driven decision that affects a user (recommendation, alert, score) must be traceable to the inputs and logic that produced it.
- Decision logs include: model version, prompt version, input features, retrieved context, and output.
- Users can request explanation of AI-driven decisions affecting them.

### 10.7 AI Safety
- AI features fail closed on uncertainty (abstain or flag for human review) rather than confidently guessing on high-stakes outputs (e.g., irrigation or pesticide recommendations).
- Guardrails prevent harmful outputs: hate speech, dangerous instructions, private data leakage, and jailbreak attempts.
- Model outputs are validated against output schemas before being presented to users or acted upon by systems.

### 10.8 Model Versioning & Lifecycle
- All production models are pinned to specific versions. "Latest" or dynamic model selection is forbidden in production without explicit canary testing.
- Model updates require A/B testing or shadow mode evaluation before full rollout.
- Model drift is monitored. Performance degradation triggers automatic alerts and rollback procedures.
- Training data pipelines are versioned and reproducible. Data lineage is tracked from source to model.

---

## 11. Testing Standards

### 11.1 Test Pyramid
- **Unit tests** cover business logic and pure functions in isolation, with dependencies mocked/stubbed at clear boundaries. Target: fast (< 100ms per test), deterministic, no I/O.
- **Integration tests** verify that modules, services, and their real dependencies (database, queues, external APIs via test doubles) work together correctly. Target: validate wiring and protocol compliance.
- **End-to-end tests** cover critical user journeys through the full stack, run against production-like environments. Target: validate user-facing behavior, not implementation details.
- **Contract tests** verify API contracts between services. Consumer-driven contract tests are preferred.
- **Performance tests** validate response times and throughput against defined budgets for critical paths before release.
- **Security tests** include dependency scanning, static analysis (SAST), dynamic analysis (DAST), and targeted testing of authentication/authorization paths.

### 11.2 Coverage Requirements
- A minimum coverage threshold is enforced by CI for business-critical modules (domain and application layers); coverage is a floor, not a target to game — meaningful assertions matter more than percentage.
- Coverage reports are reviewed in pull requests. New code must not reduce overall coverage.
- Mutation testing is used periodically to assess test quality, not just coverage quantity.

### 11.3 Test Quality
- Tests are deterministic. Flaky tests are treated as P1 bugs and fixed or quarantined within 24 hours.
- Tests are independent. Test order must not matter. Shared state between tests is forbidden.
- Test names describe behavior, not implementation: `should_reject_invalid_email_format`, not `test_validate_email_1`.
- Test data is explicit and minimal. Global test fixtures are documented and scoped.
- Tests run in CI on every commit. Local test runs must be possible without production credentials.

### 11.4 Test Environments
- Test environments mirror production in architecture, not necessarily in scale.
- Production data is never used in tests. Synthetic data generators create realistic but anonymized test datasets.
- Database tests use transactions that roll back after each test or use dedicated test databases.

---

## 12. Performance Standards

### 12.1 Service Level Objectives (SLOs)
- API endpoints target defined p95/p99 latency budgets per endpoint class (e.g., simple reads < 100ms p95, complex aggregations < 500ms p95); budgets are documented and monitored, not assumed.
- Error budgets are defined. Breaching an error budget triggers a freeze on non-essential changes for the affected service until the budget recovers.
- Availability targets are defined per service tier (e.g., Tier 1: 99.99%, Tier 2: 99.9%, Tier 3: 99.5%).

### 12.2 Optimization Practices
- **Lazy loading**: heavy resources (large datasets, non-critical UI, large media) are loaded on demand, not eagerly on initial load.
- **Caching**: cacheable data is cached at the appropriate layer (CDN, application, database query) with explicit invalidation strategy — stale-but-served data must be an intentional decision, not an accident.
- **Database optimization**: queries are reviewed for N+1 patterns, missing indexes, and unnecessary data fetched; pagination and projection are used to avoid over-fetching.
- **Bundle optimization**: frontend bundles are analyzed for size regressions; unused code and dependencies are eliminated; critical rendering path assets are minimized.

### 12.3 Capacity Planning
- Load testing is performed before major releases and seasonal traffic events.
- Capacity headroom is maintained: production infrastructure must handle 2x expected peak load without degradation.
- Auto-scaling policies are tested and tuned. Scale-up must be proactive, not reactive.

### 12.4 Resource Efficiency
- Memory leaks are treated as critical bugs. Heap profiling is performed for long-running services.
- CPU profiling identifies hot paths. Premature optimization is avoided, but profile-guided optimization is mandatory for identified bottlenecks.
- Idle resources are scaled down or terminated. Cost optimization is a shared engineering responsibility.

---

## 13. Observability & Monitoring Standards

### 13.1 Three Pillars
- **Metrics**: quantitative data about system behavior (latency, throughput, error rates, resource utilization). Metrics use consistent naming conventions and include labels/dimensions for filtering.
- **Logs**: structured, timestamped records of discrete events. Logs are the answer to "what happened?"
- **Traces**: end-to-end request flows across distributed services. Traces are the answer to "where did the time go?"

### 13.2 Instrumentation
- All services emit the three pillars by default. Instrumentation is not optional.
- **RED metrics** are standard for services: Rate (requests/sec), Errors (error rate), Duration (latency distribution).
- **USE metrics** are standard for resources: Utilization, Saturation, Errors.
- Business metrics (sign-ups, transactions, revenue events) are tracked alongside technical metrics.

### 13.3 Alerting
- Alerts are based on SLOs and symptoms, not on every possible failure mode. Alert fatigue is treated as an operational risk.
- Alerts include context: what is failing, impact assessment, links to runbooks, and recent deployments.
- Alert severity is standardized: P1 (wake people up), P2 (respond within business hours), P3 (track and fix during work), P4 (informational).
- Every alert has an owner and a runbook. Alerts without runbooks are not deployed.

### 13.4 Dashboards
- Dashboards are code-reviewed and version-controlled. Ad-hoc dashboards are permitted for investigation but must be promoted or deleted within 30 days.
- Dashboards follow a hierarchy: overview (system health) → service-level (component health) → detailed (debugging).
- Dashboards include annotations for deployments and incidents.

### 13.5 Distributed Tracing
- Every request is assigned a correlation ID at the edge and propagated through all services.
- Traces include service boundaries, database queries, external API calls, and cache operations.
- Sampling is configured to balance cost and coverage. Critical paths use higher sampling rates.

---

## 14. Logging Standards

### 14.1 Structured Logging
- Logs are emitted as structured data (JSON) with consistent fields: `timestamp`, `service`, `level`, `correlation_id`/`trace_id`, `message`, `context`. Unstructured free text logs are forbidden in production.
- Log levels are used consistently: DEBUG (detailed diagnostics), INFO (normal operations), WARN (unexpected but handled), ERROR (failed operations), FATAL (system unrecoverable).

### 14.2 Error Logging
- All unhandled exceptions are logged with full context (stack trace, request id, relevant non-sensitive input) — errors are never silently swallowed.
- Error logs include actionable context: what operation was attempted, what input was received, what resource was involved.

### 14.3 Security Logging
- Authentication attempts, authorization failures, and privilege changes are always logged, separate from general application logs where feasible.
- Security logs are immutable and retained per policy (minimum 1 year for production).

### 14.4 Audit Logging
- Actions that change state or access sensitive data are recorded in an audit trail that is immutable and retained per policy — audit logs are never mixed with debug-level noise.
- Audit logs include: actor identity, action performed, target resource, timestamp, source IP, and outcome.

### 14.5 Privacy
- Logs never contain secrets, passwords, full payment details, or unredacted personally identifiable information.
- PII in logs is minimized. Where necessary, it is hashed or tokenized.

---

## 15. Documentation Standards

### 15.1 Required Documentation
- Every public module, service, and API must be documented at the point of creation — documentation is not a follow-up task.
- Documentation states purpose, inputs/outputs, side effects, error conditions, and ownership.
- Runbooks exist for every alert, every deployment procedure, and every incident type.
- Architecture Decision Records (ADRs) capture context, decision, alternatives considered, and consequences for every significant architectural choice.

### 15.2 Metadata Standard
- Documentation follows the Jovia Knowledge Base metadata standard (Authority, AI Context, Lifecycle status, Read Before/After) so both humans and AI agents can navigate it reliably.
- Documents include a "Last Verified" date. Outdated documentation is treated as a defect.

### 15.3 Maintenance
- Documentation is updated in the same change/PR that changes the behavior it describes — outdated documentation is treated as a defect.
- README files exist at every repository root and every significant subdirectory. They explain what the code does, how to build it, how to test it, and how to contribute.
- API documentation is generated from code annotations and verified in CI to prevent drift.

### 15.4 Onboarding
- New engineers have a documented onboarding path that includes environment setup, codebase tour, and first contribution guide.
- Domain glossaries define ubiquitous language terms and are kept synchronized with code.

---

## 16. Git Standards

### 16.1 Commit Format
- Commits follow a conventional, structured format: `type(scope): concise description` (e.g., `fix(auth): reject expired refresh tokens`), written in the imperative mood.
- The body explains *why* when the change is non-trivial. The body references issue tickets and ADRs.
- Breaking changes are explicitly marked with `BREAKING CHANGE:` in the commit body.
- Commits are signed (GPG or SSH signing) for non-repudiation.

### 16.2 Branch Strategy
- A documented, consistent branching model is used project-wide — no ad-hoc branch naming or long-lived divergent branches.
- The default is trunk-based development with short-lived feature branches (lifespan < 3 days).
- Long-lived feature branches require explicit justification and daily rebasing.
- Branch names follow convention: `feature/JIRA-123-short-desc`, `fix/JIRA-456-bug-desc`, `hotfix/critical-issue`.

### 16.3 Pull Request Rules
- Every change to shared branches goes through a PR; PRs are scoped to a single logical change.
- PRs include a clear description of intent, testing performed, and links to relevant issues/ADRs.
- PRs must pass all quality gates (CI, tests, linting, security scans) before human review is requested.
- PRs are kept small (< 400 lines changed) to enable effective review. Large changes are split.

### 16.4 Code Review Policy
- No PR merges without at least one independent review; reviewers verify adherence to this Constitution, not just functional correctness.
- AI-generated code is reviewed with the same rigor as human-written code — never merged unreviewed on the basis of having been "AI-written."
- Reviewers are accountable for what they approve. "LGTM" without substantive review is a policy violation.
- Review turnaround time is SLA-bound: 24 hours for standard PRs, 4 hours for hotfixes.

---

## 17. DevOps & CI/CD Standards

### 17.1 Continuous Integration
- Every commit triggers a CI pipeline that builds, tests, lints, and security-scans the code.
- CI pipelines fail fast: linting and unit tests run before integration tests.
- CI environments are ephemeral and reproducible. CI configuration is version-controlled (pipeline-as-code).
- Build artifacts are immutable, tagged with commit SHA, and retained per policy.

### 17.2 Continuous Deployment
- Deployment to staging is automatic upon successful CI. Deployment to production requires explicit approval or automated canary success criteria.
- Deployments are atomic and reversible. Blue-green or canary deployment strategies are used for zero-downtime releases.
- Feature flags decouple deployment from release. New features are deployed dark and enabled progressively.
- Deployment pipelines include smoke tests and health checks that automatically rollback on failure.

### 17.3 Pipeline Security
- CI/CD pipelines run with minimal privileges. Secrets injected into pipelines are scoped and time-limited.
- Pipeline definitions are code-reviewed. Third-party CI actions/plugins are pinned to specific versions and scanned.
- Build provenance is tracked. SBOMs are generated and signed for every release.

### 17.4 Environment Parity
- Development, staging, and production environments are provisioned from the same Infrastructure-as-Code definitions.
- Configuration differences between environments are explicit and minimal. "Works on my machine" is not an acceptable excuse for production failures.
- Staging must mirror production architecture. Data in staging is anonymized production data or high-fidelity synthetic data.

---

## 18. Infrastructure & Cloud Architecture Standards

### 18.1 Infrastructure as Code (IaC)
- All infrastructure is defined as code (Terraform, CloudFormation, Pulumi, or equivalent) and version-controlled.
- IaC changes follow the same PR review process as application code.
- State files are stored remotely with locking and versioning.
- Drift detection runs periodically. Unmanaged infrastructure is flagged for import or termination.

### 18.2 Cloud Principles
- Multi-region or multi-AZ deployment is required for Tier 1 services.
- Resources are tagged with ownership, cost center, environment, and compliance classification.
- Auto-scaling is configured for all stateless services. Scaling policies are tested.
- Serverless functions have explicit timeout, memory, and concurrency limits.

### 18.3 Networking
- Network segmentation is enforced. Production, staging, and development are isolated.
- Ingress is restricted to minimum necessary ports and sources. Default-deny security groups are the baseline.
- Internal services communicate over private networks where possible. Public exposure requires explicit justification.
- DDoS protection and WAF are enabled for all public-facing endpoints.

### 18.4 Container Standards
- Container images are built from minimal base images. Distroless or scratch images are preferred for production.
- Images are scanned for vulnerabilities before push to registry. Critical vulnerabilities block deployment.
- Containers run as non-root. Read-only root filesystems are enforced where feasible.
- Resource limits (CPU, memory) are explicitly set for all containers.

---

## 19. Incident Response & Disaster Recovery

### 19.1 Incident Response
- **Severity levels** are standardized: SEV1 (critical business impact), SEV2 (significant impact), SEV3 (minor impact), SEV4 (no user impact).
- **On-call rotations** are mandatory for production services. Escalation policies ensure coverage.
- **Incident command** follows a defined protocol: detect, triage, mitigate, resolve, postmortem.
- **Communication**: incidents are communicated transparently to stakeholders. Status pages are updated for user-facing incidents.
- **Blameless postmortems** are conducted within 48 hours of SEV1/SEV2 resolution. Action items are tracked to completion.

### 19.2 Disaster Recovery
- **RPO (Recovery Point Objective)** and **RTO (Recovery Time Objective)** are defined per service tier and tested annually.
- Backups are encrypted, geographically distributed, and tested for restoration quarterly.
- Runbooks exist for failover procedures, including database promotion, DNS failover, and traffic rerouting.
- Chaos engineering exercises validate resilience assumptions. Game days are conducted semi-annually.

### 19.3 Business Continuity
- Critical services have documented failover to standby regions.
- Data replication across regions is monitored. Replication lag alerts are configured.
- Contact trees and escalation procedures are documented and tested.

---

## 20. Release Management

### 20.1 Release Planning
- Releases are planned, not accidental. Release notes are generated from commit history and manual curation.
- Release candidates are tagged and deployed to staging for final validation.
- Release checklists include: feature completeness, test results, security scan results, performance validation, and documentation updates.

### 20.2 Release Cadence
- Frequent small releases are preferred over infrequent large releases. The target is continuous delivery with feature flags controlling user-visible changes.
- Release windows are communicated in advance. Emergency releases bypass the window but require post-hoc review.

### 20.3 Communication
- Releases are announced to stakeholders via defined channels.
- User-facing changes are documented in changelogs and user-facing release notes.
- Breaking changes are communicated with migration guides and deprecation timelines.

---

## 21. Technical Debt Policy

### 21.1 Definition & Tracking
- Technical debt is defined as any code, design, or infrastructure that is known to be suboptimal and incurs a future cost. Debt is not inherently bad, but unacknowledged debt is.
- A **Technical Debt Register** is maintained per domain. Each debt item includes: description, location, impact, estimated remediation effort, and risk level.
- Debt items are tracked in the backlog with the same visibility as features. They are prioritized against feature work based on interest rate (cost of delay).

### 21.2 Prevention
- New debt is flagged in code review. PRs that introduce debt without a ticket and plan are rejected.
- Refactoring is part of normal development, not a separate project. Teams allocate capacity for debt reduction.
- Architecture reviews assess whether proposed designs avoid structural debt.

### 21.3 Remediation
- High-interest debt (security risks, performance bottlenecks, blocking dependencies) is remediated within one sprint.
- Low-interest debt is scheduled based on team capacity and roadmap alignment.
- Debt remediation is celebrated and tracked as a metric.

---

## 22. Versioning Policy

### 22.1 Semantic Versioning
- All software artifacts use Semantic Versioning (MAJOR.MINOR.PATCH): MAJOR for breaking changes, MINOR for backward-compatible additions, PATCH for backward-compatible fixes.
- APIs, libraries, and services are versioned independently.
- Pre-release versions (alpha, beta, rc) are tagged and not deployed to production without explicit exception.

### 22.2 API Versioning
- REST APIs version in the URL path or via content negotiation. GraphQL APIs version via schema evolution.
- Deprecated versions are supported for a minimum deprecation period (6 months) with clear sunset dates.

### 22.3 AI Model Versioning
- AI models, prompts, and embeddings are versioned alongside application code. See Section 10.8.
- Composite version identifiers track all layers: logic, policy, model runtime, and tools.

---

## 23. Migration Policy

### 23.1 Database Migrations
- See Section 8.3. Migrations are forward-only in production.
- Backward-compatible schema changes are required. Destructive changes use expand-contract patterns.
- Migration scripts are idempotent and tested in staging.

### 23.2 Data Migrations
- Large data migrations run in batches to avoid table locks and replication lag.
- Data migrations are reversible where feasible. Dry-run validation is performed before execution.
- Data integrity checks verify migration correctness (row counts, checksums, sample validation).

### 23.3 Service Migrations
- Service replacements use strangler fig pattern: new service shadows old, then gradually takes traffic.
- API migrations maintain backward compatibility during transition. Consumers migrate on their own timeline within the deprecation window.

---

## 24. Rollback Policy

### 24.1 Rollback Triggers
- Rollback is triggered by: SEV1/SEV2 incidents, breached SLOs, security vulnerabilities, or failed smoke tests post-deployment.
- Rollback is a first-class operation, not an emergency hack. Rollback procedures are tested and documented.

### 24.2 Rollback Procedures
- **Application rollback**: revert to previous container image or artifact version. Target: < 5 minutes.
- **Database rollback**: forward-only migrations mean rollback is application-level, not schema-level. If schema rollback is unavoidable, it follows the expand-contract reverse.
- **Configuration rollback**: configuration changes are versioned and can be reverted independently of code.
- **Feature flag rollback**: disable the feature flag. Target: < 1 minute.

### 24.3 Rollback Safety
- Rollbacks do not lose user data created by the newer version. Data compatibility between versions is verified before deployment.
- Rollback procedures are tested in staging quarterly.
- Post-rollback, the root cause is investigated before re-deployment.

---

## 25. Compatibility Policy

### 25.1 Backward Compatibility
- Public APIs maintain backward compatibility within major versions. Breaking changes require a new major version.
- Database schemas are backward-compatible for at least one deployment cycle (expand-contract).
- Client libraries maintain backward compatibility for two minor versions.

### 25.2 Forward Compatibility
- APIs ignore unknown fields in requests (tolerant reader pattern).
- Consumers do not break on new, unknown fields in responses.
- Event schemas include version identifiers and default values.

### 25.3 Deprecation
- Deprecated features are documented, logged at runtime (deprecation warnings), and removed only after the published sunset date.
- Deprecation notices include migration paths and timelines.

---

## 26. Privacy & Compliance Standards

### 26.1 Data Privacy
- Privacy by Design is mandatory. Data collection is minimized to what is necessary.
- PII is mapped, classified, and access-controlled. Data Processing Agreements (DPAs) are in place with all third-party processors.
- User data deletion requests are honored within legal timelines and verified.
- Cross-border data transfers comply with applicable regulations (GDPR, etc.).

### 26.2 Regulatory Compliance
- Compliance requirements (GDPR, CCPA, SOC2, ISO 27001, etc.) are mapped to engineering controls.
- Evidence for audits is collected automatically: access logs, change logs, security scan results, penetration test reports.
- Compliance gaps are tracked as high-priority defects.

### 26.3 Data Retention
- Retention policies are defined per data classification and enforced automatically.
- Data beyond retention is purged securely, not just deleted from indexes.

---

## 27. Accessibility & Usability Standards

### 27.1 Accessibility
- WCAG 2.1 AA is the minimum. See Section 9.2 for technical requirements.
- Accessibility is tested in CI and during QA. Manual testing with assistive technology is performed for major features.
- Accessibility statements are published for user-facing products.

### 27.2 Usability
- User interfaces follow consistent patterns. Novel interaction patterns require usability testing.
- Error messages are written for humans, not engineers. They explain what went wrong and what to do next.
- Forms validate inline and provide clear, actionable feedback.

---

## 28. Internationalization & Localization Standards

### 28.1 Internationalization (i18n)
- All user-facing strings are externalized and never hard-coded. String concatenation for display is forbidden.
- Date, time, number, and currency formatting use locale-aware libraries.
- Text direction (LTR/RTL) is supported at the framework level. CSS logical properties are used.
- Character encoding is UTF-8 everywhere.

### 28.2 Localization (l10n)
- Translation workflows are integrated into the development process. Translation keys are reviewed like code.
- Pseudo-localization is used in development to test layout resilience (text expansion, RTL).
- Locale-specific content (images, legal text) is managed per locale.
- Translators receive context (screenshots, usage notes) to ensure accurate translation.

### 28.3 Testing
- UI is tested in all supported locales. Automated tests run with pseudo-localized strings.
- Screen reader testing is performed in target languages.

---

## 29. Package & Dependency Management

### 29.1 Package Management
- Package managers (npm, pip, maven, etc.) are configured with lock files. Lock files are committed.
- Private packages are published to a private registry with access control.
- Package versions are pinned. Automated dependency updates (Dependabot, Renovate) are configured but require human review.

### 29.2 Dependency Hygiene
- Unused dependencies are removed. Dependency trees are audited for bloat.
- Circular dependencies between internal packages are forbidden.
- Vendoring is permitted only for critical dependencies with stability concerns, documented in an ADR.

### 29.3 License Compliance
- All dependencies are scanned for license compatibility. Copyleft licenses in dependencies require legal review.
- License information is included in SBOMs.

---

## 30. Secrets & Environment Management

### 30.1 Secrets Management
- Secrets are stored in a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, etc.).
- Secrets are never in source control, logs, environment variables on developer machines, or container images.
- Secrets are rotated on a defined schedule and immediately upon suspected compromise.
- Short-lived credentials (IAM roles, workload identity) are preferred over long-lived secrets.
- The "secret zero" problem (how a workload authenticates to the vault) is solved via workload identity federation or cloud-native IAM, not hard-coded bootstrap credentials.

### 30.2 Environment Management
- Environments (dev, staging, prod) are isolated at the network and identity level.
- Production access requires MFA and is logged. Break-glass access is available for emergencies but triggers immediate alerts.
- Environment configuration is explicit and validated at startup. Missing required configuration fails the service loudly.
- No production data in non-production environments without anonymization.

---

## 31. Configuration Management

### 31.1 Configuration Principles
- Configuration is externalized from code. Behavior-changing values are configurable, not compiled.
- Configuration schemas are validated at startup. Invalid configuration prevents service startup (fail loud).
- Secrets and non-secrets are managed separately. Non-secret configuration lives in version-controlled config files or config stores.

### 31.2 Configuration Standards
- Feature flags are managed via a centralized feature flag service, not scattered in config files.
- Configuration changes are audited and versioned. Changes to production configuration require approval.
- Configuration defaults are safe and production-ready. "Development mode" defaults that disable security are forbidden.
- Environment-specific configuration is minimal and explicit. The delta between environments is documented.

---

## 32. Design Patterns & Anti-Patterns

### 32.1 Encouraged Patterns
- **Repository Pattern**: abstracts data access behind an interface.
- **Unit of Work**: manages transactions across multiple operations.
- **Circuit Breaker**: prevents cascading failures in distributed systems.
- **Outbox Pattern**: ensures reliable event publishing alongside database transactions.
- **Saga Pattern**: manages distributed transactions without two-phase commit.
- **Strangler Fig Pattern**: gradually migrates from legacy systems.
- **CQRS**: separates read and write models where justified.
- **Event Sourcing**: where full audit history and temporal querying are requirements.
- **Feature Flags**: decouples deployment from release.

### 32.2 Anti-Patterns (Forbidden)
- **God Object / God Class**: a single class that knows or does too much.
- **Spaghetti Code**: unstructured, tangled control flow.
- **Golden Hammer**: using a familiar tool for every problem regardless of fit.
- **Not Invented Here (NIH)**: rewriting functionality available in well-maintained libraries without justification.
- **Premature Optimization**: optimizing before profiling.
- **Magic Numbers / Strings**: unexplained literal values in code.
- **Callback Hell / Pyramid of Doom**: deeply nested asynchronous callbacks.
- **Anemic Domain Model**: domain objects with no behavior, only data.
- **Leaky Abstraction**: abstractions that expose implementation details.
- **Tight Coupling**: modules that cannot be understood or tested in isolation.
- **Big Ball of Mud**: architecture with no discernible structure.
- **Lava Layer**: layers of obsolete code that nobody dares touch.
- **Shotgun Surgery**: a single change requires modifications in many places.
- **Copy-Paste Programming**: duplicating code instead of extracting shared logic.

---

## 33. Forbidden Practices

The following practices are explicitly forbidden in Jovia, without exception:

1. **Hard-coded secrets** in source code, configuration files, or documentation.
2. **Silent catch blocks** or empty exception handlers.
3. **SQL string concatenation** with user input.
4. **Unvalidated redirects** or forwards based on user input.
5. **Client-side authorization** as the sole security control.
6. **Production data in non-production environments** without anonymization.
7. **Direct database access** across bounded contexts.
8. **Unbounded queues, thread pools, or memory allocations** in production.
9. **Commented-out code** committed to shared branches.
10. **Debug logging** left in production code paths.
11. **Breaking changes without versioning** and migration paths.
12. **Undocumented assumptions** in code or architecture.
13. **Skipping quality gates** for urgency. Urgency does not override standards.
14. **AI-generated code merged without human review**, regardless of test passage.
15. **Modifying applied database migrations** in shared environments.
16. **Using "latest" tags** for container images or dependency versions in production.
17. **Exposing internal endpoints** or health check details publicly.
18. **Storing PII in logs** unredacted or unhashed.
19. **Disabling security controls** (CSP, escaping, CSRF protection) without Architecture Council approval.
20. **Deploying without a rollback plan**.

---

## 34. Instructions for AI Coding Agents

This section is binding on every AI agent (Claude, ChatGPT, Manus, Qoder, Cursor, or any future agent) operating on the Jovia codebase, in any capacity — code generation, refactoring, review, or documentation.

1. **Read this Constitution and the relevant Knowledge Base documents before generating any code.** Do not generate code from the prompt alone if project context is available.
2. **Never invent undocumented features, endpoints, fields, or behavior.** If a requirement is ambiguous or undocumented, state the ambiguity and propose an option rather than silently assuming.
3. **Never break the established architecture.** Do not introduce a new layer, pattern, or dependency direction that conflicts with Section 4 without explicitly flagging it as an architectural decision requiring approval.
4. **Never duplicate logic.** Search the existing codebase for an existing implementation before writing a new one; extend or reuse rather than reimplement.
5. **Always reuse existing modules, utilities, and abstractions** in preference to introducing new ones that overlap in responsibility.
6. **Always explain major architectural decisions** made during implementation — what was chosen, what alternatives existed, and why.
7. **Never expose secrets.** No credentials, keys, tokens, or internal infrastructure details appear in generated code, comments, logs, or example values.
8. **Prefer maintainability over speed of delivery.** A slower, correct, well-structured implementation is always preferred over a fast, fragile one.
9. **Refuse unsafe implementations.** If a request would require violating Section 3 (Security Standards) or any other section of this Constitution, the agent must refuse that specific implementation and propose a compliant alternative.
10. **Preserve existing tests and add new ones.** Code changes that are not accompanied by corresponding test coverage are incomplete.
11. **Never renumber, rename, merge, or delete existing Knowledge Base structures** (folders, layers, volumes) without explicit user approval — additive changes are the default.
12. **State assumptions explicitly.** Any assumption made to fill a gap in the request must be surfaced to the human reviewer, not buried silently in the implementation.
13. **Respect the layer boundaries and naming conventions already established** in the repository rather than introducing personal or model-specific style preferences.
14. **When uncertain, stop and ask** rather than proceeding on a guess for any decision with architectural, security, or data-integrity consequences.
15. **Generate code that is deterministic and reproducible.** Avoid non-deterministic patterns, random behavior without seeding, or time-dependent logic that cannot be controlled in tests.
16. **Do not introduce new dependencies without justification.** Follow Section 6.2 for dependency approval criteria.
17. **Respect the existing test structure.** Do not change testing frameworks or patterns without explicit approval.
18. **Do not optimize prematurely.** Profile first, optimize second. Document the performance issue and the measured improvement.
19. **Do not bypass or disable linting, formatting, or security checks.** If a check must be disabled, document why with a ticket reference.
20. **Treat this Constitution as immutable within a task.** Do not suggest changes to the Constitution to justify a shortcut.

---

## 35. AI Self-Review Rules

Before submitting any generated code, AI agents MUST perform a structured self-review against the following checklist:

### 35.1 Correctness Review
- [ ] The code satisfies all stated requirements in the prompt.
- [ ] No requirements were invented, assumed, or omitted.
- [ ] Edge cases are handled (null inputs, empty collections, boundary values, error paths).
- [ ] The code compiles/parses without errors in the target language and framework version.

### 35.2 Security Review
- [ ] No secrets, credentials, or internal IPs are hard-coded or exposed in comments.
- [ ] User inputs are validated and sanitized at system boundaries.
- [ ] No SQL injection, XSS, CSRF, SSRF, or injection vulnerabilities are introduced.
- [ ] Authorization checks are present for all protected operations.
- [ ] No sensitive data is logged or exposed in error messages.

### 35.3 Architecture Review
- [ ] Layer boundaries are respected (domain does not depend on infrastructure).
- [ ] New abstractions do not duplicate existing ones.
- [ ] Dependencies point inward (Clean Architecture).
- [ ] No circular dependencies are introduced.
- [ ] The change aligns with existing patterns and conventions.

### 35.4 Quality Review
- [ ] Functions are small and single-purpose.
- [ ] Names are descriptive and intention-revealing.
- [ ] No magic numbers or strings.
- [ ] Comments explain why, not what.
- [ ] No dead code, commented-out code, or debug logging.

### 35.5 Testing Review
- [ ] Unit tests cover business logic and edge cases.
- [ ] Tests are deterministic and independent.
- [ ] Mocking is used at appropriate boundaries.
- [ ] Test names describe behavior.

### 35.6 Documentation Review
- [ ] Public interfaces are documented.
- [ ] Complex logic has explanatory comments.
- [ ] ADRs are referenced for architectural changes.
- [ ] README or relevant docs are updated.

### 35.7 Self-Correction Protocol
If any item in the self-review fails, the agent MUST:
1. State which item failed and why.
2. Propose a corrected implementation.
3. Re-run the self-review on the corrected code.
4. Only present the final result after all items pass.

---

## 36. Engineering Decision Rules

### 36.1 When an Architecture Decision Record (ADR) is Required
An ADR is mandatory for:
- New programming languages or frameworks.
- New cloud services or infrastructure patterns.
- Changes to data storage technology.
- New architectural patterns (event sourcing, CQRS, microservices).
- Breaking API changes.
- Security model changes.
- AI model or prompt architecture changes.

### 36.2 ADR Format
- **Context**: What is the problem or opportunity?
- **Decision**: What was decided?
- **Consequences**: What are the positive and negative outcomes?
- **Alternatives**: What was considered and rejected?
- **Status**: Proposed, Accepted, Deprecated, Superseded.
- **Date and Owner**.

### 36.3 Decision Escalation
- Decisions affecting a single bounded context are made by the Domain Owner.
- Decisions affecting multiple contexts require Architecture Council review.
- No decision may be retroactively justified. Decisions are made before implementation, not after.

---

## 37. Quality Gates

No code is considered mergeable or releasable until it passes every gate below. Gates are enforced automatically wherever tooling allows; no gate is skipped by reviewer discretion alone.

| Gate | Requirement | Enforcement |
|---|---|---|
| Formatting | Code is auto-formatted to the project's single formatter configuration; no formatting diffs left uncommitted. | Pre-commit hook + CI |
| Linting | Static linting passes with zero errors; warnings are triaged, not ignored by default. | Pre-commit hook + CI |
| Static analysis | Static analysis/type-checking passes with no new issues introduced. | CI |
| Security scan | Dependency and code security scans show no new critical or high-severity findings. | CI |
| Secret scan | No secrets detected in code, comments, or history. | Pre-commit hook + CI |
| Test coverage | Automated tests pass in full, and coverage for business-critical modules meets the defined minimum threshold. | CI |
| Performance validation | Changes affecting critical paths are validated against defined latency/throughput budgets. | CI + staging |
| Accessibility scan | No new WCAG violations introduced in UI changes. | CI |
| Documentation review | Associated documentation (module docs, API docs, ADRs, runbooks) is created or updated and reviewed alongside the code change. | PR review |
| Human/architectural review | At least one independent review confirms adherence to this Constitution before merge. | PR review |
| Integration test | All integration tests pass in a production-like environment. | CI |
| Contract test | API contract tests pass for affected services. | CI |
| Build artifact | Immutable artifact is built, tagged, and stored. | CI |

---

## Closing Statement

This Constitution is the permanent engineering law of Jovia. It supersedes convenience, deadline pressure, and individual preference — for human and AI contributors alike. It is a living document only in the sense that it may be formally amended through the project's governance process; it is never informally overridden in the course of a single task, prompt, or deadline.

Every engineer and every AI agent who touches Jovia is a steward of its quality, security, and longevity. The standards in this document are not obstacles to speed — they are the foundation upon which sustainable speed is built.

**Version 2.0 — Approved.**
