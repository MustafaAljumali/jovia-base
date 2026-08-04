# Opportunity Core & Lawful Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Jovia's governed opportunity core with executable lawful-source policy, the real Himalayas connector, first-party publishing, canonical normalization and deterministic deduplication, resilient lifecycle processing, versioned authorized APIs, persistence, observability, and operational evidence.

**Architecture:** Keep the accepted modular monolith. `@jovia/contracts` owns versioned runtime contracts; `@jovia/opportunity-ingestion` owns application policies and ports; PostgreSQL, Redis, S3-compatible storage, HTTP, Fastify, and BullMQ remain adapters at composition roots. Canonical opportunities, immutable provenance, audit rows, checkpoints, and outbox events commit atomically, while `DeduplicationStrategy` and versioned outbox contracts preserve extension points for AI scoring, matching, memory, recommendations, and notifications.

**Tech Stack:** Node.js 24.14.0, pnpm 11.20.0, TypeScript 6.0.3, Zod 4.4.3, Fastify 5.11.2, PostgreSQL 16 with Drizzle/Postgres.js, Redis 8 with ioredis 6.0.0, BullMQ 6.0.7, AWS SDK S3 client 3.1095.0, sanitize-html 2.17.6, Vitest 4.1.10, OpenTelemetry API 1.9.1.

## Global Constraints

- The approved design at `docs/superpowers/specs/2026-08-05-opportunity-core-lawful-discovery-design.md` is authoritative for this batch.
- No external network request may occur before the latest source policy passes the complete fail-closed eligibility decision immediately before lease acquisition.
- Himalayas uses only `GET https://himalayas.app/jobs/api?offset=<n>&limit=20`, is disabled by default, has a hard 86,400-second polling floor, concurrency `1`, and one-second page spacing.
- Polling cadence is separate from matching, ranking, scoring, and notification cadence; downstream packages cannot import connector scheduling.
- Raw payloads must reach durable object storage before canonical persistence; production connector or publishing startup fails closed without valid storage configuration and resolvable workload credentials.
- A committed page or direct command atomically changes opportunities, provenance, audit, checkpoint/idempotency state, and the transactional outbox.
- Monetary application contracts use decimal strings; storage uses `numeric`; there is no currency conversion.
- Annualization multipliers are hourly `2080`, daily `260`, weekly `52`, fortnightly `26`, monthly `12`, and annual `1`; project budgets are not annualized.
- Public opportunity routes are under `/v1`, runtime validated, bearer authenticated except health, deny-by-default authorized, Redis rate-limited in production, observable, and documented from their runtime schemas.
- Migrations are lexical, forward-only, transactional, repeatable, and SHA-256 checksum verified; `0000_foundation.sql` is immutable.
- Unknown, disabled, simulated, quarantined, unsupported, or unverified sources must never be labelled connected.
- Production code must not contain Manus branding, assets, dependencies, environment variables, or compatibility paths.
- Every implementation commit uses a Conventional Commit message and `git commit -S`; no commit targets `main` directly.
- Dependency versions are exact and the lockfile remains frozen-install compatible.
- No live source request, external credential, or destructive production action is required by automated tests.

## File and Boundary Map

| Boundary | Files | Responsibility |
| --- | --- | --- |
| Versioned contracts | `packages/contracts/src/{sources,opportunities,ingestion,events,openapi}.ts` | Runtime validation, API/event compatibility, shared types |
| Domain application | `services/opportunity-ingestion/src/**` | Eligibility, normalization, deduplication, connector orchestration, publishing, lifecycle, outbox ports |
| Himalayas adapter | `services/opportunity-ingestion/src/himalayas/**` | Official response validation and source-specific mapping only |
| Durable object adapter | `packages/object-storage/src/**` | S3-compatible SDK isolation, encryption, private writes, hashes and deterministic keys |
| Persistence | `packages/database/drizzle/0001_opportunity_core.sql`, schemas and repositories | Atomic Postgres implementation, migrations, leases, checkpoints, deduplication, outbox |
| HTTP edge | `apps/api/src/plugins/**`, `apps/api/src/routes/**`, `apps/api/src/adapters/**` | Auth, ownership, Redis rate limiting, RFC 9457 errors, OpenAPI, route observation |
| Worker edge | `apps/worker/src/adapters/**`, `apps/worker/src/jobs/**` | Scheduling, Himalayas execution, outbox/expiry/retention dispatch |
| Evidence | `docs/{api,architecture,database,knowledge-base,legal,operations,security}/**` | Source reviews, architecture, contracts, migrations, runbooks, threat model, KB |

---

### Task 1: Versioned Source, Opportunity, Ingestion, Event, and OpenAPI Contracts

**Files:**
- Modify: `packages/contracts/src/sources.ts`
- Create: `packages/contracts/src/opportunities.ts`
- Create: `packages/contracts/src/ingestion.ts`
- Create: `packages/contracts/src/events.ts`
- Create: `packages/contracts/src/openapi.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Consumes: Zod 4.4.3 and existing `ProblemDetailsSchema`.
- Produces: `SourcePolicyVersionSchema`, `SourceExecutionContextSchema`, `SourceEligibilityDecisionSchema`, `CanonicalOpportunitySchema`, `DirectOpportunityCommandSchema`, `OpportunityListQuerySchema`, `IngestionCheckpointSchema`, `QuarantineRecordSchema`, `OpportunityEventSchema`, and `createOpportunityOpenApiDocument()`.

- [ ] **Step 1: Write failing contract tests**

```ts
it("rejects an approved external policy without immutable terms evidence", () => {
  const result = SourcePolicyVersionSchema.safeParse({
    sourceCode: "himalayas",
    version: 1,
    scope: "external",
    mechanism: "official_api",
    legalPosture: "approved",
  });
  expect(result.success).toBe(false);
});

it("keeps decimal amounts and normalized ISO values at the boundary", () => {
  expect(CompensationSchema.parse({
    kind: "hourly",
    minimum: "50.25",
    maximum: "75",
    currency: "USD",
    sourcePeriod: "hourly",
    annualizedMinimum: "104520.00",
    annualizedMaximum: "156000.00",
  }).currency).toBe("USD");
});

it("emits only supported version-one opportunity events", () => {
  expect(OpportunityEventSchema.parse({
    eventId: "018f6d6e-12a0-7ef1-bcff-812ad2d0f001",
    eventKey: "opportunity.discovered:018f6d6e-12a0-7ef1-bcff-812ad2d0f002:1",
    type: "opportunity.discovered.v1",
    occurredAt: "2026-08-05T00:00:00.000Z",
    correlationId: "contract-test",
    opportunityId: "018f6d6e-12a0-7ef1-bcff-812ad2d0f002",
    lifecycle: "active",
  }).type).toBe("opportunity.discovered.v1");
});
```

- [ ] **Step 2: Run the focused tests and verify red**

Run: `pnpm exec vitest run --project unit packages/contracts/src/contracts.test.ts`

Expected: FAIL because the new schemas and OpenAPI builder are not exported.

- [ ] **Step 3: Implement strict, additive-compatible contracts**

```ts
export const SourcePolicyVersionSchema = z.object({
  id: z.uuid(), sourceCode: SourceCodeSchema, version: z.number().int().positive(),
  scope: z.enum(["external", "first_party"]), mechanism: SourceMechanismSchema,
  legalPosture: LegalPostureSchema, termsUrl: z.url(), termsSnapshotRef: z.string().min(1),
  termsSnapshotSha256: Sha256Schema, attribution: AttributionPolicySchema,
  polling: PollingPolicySchema, retention: RetentionPolicySchema,
  redistribution: RedistributionPolicySchema, contentModification: ContentModificationPolicySchema,
  owner: z.string().min(1), verifiedAt: z.iso.datetime(), validUntil: z.iso.datetime(),
  approvedBy: z.string().min(1), approvedAt: z.iso.datetime(), createdAt: z.iso.datetime(),
}).strict();

export const DirectOpportunityCommandSchema = z.object({
  publisherOrganizationId: z.uuid(), title: z.string().trim().min(3).max(240),
  descriptionHtml: z.string().min(1).max(100_000), employerName: z.string().trim().min(1).max(240),
  engagementType: EngagementTypeSchema, experienceLevels: z.array(ExperienceLevelSchema).max(8),
  categories: z.array(z.string().trim().min(1).max(80)).max(32),
  technologies: z.array(z.string().trim().min(1).max(80)).max(64),
  languages: z.array(IsoLanguageSchema).max(32), location: OpportunityLocationSchema,
  compensation: CompensationInputSchema.optional(), publishedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().optional(), applicationUrl: z.url(), extension: z.record(z.string(), z.unknown()).default({}),
}).strict();
```

`createOpportunityOpenApiDocument()` returns OpenAPI `3.1.0`, declares bearer authentication, RFC 9457 problems, all seven approved routes, cursor parameters, idempotency header, and response schemas produced with `z.toJSONSchema` from the same exported Zod contracts.

- [ ] **Step 4: Run contracts tests, type checking, and formatting**

Run: `pnpm exec vitest run --project unit packages/contracts/src/contracts.test.ts && pnpm typecheck && pnpm format:check`

Expected: PASS with strict invalid-request rejection and additive response metadata acceptance.

- [ ] **Step 5: Commit the contract boundary**

```bash
git add packages/contracts
git commit -S -m "feat(contracts): define opportunity core v1 contracts"
```

### Task 2: Executable Lawful-Source Governance and Evidence

**Files:**
- Create: `services/opportunity-ingestion/src/ports.ts`
- Create: `services/opportunity-ingestion/src/source-eligibility.ts`
- Create: `services/opportunity-ingestion/src/source-eligibility.test.ts`
- Modify: `services/opportunity-ingestion/src/index.ts`
- Create: `docs/legal/sources/himalayas-2026-08-05.md`
- Create: `docs/legal/sources/jovia-direct-2026-08-05.md`
- Create: `docs/legal/sources/README.md`

**Interfaces:**
- Consumes: `SourceExecutionContext`, `SourceEligibilityDecision` and a `Clock`.
- Produces: `SourcePolicyRepository`, `SourceAuditPort`, `CircuitStatePort`, `LeasePort`, and `SourceEligibilityService.evaluate(sourceCode, operation, correlationId)`.

- [ ] **Step 1: Write the complete denial-matrix tests before implementation**

```ts
it.each([
  ["disabled", { enabled: false }], ["unsupported", { mechanism: "unsupported" }],
  ["not_approved", { legalPosture: "conditional" }], ["approval_missing", { approvedBy: "" }],
  ["verification_in_future", { verifiedAt: "2026-08-06T00:00:00.000Z" }],
  ["policy_expired", { validUntil: "2026-08-04T23:59:59.000Z" }],
  ["source_policy_mismatch", { sourceCode: "other" }], ["quarantined", { runtimeStatus: "quarantined" }],
  ["circuit_open", { circuitState: "open" }], ["poll_not_due", { nextPollAt: "2026-08-05T00:01:00.000Z" }],
])("denies %s before connector lookup", async (reason, override) => {
  const connectorLookup = vi.fn();
  const result = await harness({ ...validContext, ...override }, connectorLookup).evaluate(
    "himalayas", "poll", "eligibility-test",
  );
  expect(result).toMatchObject({ eligible: false, reason });
  expect(connectorLookup).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the eligibility test and verify red**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/source-eligibility.test.ts`

Expected: FAIL because the fail-closed service and ports do not exist.

- [ ] **Step 3: Implement typed, audited eligibility**

```ts
export class SourceEligibilityService {
  async evaluate(sourceCode: string, operation: SourceOperation, correlationId: string) {
    const context = await this.policies.getExecutionContext(sourceCode);
    const decision = evaluateSourceExecution(context, operation, this.clock.now());
    await this.audit.recordEligibilityDecision({ sourceCode, operation, correlationId, decision });
    this.metrics.eligibility(decision);
    return decision;
  }
}
```

`evaluateSourceExecution` checks every governing field, mechanism/operation compatibility, policy identity, approval chronology, verification chronology, policy validity, runtime kill switch, quarantine, persistent circuit, lease/poll due state, and exact attribution/retention/redistribution completeness. It returns a discriminated union and never returns a connector.

The two source review documents record only official URLs, date, owner, approved paraphrase, digest procedure, attribution, redistribution, polling, retention, and approval evidence. They label Himalayas as real-but-disabled and `jovia-direct` as first-party; neither document contains copied external terms text.

- [ ] **Step 4: Verify governance tests and evidence integrity**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/source-eligibility.test.ts && pnpm security:secrets && pnpm format:check`

Expected: PASS; every denial records an audit and zero connector lookups.

- [ ] **Step 5: Commit governance and evidence**

```bash
git add services/opportunity-ingestion docs/legal/sources
git commit -S -m "feat(discovery): enforce lawful source eligibility"
```

### Task 3: Canonical Normalization, Sanitization, and Deterministic Deduplication

**Files:**
- Modify: `services/opportunity-ingestion/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `services/opportunity-ingestion/src/normalization/{compensation,iso,html,signature,normalize}.ts`
- Create: `services/opportunity-ingestion/src/normalization/normalization.test.ts`
- Create: `services/opportunity-ingestion/src/deduplication.ts`
- Create: `services/opportunity-ingestion/src/deduplication.test.ts`
- Modify: `services/opportunity-ingestion/src/index.ts`

**Interfaces:**
- Consumes: `SourceOpportunityRecord`, approved content-modification rules and injected `Clock`.
- Produces: `normalizeOpportunity(record, context)`, `computeContentSignature(input)`, `DeduplicationStrategy`, and `DeterministicDeduplicationStrategy`.

- [ ] **Step 1: Add exact sanitizer dependencies**

Run: `pnpm add --filter @jovia/opportunity-ingestion sanitize-html@2.17.6 && pnpm add --filter @jovia/opportunity-ingestion -D @types/sanitize-html@2.16.1`

Expected: exact versions appear in the manifest and lockfile.

- [ ] **Step 2: Write failing normalization and signature tests**

```ts
it.each([
  ["hourly", "50", "104000.00"], ["daily", "400", "104000.00"],
  ["weekly", "2000", "104000.00"], ["fortnightly", "4000", "104000.00"],
  ["monthly", "8666.666666", "103999.999992"], ["annual", "104000", "104000"],
])("annualizes %s without floating point", (period, amount, expected) => {
  expect(normalizeCompensation({ kind: period, minimum: amount, currency: "usd" }).annualizedMinimum)
    .toBe(expected);
});

it("does not annualize project budgets or convert currency", () => {
  expect(normalizeCompensation({ kind: "project", minimum: "1000", currency: "EUR" }))
    .toMatchObject({ currency: "EUR", annualizedMinimum: undefined });
});

it("sanitizes active content and stabilizes signature ordering", () => {
  const normalized = normalizeFixture({ descriptionHtml: '<p onclick="x()">Hi<script>x()</script></p>',
    languages: ["fr", "en", "fr"], countries: ["us", "GB"] });
  expect(normalized.descriptionHtml).toBe("<p>Hi</p>");
  expect(normalized.languages).toEqual(["en", "fr"]);
  expect(normalized.location.countryCodes).toEqual(["GB", "US"]);
  expect(normalized.contentSignature).toMatch(/^[a-f0-9]{64}$/u);
});
```

- [ ] **Step 3: Run tests and verify red**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/normalization/normalization.test.ts services/opportunity-ingestion/src/deduplication.test.ts`

Expected: FAIL because normalization and strategy modules are absent.

- [ ] **Step 4: Implement canonical normalization and strategy port**

```ts
export interface DeduplicationStrategy {
  readonly kind: "deterministic" | "semantic";
  decide(input: DeduplicationInput): Promise<DeduplicationDecision>;
}

export class DeterministicDeduplicationStrategy implements DeduplicationStrategy {
  readonly kind = "deterministic" as const;
  constructor(private readonly candidates: DeduplicationCandidatePort) {}
  async decide(input: DeduplicationInput) {
    const match = await this.candidates.findExactWithinWindow(input.contentSignature, input.publishedAt, 86_400);
    return match ? { kind: "duplicate", canonicalOpportunityId: selectCanonical(input, match) }
      : { kind: "new" };
  }
}
```

Use `sanitize-html` with an explicit allowlist (`p`, `br`, headings, lists, `strong`, `em`, `code`, `pre`, `blockquote`, `a`) and only `href`, `rel`, `target` on anchors; permit only `http` and `https`; force safe link attributes. Compute SHA-256 over a length-delimited canonical tuple, not delimiter-only concatenation. Validate ISO codes from explicit repository-owned sets and quarantine invalid required currency rather than guessing.

- [ ] **Step 5: Verify normalization, security, and types**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/normalization/normalization.test.ts services/opportunity-ingestion/src/deduplication.test.ts && pnpm typecheck && pnpm security:dependencies`

Expected: PASS for compensation, ISO values, HTML, deterministic signatures, 24-hour matching, and stable canonical priority.

- [ ] **Step 6: Commit normalization and deterministic deduplication**

```bash
git add services/opportunity-ingestion pnpm-lock.yaml
git commit -S -m "feat(opportunities): normalize and deduplicate records"
```

### Task 4: Resilient Connector Runtime

**Files:**
- Create: `services/opportunity-ingestion/src/connector/{contracts,retry,circuit-breaker,rate-limiter,runner}.ts`
- Create: `services/opportunity-ingestion/src/connector/{retry,circuit-breaker,runner}.test.ts`
- Create: `services/opportunity-ingestion/src/testing/test-adapters.ts`
- Modify: `services/opportunity-ingestion/src/index.ts`

**Interfaces:**
- Consumes: `SourceEligibilityService`, connector registry, leases, persistent circuit/checkpoint ports, `RawPayloadStore`, normalizer, page transaction, metrics, clock, sleeper and deterministic jitter.
- Produces: `OpportunityConnector<Checkpoint>`, `ConnectorRunner.run(sourceCode, correlationId, signal)`, bounded retry, distributed limiter and explicit test adapters.

- [ ] **Step 1: Write failing reliability tests**

```ts
it("honors Retry-After and succeeds on the third retryable attempt", async () => {
  transport.respond(429, undefined, { "retry-after": "60" });
  transport.fail(new TypeError("network"));
  transport.respond(200, page);
  await runner.run("himalayas", "retry-test", signal);
  expect(sleeper.calls).toEqual([60_000, boundedBackoff(2)]);
});

it("opens after five consecutive retryable page failures and permits one half-open probe", async () => {
  await failFiveRuns();
  expect(await circuits.get("himalayas")).toMatchObject({ state: "open", consecutiveFailures: 5 });
  expect((await runner.run("himalayas", "open-test", signal)).outcome).toBe("circuit_open");
  clock.advance(HALF_OPEN_AFTER_MS);
  await runner.run("himalayas", "probe-test", signal);
  expect(await circuits.get("himalayas")).toMatchObject({ state: "closed", consecutiveFailures: 0 });
});

it("does not advance a checkpoint when raw storage, schema validation, or page commit fails", async () => {
  await expect(runWithFailure()).rejects.toBeDefined();
  expect(checkpoints.saved).toHaveLength(0);
});
```

- [ ] **Step 2: Run connector runtime tests and verify red**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/connector`

Expected: FAIL because the shared runtime is not implemented.

- [ ] **Step 3: Implement retry, limiter, circuit, raw capture, quarantine, and atomic page order**

```ts
for await (const page of connector.fetch(plan, signal)) {
  const raw = await rawPayloadStore.put(toRawWrite(run, page));
  let records: readonly SourceOpportunityRecord[];
  try { records = connector.parse(page); }
  catch (error) {
    await quarantine.record(toSafeQuarantine(run, page, raw, error));
    await circuits.recordSchemaFailure(sourceCode);
    return { outcome: "quarantined", runId: run.id };
  }
  const normalized = records.map((record) => normalizer.normalize(record, policy));
  await pageTransactions.commit({ run, page, raw, normalized, nextCheckpoint: page.nextCheckpoint });
}
```

Eligibility runs before connector lookup. Lease acquisition follows eligibility and rechecks the active policy ID in one persistence operation. Retries include network/timeout/408/429/5xx only, maximum three attempts per page, `Retry-After` precedence, injected deterministic jitter, and abort propagation. A page stores raw bytes before parse, quarantines safe paths without bodies, and advances checkpoints only inside the page transaction. Persistent circuit transitions use compare-and-set semantics.

- [ ] **Step 4: Verify runtime behavior**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/connector`

Expected: PASS for checkpoint resume, retry classifications, rate spacing, cancellation, circuit state, raw-store failure, schema quarantine, policy denial and idempotent replay.

- [ ] **Step 5: Commit the connector runtime**

```bash
git add services/opportunity-ingestion
git commit -S -m "feat(discovery): add resilient connector runtime"
```

### Task 5: Official Himalayas Connector Contract

**Files:**
- Create: `services/opportunity-ingestion/src/himalayas/schema.ts`
- Create: `services/opportunity-ingestion/src/himalayas/connector.ts`
- Create: `services/opportunity-ingestion/src/himalayas/connector.contract.test.ts`
- Create: `services/opportunity-ingestion/src/himalayas/fixtures/page-0.json`
- Create: `services/opportunity-ingestion/src/himalayas/fixtures/page-20.json`
- Modify: `services/opportunity-ingestion/src/index.ts`

**Interfaces:**
- Consumes: injected `HttpTransport`, official-shape fixtures, `OpportunityConnector<HimalayasCheckpoint>`.
- Produces: `HimalayasConnector`, `HimalayasPageSchema`, `HimalayasCheckpointSchema`, exact source records and no public logo field.

- [ ] **Step 1: Add version-controlled official-shape fixtures and failing contract tests**

```ts
it("requests only the documented browse endpoint at limit 20", async () => {
  const connector = new HimalayasConnector(fakeTransport([page0]));
  const [page] = await collect(connector.fetch({ checkpoint: { offset: 0 } }, signal));
  expect(transport.requests).toEqual([{ method: "GET",
    url: "https://himalayas.app/jobs/api?offset=0&limit=20",
    headers: { accept: "application/json", "user-agent": expect.stringContaining("Jovia") } }]);
  expect(page.nextCheckpoint.offset).toBe(20);
});

it("maps the exact applicationLink and salaryPeriod without exposing companyLogo", () => {
  const [record] = connector.parse(rawPage(page0));
  expect(record.originalUrl).toBe(page0.jobs[0].applicationLink);
  expect(record.compensation?.sourcePeriod).toBe(page0.jobs[0].salaryPeriod);
  expect(record.extension).not.toHaveProperty("companyLogo");
});
```

- [ ] **Step 2: Run the connector contract tests and verify red**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/himalayas/connector.contract.test.ts`

Expected: FAIL because the adapter schema and connector do not exist.

- [ ] **Step 3: Implement the official adapter**

```ts
export class HimalayasConnector implements OpportunityConnector<HimalayasCheckpoint> {
  readonly sourceCode = "himalayas";
  async plan(context: ConnectorPlanContext<HimalayasCheckpoint>) {
    return { checkpoint: context.checkpoint ?? { offset: 0, datasetUpdatedAt: undefined,
      lastCommittedPageHash: undefined } };
  }
  async *fetch(plan: FetchPlan<HimalayasCheckpoint>, signal: AbortSignal) {
    const url = new URL("https://himalayas.app/jobs/api");
    url.searchParams.set("offset", String(plan.checkpoint.offset));
    url.searchParams.set("limit", "20");
    const response = await this.transport.getJson(url, signal);
    yield decodeHimalayasPage(response, plan.checkpoint);
  }
  parse(page: RawPage<HimalayasCheckpoint>) { return mapHimalayasJobs(HimalayasPageSchema.parse(page.value)); }
}
```

The Zod schema matches official required fields, accepts documented nullable values, preserves unknown additive upstream fields only in raw storage, rejects required-type changes, and maps GUID, employer, description, location/timezones, categories, seniority, employment type, compensation, publication/expiry, and application link. The adapter marks the run superseded if `datasetUpdatedAt` changes across a resumed walk.

- [ ] **Step 4: Verify connector contracts and no live-network behavior**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/himalayas/connector.contract.test.ts && rg -n "fetch\(|himalayas\.app/jobs/api" services/opportunity-ingestion/src/himalayas`

Expected: Tests PASS using the fake transport; the only production endpoint literal is the approved HTTPS browse endpoint.

- [ ] **Step 5: Commit the Himalayas connector**

```bash
git add services/opportunity-ingestion/src/himalayas
git commit -S -m "feat(discovery): add Himalayas API connector"
```

### Task 6: Forward-Only Opportunity-Core Migration and Checksum Runner

**Files:**
- Create: `packages/database/drizzle/0001_opportunity_core.sql`
- Modify: `packages/database/scripts/migrate.ts`
- Modify: `packages/database/scripts/check.ts`
- Create: `packages/database/scripts/migrate.test.ts`
- Modify: `packages/database/src/integration/foundation.integration.test.ts`
- Create: `packages/database/src/integration/opportunity-core.integration.test.ts`

**Interfaces:**
- Consumes: lexical SQL files and `postgres.Sql` transaction support.
- Produces: `discoverMigrations()`, `sha256Migration()`, `applyMigrations(databaseUrl)`, immutable checksum ledger, source/policy seeds, opportunity lifecycle tables, and all required indexes.

- [ ] **Step 1: Write runner and migration integration tests first**

```ts
it("applies every migration twice and rejects an altered applied checksum", async () => {
  await applyMigrations(databaseUrl);
  await applyMigrations(databaseUrl);
  expect(await migrationNames(sql)).toEqual(["0000_foundation.sql", "0001_opportunity_core.sql"]);
  await expect(validateAppliedChecksum(sql, "0001_opportunity_core.sql", "0".repeat(64)))
    .rejects.toThrow("migration checksum mismatch");
});

it("contains indexed foreign keys and partial serving/outbox indexes", async () => {
  expect(await missingForeignKeyIndexes(sql)).toEqual([]);
  expect(await indexPredicate(sql, "opportunities_active_published_idx")).toContain("lifecycle = 'active'");
  expect(await indexPredicate(sql, "outbox_events_pending_idx")).toContain("published_at IS NULL");
});
```

- [ ] **Step 2: Run migration tests and verify red**

Run: `pnpm exec vitest run --project unit packages/database/scripts/migrate.test.ts`

Expected: FAIL because discovery and checksums are absent. Integration tests are enabled only with `RUN_INTEGRATION_TESTS=true` and a test database.

- [ ] **Step 3: Implement migration discovery and forward-only schema**

```ts
export async function applyMigrations(databaseUrl: string): Promise<void> {
  const migrations = await discoverMigrations(new URL("../drizzle/", import.meta.url));
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    for (const migration of migrations) {
      await sql.begin(async (tx) => applyOneMigration(tx, migration));
    }
  } finally { await sql.end({ timeout: 5 }); }
}
```

`0001_opportunity_core.sql` adds immutable source policy/approval/runtime/audit tables; auth capability/membership/session records needed by the approved public authorization boundary; ingestion runs/pages/seen identities/checkpoints/leases/quarantine/circuits/raw references; canonical opportunities/provenance/audits/idempotency/duplicate links; outbox/dispatch attempts; and checksum ledger. It adjusts the old source mechanism check forward-only to add `user_authorized_import` and `manual_submission`, preserves every `0000` column, indexes every foreign key, adds partial and keyset indexes, and seeds the disabled Himalayas and enabled first-party policies with exact evidence digests.

- [ ] **Step 4: Run fresh and upgrade database tests**

Run: `pnpm db:migrate && pnpm db:migrate && pnpm db:check && pnpm test:integration`

Expected: PASS on a fresh test database and an existing-foundation test database; checksums, constraints, indexes and policies match the specification.

- [ ] **Step 5: Commit migration and runner**

```bash
git add packages/database/drizzle packages/database/scripts packages/database/src/integration
git commit -S -m "feat(database): add opportunity core migration"
```

### Task 7: Transactional PostgreSQL Adapters

**Files:**
- Create: `packages/database/src/schema/{source-policies,ingestion,opportunities,outbox,auth}.ts`
- Modify: `packages/database/src/schema/index.ts`
- Create: `packages/database/src/repositories/{source-governance,ingestion,opportunities,outbox,auth}.ts`
- Create: `packages/database/src/repositories/repository-contracts.integration.test.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/database/package.json`

**Interfaces:**
- Consumes: application ports from `@jovia/opportunity-ingestion`, auth contracts from `@jovia/auth`, Postgres.js and Drizzle schema types.
- Produces: `PostgresSourceGovernanceRepository`, `PostgresIngestionRepository`, `PostgresOpportunityRepository`, `PostgresOutboxRepository`, and `PostgresAuthenticator`.

- [ ] **Step 1: Add application/auth dependencies and write repository contract tests**

Run: `pnpm add --filter @jovia/database @jovia/opportunity-ingestion@workspace:* @jovia/auth@workspace:*`

```ts
it("rolls opportunity, provenance, audit, checkpoint and outbox back together", async () => {
  adapter.failBeforeCheckpointForTest();
  await expect(adapter.commitPage(validPageCommit)).rejects.toThrow();
  expect(await counts(sql)).toEqual({ opportunities: 0, provenance: 0, audits: 0, checkpoints: 0, outbox: 0 });
});

it("serializes exact-signature deduplication with a transaction advisory lock", async () => {
  const [a, b] = await Promise.all([adapter.commitPage(commitA), adapter.commitPage(commitB)]);
  expect(new Set([a.canonicalOpportunityId, b.canonicalOpportunityId]).size).toBe(1);
  expect(await provenanceCount(sql)).toBe(2);
});
```

- [ ] **Step 2: Run repository integration tests and verify red**

Run: `pnpm exec vitest run --project integration packages/database/src/repositories/repository-contracts.integration.test.ts`

Expected: FAIL because the PostgreSQL ports are not implemented.

- [ ] **Step 3: Implement short atomic transactions and keyset queries**

```ts
await sql.begin(async (tx) => {
  await tx`select pg_advisory_xact_lock(hashtextextended(${record.contentSignature}, 0))`;
  const canonical = await resolveCanonical(tx, record);
  await upsertProvenance(tx, canonical.id, command);
  await appendOpportunityAudit(tx, canonical.id, command);
  await insertOutboxEvent(tx, toOpportunityEvent(canonical, command));
  await saveCheckpoint(tx, command.sourceId, command.nextCheckpoint);
});
```

Use conditional updates for lease/circuit compare-and-set, `FOR UPDATE SKIP LOCKED` for outbox claims, unique event keys and source identities for replay idempotency, `(published_at, id)` cursors for active queries, and tenant predicates on every direct mutation. No external HTTP/object-store/event call occurs inside a transaction.

- [ ] **Step 4: Verify database concurrency, resume, outbox and lifecycle behavior**

Run: `pnpm exec vitest run --project integration packages/database/src/repositories/repository-contracts.integration.test.ts`

Expected: PASS for transaction rollback, replay, advisory-lock deduplication, checkpoint resume, lease exclusion, outbox claim/retry, cross-tenant denial, expiration and multi-provenance tombstone behavior.

- [ ] **Step 5: Commit persistence adapters**

```bash
git add packages/database pnpm-lock.yaml
git commit -S -m "feat(database): persist governed opportunities atomically"
```

### Task 8: Direct Publishing, Lifecycle, Quarantine, and Outbox Application Flows

**Files:**
- Create: `services/opportunity-ingestion/src/publishing/{service,service.test}.ts`
- Create: `services/opportunity-ingestion/src/lifecycle/{service,service.test}.ts`
- Create: `services/opportunity-ingestion/src/outbox/{dispatcher,dispatcher.test}.ts`
- Create: `services/opportunity-ingestion/src/quarantine/{service,service.test}.ts`
- Modify: `services/opportunity-ingestion/src/index.ts`

**Interfaces:**
- Consumes: source eligibility, ownership port, raw store, normalizer, page transaction, lifecycle and outbox repositories.
- Produces: `DirectOpportunityService.create/replace/remove`, `OpportunityLifecycleService.expire/reconcile/purge`, `OutboxDispatcher.dispatchBatch`, and `QuarantineService.record/releaseForReplay`.

- [ ] **Step 1: Write failing end-to-end application tests with explicit test adapters**

```ts
it("publishes direct input through raw capture, normalization, provenance, audit and outbox once", async () => {
  const first = await service.create(actor, command, "idem-1", "publish-test");
  const replay = await service.create(actor, command, "idem-1", "publish-test-replay");
  expect(replay).toEqual(first);
  expect(testRawPayloadStore.writes).toHaveLength(1);
  expect(store.snapshot()).toMatchObject({ opportunities: 1, provenance: 1, audits: 1, outbox: 1 });
});

it("tombstones a deleted source occurrence but keeps a canon with other active provenance", async () => {
  await lifecycle.tombstoneOccurrence(firstPartyOccurrence, "publisher_deleted", correlationId);
  expect((await store.get(canonicalId))?.lifecycle).toBe("active");
  expect(await store.getOccurrence(firstPartyOccurrence)).toMatchObject({ deletionState: "tombstoned" });
});

it("retries outbox publication without marking an unsuccessful event", async () => {
  publisher.failOnce();
  await dispatcher.dispatchBatch(10);
  expect(await outbox.pendingCount()).toBe(1);
  clock.advanceToNextAttempt();
  await dispatcher.dispatchBatch(10);
  expect(await outbox.pendingCount()).toBe(0);
});
```

- [ ] **Step 2: Run application-flow tests and verify red**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/publishing services/opportunity-ingestion/src/lifecycle services/opportunity-ingestion/src/outbox services/opportunity-ingestion/src/quarantine`

Expected: FAIL because the use cases are absent.

- [ ] **Step 3: Implement the shared pipeline use cases**

```ts
async create(actor: PublishingActor, input: DirectOpportunityCommand, key: string, correlationId: string) {
  await this.ownership.requirePublisherMembership(actor, input.publisherOrganizationId);
  const replay = await this.commands.findIdempotent(actor.id, key);
  if (replay) return assertSamePayloadOrConflict(replay, input);
  const source = await this.eligibility.require("jovia-direct", "publish", correlationId);
  const raw = await this.rawPayloads.put(rawDirectCommand(source, input, correlationId));
  const normalized = this.normalizer.normalize(toSourceRecord(input), source.policy);
  return this.transactions.commitDirect({ actor, key, inputHash: hashCommand(input), raw, normalized, correlationId });
}
```

Replace and delete require ownership and source scope. Expiry/outbox keys prevent repeat events. Full-run reconciliation operates only after `completed`; partial/failed/superseded/quarantined runs never tombstone unseen rows. Retention deletes raw objects first, then records `purgedAt`; failures remain retryable and observable. Quarantine release requires `admin:operate`, a mapper version change, and immutable raw reference.

- [ ] **Step 4: Verify shared direct and lifecycle flows**

Run: `pnpm exec vitest run --project unit services/opportunity-ingestion/src/publishing services/opportunity-ingestion/src/lifecycle services/opportunity-ingestion/src/outbox services/opportunity-ingestion/src/quarantine`

Expected: PASS for idempotency conflict/replay, ownership, normalization, provenance, tombstone/expiry, completed-run reconciliation, raw retention, outbox reliability and quarantine replay.

- [ ] **Step 5: Commit application workflows**

```bash
git add services/opportunity-ingestion
git commit -S -m "feat(opportunities): add publishing and lifecycle flows"
```

### Task 9: S3-Compatible Durable Raw Payload Adapter

**Files:**
- Create: `packages/object-storage/package.json`
- Create: `packages/object-storage/tsconfig.json`
- Create: `packages/object-storage/src/{s3-raw-payload-store,index}.ts`
- Create: `packages/object-storage/src/s3-raw-payload-store.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `RawPayloadStore` port, injected S3 client compatible with `send`, cryptographic hash and explicit configuration.
- Produces: `S3RawPayloadStore`, `validateRawPayloadStorageConfig`, deterministic private encrypted `put`, and `delete`.

- [ ] **Step 1: Create the focused adapter package**

```json
{
  "name": "@jovia/object-storage",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "dependencies": {
    "@jovia/opportunity-ingestion": "workspace:*"
  }
}
```

Create `tsconfig.json` by extending `../../tsconfig.base.json`, setting `rootDir` to `src`, `outDir` to `dist`, and adding a project reference to `../../services/opportunity-ingestion`. Add the package to root TypeScript references and the Vitest alias map.

- [ ] **Step 2: Add the exact SDK dependency**

Run: `pnpm add --filter @jovia/object-storage @aws-sdk/client-s3@3.1095.0`

Expected: the adapter package alone imports the AWS SDK.

- [ ] **Step 3: Write failing adapter tests with a fake SDK client**

```ts
it("writes private encrypted bytes with deterministic key and digest metadata", async () => {
  const result = await store.put(writeFixture);
  expect(fakeClient.commands[0].input).toMatchObject({ Bucket: "jovia-raw",
    Key: "himalayas/2026/08/05/run-1/page-000000-<sha256>.json",
    ServerSideEncryption: "AES256", ContentType: "application/json",
    Metadata: { sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) } });
  expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
});

it("rejects non-HTTPS endpoints and absent production configuration", () => {
  expect(() => validateRawPayloadStorageConfig({ environment: "production", endpoint: "http://s3" }))
    .toThrow("approved HTTPS endpoint");
});
```

- [ ] **Step 4: Run adapter tests and verify red**

Run: `pnpm exec vitest run --project unit packages/object-storage/src/s3-raw-payload-store.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 5: Implement SDK isolation and fail-closed validation**

```ts
await this.client.send(new PutObjectCommand({ Bucket: this.config.bucket, Key: objectKey,
  Body: input.bytes, ContentType: input.contentType, ServerSideEncryption: "AES256",
  Metadata: { sha256 }, CacheControl: "private, no-store" }));
return { provider: "s3-compatible", bucket: this.config.bucket, objectKey, sha256,
  byteLength: input.bytes.byteLength, storedAt: this.clock.now().toISOString() };
```

Validate bucket, region, HTTPS endpoint allowlist and resolvable credential provider before connector/publisher startup in production. Never log command inputs, credentials, presigned URLs, bodies or SDK error metadata. Object keys contain normalized source, UTC date, run, page and digest only.

- [ ] **Step 6: Verify adapter tests, architecture isolation and security**

Run: `pnpm exec vitest run --project unit packages/object-storage && pnpm security:architecture && pnpm security:dependencies`

Expected: PASS; `rg -n "@aws-sdk" packages services apps` reports imports only inside `packages/object-storage`.

- [ ] **Step 7: Commit object storage adapter**

```bash
git add packages/object-storage pnpm-workspace.yaml tsconfig.json vitest.config.ts pnpm-lock.yaml
git commit -S -m "feat(storage): add durable raw payload adapter"
```

### Task 10: Versioned, Authorized, Rate-Limited Opportunity APIs

**Files:**
- Modify: `packages/auth/src/contracts.ts`
- Modify: `packages/auth/src/policy.ts`
- Modify: `packages/auth/src/policy.test.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/plugins/{authentication,authorization,rate-limit,metrics}.ts`
- Create: `apps/api/src/adapters/{postgres-authenticator,redis-rate-limiter}.ts`
- Create: `apps/api/src/routes/{opportunities,opportunity-sources,ingestion-runs,openapi}.ts`
- Create: `apps/api/src/routes/opportunities.contract.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/src/env.test.ts`
- Modify: `.env.example`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: bearer `Authenticator`, `AuthorizationPolicy`, ownership-aware application services, query/admin ports, Redis limiter and OpenAPI builder.
- Produces: all seven approved `/v1` routes with strict contracts, stable RFC 9457 errors, cursor pagination, explicit attribution, correlation IDs, `Retry-After`, and route metrics.

- [ ] **Step 1: Write failing API contract and authorization tests**

```ts
it.each([
  [undefined, 401, "authentication_required"],
  [actor([]), 403, "capability_denied"],
])("fails closed before publishing", async (principal, status, code) => {
  const response = await app(principal).inject({ method: "POST", url: "/v1/opportunities",
    headers: { "idempotency-key": "api-test-key" }, payload: validDirectCommand });
  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ code, correlationId: expect.any(String) });
});

it("validates strict input and organization membership", async () => {
  const response = await app(publisherWithoutMembership).inject({ method: "POST",
    url: "/v1/opportunities", headers: authHeaders, payload: validDirectCommand });
  expect(response.statusCode).toBe(403);
  expect(response.json().code).toBe("organization_scope_denied");
});

it("rate limits by actor and route with Retry-After", async () => {
  await exhaustLimit();
  const response = await requestAgain();
  expect(response.statusCode).toBe(429);
  expect(response.headers["retry-after"]).toBe("60");
});
```

- [ ] **Step 2: Add exact workspace and Redis dependencies**

Run: `pnpm add --filter @jovia/api @jovia/auth@workspace:* @jovia/database@workspace:* @jovia/opportunity-ingestion@workspace:* @jovia/object-storage@workspace:* ioredis@6.0.0`

- [ ] **Step 3: Run API tests and verify red**

Run: `pnpm exec vitest run --project unit apps/api/src/routes/opportunities.contract.test.ts apps/api/src/app.test.ts packages/auth/src/policy.test.ts`

Expected: FAIL because protected routes and middleware are absent.

- [ ] **Step 4: Implement API edge and production adapters**

```ts
app.addHook("preHandler", async (request) => {
  if (request.routeOptions.url === "/v1/health") return;
  request.actor = await authenticateBearer(request.headers.authorization, dependencies.authenticator);
  const limit = await dependencies.rateLimiter.consume({ actorId: request.actor.id,
    route: request.routeOptions.url, now: dependencies.clock.now() });
  if (!limit.allowed) throw rateLimitProblem(limit.retryAfterSeconds);
});
```

Route handlers parse params/query/body with exported Zod contracts, require exact capabilities, enforce publisher organization membership in the application service, and serialize only `CanonicalOpportunitySchema`. The Redis adapter uses an atomic Lua fixed-window operation keyed by stable actor ID and route template, not bearer token or IP. The Postgres authenticator hashes opaque credentials with SHA-256 before lookup and rejects revoked/expired sessions. Production config requires database, Redis and durable raw storage; test adapters are dependency-injected and named `Test*`.

- [ ] **Step 5: Verify all API contracts and security boundaries**

Run: `pnpm exec vitest run --project unit apps/api packages/auth && pnpm typecheck && pnpm security:secrets`

Expected: PASS for 401/403/404/409/422/429, strict validation, ownership, cursor contracts, attribution, OpenAPI route coverage, correlation and redaction.

- [ ] **Step 6: Commit public APIs**

```bash
git add apps/api packages/auth packages/config .env.example pnpm-lock.yaml
git commit -S -m "feat(api): expose governed opportunity v1 APIs"
```

### Task 11: Worker Scheduling, Outbox, Expiry, Retention, and Metrics

**Files:**
- Modify: `apps/worker/package.json`
- Create: `apps/worker/src/adapters/{metrics,scheduler,event-publisher}.ts`
- Create: `apps/worker/src/jobs/{source-poll,outbox-dispatch,expiry-sweep,retention-sweep}.ts`
- Create: `apps/worker/src/jobs/jobs.test.ts`
- Modify: `apps/worker/src/main.ts`
- Modify: `apps/worker/src/runtime.test.ts`
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/src/env.test.ts`
- Modify: `.env.example`
- Modify: `scripts/check-architecture.mjs`
- Modify: `scripts/check-architecture.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: BullMQ, Postgres ports, S3 adapter, Himalayas connector/runner, lifecycle/outbox services and OpenTelemetry-compatible metric sink.
- Produces: source-policy-driven scheduled polls, operational sweeps, bounded metrics and an import-policy guard that prevents downstream code from scheduling source polls.

- [ ] **Step 1: Write failing job/scheduling and architecture tests**

```ts
it("schedules Himalayas from policy nextPollAt and never from matching frequency", async () => {
  await scheduler.tick();
  expect(queue.add).toHaveBeenCalledWith("poll-source", { sourceCode: "himalayas" },
    expect.objectContaining({ jobId: "poll:himalayas:<policy-version>:<due-at>" }));
  expect(queue.add.mock.calls[0][2].delay).toBe(policyDueAt.getTime() - clock.now().getTime());
});

it("reports bounded freshness, circuit, quarantine, tombstone and outbox metrics", async () => {
  await metricsJob.run();
  expect(metricSink.labelValues()).toEqual(expect.arrayContaining([
    { source: "himalayas" }, { event_type: "opportunity.discovered.v1" },
  ]));
});
```

- [ ] **Step 2: Add exact workspace dependencies and run red tests**

Run: `pnpm add --filter @jovia/worker @jovia/database@workspace:* @jovia/opportunity-ingestion@workspace:* @jovia/object-storage@workspace:*`

Run: `pnpm exec vitest run --project unit apps/worker/src/jobs scripts/check-architecture.test.ts`

Expected: FAIL because jobs and the scheduling import guard do not exist.

- [ ] **Step 3: Implement composition and lawful scheduling separation**

```ts
const handles = [
  createSourcePollWorker({ processor: (job) => runner.run(job.data.sourceCode, job.data.correlationId, signal) }),
  createOutboxWorker({ processor: () => outbox.dispatchBatch(100) }),
  createExpiryWorker({ processor: () => lifecycle.expireDue(500) }),
  createRetentionWorker({ processor: () => lifecycle.purgeDue(100) }),
];
```

The scheduler queries due approved source policies; it cannot accept user matching cadence. BullMQ job IDs and database leases make delivery idempotent. Production connector startup resolves durable storage credentials and fails closed only when connector execution is enabled. Metrics expose only bounded source/event/outcome labels from the approved list. Extend the architecture checker to reject connector/scheduler imports from web, ranking, scoring, notifications, notification delivery and proposal generation.

- [ ] **Step 4: Verify worker resilience and separation**

Run: `pnpm exec vitest run --project unit apps/worker scripts/check-architecture.test.ts && pnpm security:architecture && pnpm typecheck`

Expected: PASS for scheduled policy floor, jobs, shutdown, idempotency, source freshness, circuit/rate/quarantine/tombstone/outbox metrics and forbidden imports.

- [ ] **Step 5: Commit worker operations**

```bash
git add apps/worker packages/config scripts .env.example pnpm-lock.yaml
git commit -S -m "feat(worker): operate lawful opportunity lifecycle"
```

### Task 12: Knowledge Base, Architecture, API, Database, Operations, and Security Evidence

**Files:**
- Create: `docs/architecture/opportunity-core-lawful-discovery.md`
- Create: `docs/api/opportunities-v1.md`
- Create: `docs/database/0001-opportunity-core.md`
- Create: `docs/knowledge-base/opportunity-core-lawful-discovery.md`
- Create: `docs/operations/opportunity-discovery-runbook.md`
- Create: `docs/security/opportunity-ingestion-threat-model.md`
- Modify: `docs/architecture/README.md`
- Modify: `docs/api/README.md`
- Modify: `docs/database/README.md`
- Modify: `docs/operations/README.md`
- Modify: `docs/security/README.md`
- Modify: `README.md`
- Modify: `Jovia-KnowledgeBase_combined.md`
- Rename: `Jovia_Governance_and_Business_Operations.md.md` to `Jovia_Governance_and_Business_Operations.md`

**Interfaces:**
- Consumes: implemented code, tests, migration, metrics, contracts and approved governing documents.
- Produces: navigable source-of-truth documentation and exact implementation evidence without creating a redundant ADR.

- [ ] **Step 1: Document implemented behavior and operational procedures**

Each document begins with Jovia metadata, authority and `read_before`/`read_after`. The architecture document traces eligibility → lease → fetch → raw storage → validate → normalize → transaction → outbox and direct publish through the same pipeline. The API guide lists status codes, capabilities, ownership, idempotency, cursors and attribution. The migration guide records upgrade/fresh/repeat/checksum tests. The runbook gives exact detection, kill-switch, inspection, remediation, replay and recovery commands for every scenario listed in design §9. The threat model maps SSRF, schema drift, XSS, credential leakage, cross-tenant access, replay, event duplication, poisoned payloads, retention failure and source-policy expiry to controls and tests.

- [ ] **Step 2: Update the Knowledge Base and navigation**

Add a compact authoritative implementation-status section to `Jovia-KnowledgeBase_combined.md` that links the approved spec, architecture, source reviews, API, migration, runbook and threat model. Mark Himalayas `real connector / disabled by default` and all non-implemented sources `not connected`. Rename the governance file to match accepted ADR metadata and update every repository reference atomically.

- [ ] **Step 3: Verify documentation integrity**

Run: `rg -n "Manus|connected" docs README.md Jovia-KnowledgeBase_combined.md`

Expected: No Manus dependency/branding claim; every “connected” claim is qualified by true runtime state.

Run: `rg -n "Jovia_Governance_and_Business_Operations\.md\.md" . --glob '!node_modules/**' --glob '!.git/**'`

Expected: no matches.

Run: `pnpm format:check && pnpm security:secrets`

Expected: PASS.

- [ ] **Step 4: Commit documentation and evidence**

```bash
git add -A README.md Jovia_Governance_and_Business_Operations.md.md Jovia_Governance_and_Business_Operations.md Jovia-KnowledgeBase_combined.md docs
git commit -S -m "docs: record opportunity core production evidence"
```

### Task 13: Complete Evidence Matrix, Signed History, Push, and Pull Request

**Files:**
- Create: `docs/delivery/batch-2-opportunity-core-evidence.md`
- Modify: `.github/workflows/ci.yml` only if an evidence gap requires an additional deterministic CI command.

**Interfaces:**
- Consumes: every task result and CI workflow.
- Produces: reproducible requirement-to-test evidence, clean signed branch, remote pull request and review-ready Batch 2 delivery.

- [ ] **Step 1: Run clean-install and every local quality gate from a clean tree**

Run: `pnpm install --frozen-lockfile`

Run: `pnpm format:check`

Run: `pnpm lint`

Run: `pnpm typecheck`

Run: `pnpm test:unit`

Run: `pnpm test:integration`

Run: `pnpm build`

Run: `pnpm security`

Run: `pnpm check`

Expected: all commands exit `0`; integration uses clean PostgreSQL 16/pgvector and Redis 8 services and applies migrations twice.

- [ ] **Step 2: Produce the evidence matrix**

For each Product Owner evidence item, record the exact contract/test name and most recent command result: source-policy enforcement, Himalayas contract, direct publishing, normalization, currency/language/compensation, deterministic deduplication, checkpoint resume, retry/rate/circuit behavior, tombstones/expiry, outbox, quarantine, freshness/metrics, migrations, API contracts/authorization, clean install, formatting, lint, types, unit/integration tests, build, architecture, secrets, dependency audit and CI. Record test adapters as simulations and never call them live integrations.

- [ ] **Step 3: Verify signed history and clean diff**

Run: `git diff --check origin/main...HEAD`

Run: `git status --short`

Run: `git log --format='%H %G? %s' origin/main..HEAD`

Expected: no whitespace errors, empty status, and every commit signature status is `G` under the configured Ed25519 allowed-signers policy.

- [ ] **Step 4: Commit final evidence**

```bash
git add docs/delivery/batch-2-opportunity-core-evidence.md .github/workflows/ci.yml
git commit -S -m "docs: add Batch 2 delivery evidence"
```

- [ ] **Step 5: Push the dedicated branch and create the pull request**

Run: `git push -u origin feat/opportunity-core-lawful-discovery`

Run: `gh pr create --base main --head feat/opportunity-core-lawful-discovery --title "feat: deliver opportunity core and lawful discovery" --body-file docs/delivery/batch-2-opportunity-core-evidence.md`

Expected: remote branch and PR are created without merging `main`.

- [ ] **Step 6: Wait for and inspect all remote checks**

Run: `gh pr checks --watch --fail-fast`

Expected: quality, integration, dependency review, secret scan and CodeQL complete successfully; GitHub displays all commits as Verified.
