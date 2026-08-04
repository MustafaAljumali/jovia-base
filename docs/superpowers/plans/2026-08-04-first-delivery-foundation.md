---
document: First Delivery Foundation Implementation Plan
version: 1.0.0
status: Approved
authority: Implementation Plan
ai_context: Read Before First Delivery Foundation Work
read_before:
  - Jovia_Engineering_Constitution_v2.0.md
  - docs/adr/ADR-0001-production-monorepo-foundation.md
read_after:
  - docs/security/development-commit-signing.md
owner: Jovia Core Team
last_revised: 2026-08-04
last_verified: 2026-08-04
---

# First Delivery Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a clean, independently buildable Jovia monorepo with local infrastructure, governed AI and authentication ports, Gemini support, automated quality gates, and an evidence-based prototype migration inventory.

**Architecture:** The initial release is a modular monolith composed by `apps/api`, with `apps/worker` executing asynchronous workloads and `apps/web` consuming versioned contracts. Domain and application packages depend only on Jovia-owned ports; PostgreSQL, Redis, Gemini, HTTP, and identity implementations are adapters at the edge. Top-level `services/*` directories are workspace libraries and are not separate deployments.

**Tech Stack:** Node.js 24.14.0, pnpm 11.20.0, TypeScript 6.0.3, React 19.2.8, Vite 8.2.0, Fastify 5.11.2, Zod 4.4.3, PostgreSQL 16, pgvector, Drizzle ORM 0.45.2, Redis, BullMQ 6.0.7, Pino 10.3.1, OpenTelemetry API 1.9.1, Vitest 4.1.10, ESLint 10.8.0, Prettier 3.9.6, and `@google/genai` 2.15.0.

## Execution Status

- Completed implementation and local non-container quality gates are marked `[x]`.
- Historical red-state confirmation steps remain unchecked because those transient
  failures were not separately preserved as evidence; the final green tests are
  authoritative for the delivered behavior.
- Docker is unavailable on this development device. GitHub Actions Foundation CI
  run `30954957516` supplied the container evidence instead: PostgreSQL, Redis,
  migration, integration, quality, secret-scan, and CodeQL jobs completed
  successfully against commit `e9fac68d2cd26cab581a927ecf87e616947354bb`.

## Global Constraints

- The official repository is `MustafaAljumali/jovia-base`; the external prototype is a read-only migration source.
- The Engineering Constitution and Accepted ADR-0001 govern every task.
- PostgreSQL 16 with pgvector is the only production system-of-record baseline; MySQL and TiDB are prohibited.
- The initial architecture is a modular monolith plus independent workers; `services/*` are libraries, not microservices.
- Business and application logic may not import Gemini, Manus, database drivers, Redis clients, S3 SDKs, or identity-vendor SDKs.
- Gemini uses the stable model ID `gemini-3.6-flash`; no `latest`, preview, or experimental alias is permitted by default.
- External opportunity sources are disabled by default and must carry an executable legal posture before ingestion.
- No source code, dependency, environment variable, asset, or runtime path may depend on Manus.
- Every dependency version is exact, the pnpm lockfile is committed, and GitHub Actions are pinned to immutable SHAs.
- Formatting, linting, type checking, tests, production builds, secret scanning, dependency auditing, and architecture-boundary checks must pass with zero untriaged errors.
- Every commit is conventional and SSH-signed with fingerprint `SHA256:fXTH+W+yI0v8loV+QrzQysM0CVVGrR0eZjMf2Y2X074`.

---

## Planned File Map

Root tooling owns reproducibility and policy:

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`: one workspace and lockfile.
- `.node-version`, `.npmrc`: exact runtime and install policy.
- `tsconfig.base.json`, `tsconfig.node.json`, `tsconfig.web.json`, `tsconfig.json`: strict compiler policy and project graph.
- `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`: quality tooling.
- `.env.example`, `compose.yaml`: local configuration, PostgreSQL/pgvector, and Redis.
- `scripts/check-architecture.mjs`, `scripts/check-secrets.mjs`: dependency-boundary and secret gates.
- `.github/workflows/ci.yml`, `.github/dependabot.yml`: immutable CI and dependency review.

Applications are composition roots only:

- `apps/web`: React shell and public health/status presentation.
- `apps/api`: Fastify HTTP composition, correlation IDs, errors, and `/v1/health`.
- `apps/worker`: BullMQ/Redis composition and lifecycle management.

Packages own provider-neutral capabilities:

- `packages/contracts`: runtime-validated API, event, error, source, and AI audit contracts.
- `packages/config`: fail-closed environment parsing and redacted config views.
- `packages/observability`: Pino logger, AsyncLocalStorage correlation context, metrics/tracing ports.
- `packages/security`: secret redaction, safe error serialization, and safety policy ports.
- `packages/database`: PostgreSQL Drizzle schema, migrations, client, and bounded repositories.
- `packages/ai`: provider contracts, registry, routing, retries, circuit breaker, structured output, usage/cost, prompts, safety, audit, health, fake provider, and Gemini adapter.
- `packages/auth`: identity/session/authorization ports and deterministic in-memory adapter.
- `packages/localization`: supported locale contract for Arabic, English, French, and Spanish.
- `packages/notifications`: channel-neutral notification contracts.
- `packages/ui`: monochrome design tokens without Manus assets.
- `packages/testing`: deterministic clocks, IDs, and test factories.

Service libraries own bounded application workflows:

- `services/opportunity-ingestion`: lawful source registry and ingestion ports.
- `services/opportunity-scoring`: explainable score contract.
- `services/opportunity-ranking`: ranked opportunity contract.
- `services/proposal-generation`: proposal generation port.
- `services/notification-delivery`: notification delivery port.

Documentation owns evidence:

- `docs/architecture/first-delivery-foundation.md`: runtime/dependency/data-flow description.
- `docs/database/local-development.md`: PostgreSQL/pgvector/Redis setup and checks.
- `docs/api/README.md`: contract and OpenAPI policy.
- `docs/operations/local-development.md`: install, build, test, and troubleshooting procedure.
- `docs/migration/prototype-inventory.csv`: disposition for every prototype file.
- `docs/migration/prototype-inventory.md`: classification rules and totals.
- `docs/migration/documentation-status.md`: authority, duplicates, drafts, and missing structures.

---

### Task 1: Reproducible Workspace and Quality Toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.node-version`
- Create: `.npmrc`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `eslint.config.mjs`
- Create: `tsconfig.base.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `README.md`
- Create: `scripts/check-architecture.mjs`
- Create: `scripts/check-secrets.mjs`
- Test: `scripts/check-architecture.test.ts`
- Test: `scripts/check-secrets.test.ts`

**Interfaces:**
- Consumes: Accepted ADR-0001 and Node.js 24.14.0.
- Produces: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm security` as stable repository commands.

- [x] **Step 1: Add failing policy tests**

```ts
import { describe, expect, it } from "vitest";
import { findForbiddenImports } from "./check-architecture.mjs";

describe("architecture policy", () => {
  it("rejects an external provider import outside an adapter", () => {
    expect(findForbiddenImports("packages/ai/src/router.ts", 'import "@google/genai"')).toEqual([
      "@google/genai imports are restricted to packages/ai/src/providers/gemini",
    ]);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { scanSecretText } from "./check-secrets.mjs";

describe("secret policy", () => {
  it("detects an OpenSSH private key marker", () => {
    expect(scanSecretText("-----BEGIN OPENSSH PRIVATE KEY-----")).toContain(
      "OpenSSH private key material",
    );
  });
});
```

- [ ] **Step 2: Run the policy tests and confirm they fail because the scripts do not exist**

Run: `pnpm exec vitest run scripts/check-architecture.test.ts scripts/check-secrets.test.ts`

Expected: FAIL with module-resolution errors for both policy scripts.

- [x] **Step 3: Implement root tooling with exact versions and strict defaults**

`package.json` must contain exact versions and these scripts:

```json
{
  "name": "jovia",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.20.0",
  "engines": { "node": ">=24.14.0 <25", "pnpm": "11.20.0" },
  "scripts": {
    "build": "tsc -b && pnpm --filter @jovia/web build",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run --coverage",
    "security:architecture": "node scripts/check-architecture.mjs",
    "security:secrets": "node scripts/check-secrets.mjs",
    "security:dependencies": "pnpm audit --audit-level high",
    "security": "pnpm security:architecture && pnpm security:secrets && pnpm security:dependencies",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm security"
  }
}
```

The architecture script scans tracked TypeScript/JavaScript files and enforces:

```js
export const forbiddenRuntimePatterns = [
  { pattern: /manus/i, message: "Manus runtime references are prohibited" },
  { pattern: /drizzle-orm\/mysql|mysql2|tidb/i, message: "MySQL and TiDB imports are prohibited" },
];

export function findForbiddenImports(filePath, sourceText) {
  const errors = [];
  if (sourceText.includes("@google/genai") && !filePath.startsWith("packages/ai/src/providers/gemini/")) {
    errors.push("@google/genai imports are restricted to packages/ai/src/providers/gemini");
  }
  return errors;
}
```

The secret script scans Git-tracked content only and rejects private-key markers,
GitHub tokens, Google API key formats, and committed `.env` files while allowing
documented non-secret example values.

- [x] **Step 4: Install with pnpm 11.20.0 and create the frozen lockfile**

Run: `pnpm install --save-exact`

Expected: installation succeeds, `pnpm-lock.yaml` is created, and no lifecycle script requires manual approval.

- [x] **Step 5: Run root policy tests and static gates**

Run: `pnpm exec vitest run scripts/check-architecture.test.ts scripts/check-secrets.test.ts`

Expected: 2 test files pass.

Run: `pnpm format && pnpm lint`

Expected: zero lint errors and zero warnings.

- [x] **Step 6: Commit the workspace toolchain**

```powershell
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .node-version .npmrc .prettierrc.json .prettierignore eslint.config.mjs tsconfig.base.json tsconfig.node.json tsconfig.web.json tsconfig.json vitest.config.ts .env.example README.md scripts
git commit -S -m "chore: establish monorepo quality toolchain"
```

---

### Task 2: Shared Contracts, Configuration, Security, and Observability

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/health.ts`
- Create: `packages/contracts/src/sources.ts`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/env.ts`
- Test: `packages/config/src/env.test.ts`
- Create: `packages/security/package.json`
- Create: `packages/security/tsconfig.json`
- Create: `packages/security/src/index.ts`
- Create: `packages/security/src/redaction.ts`
- Test: `packages/security/src/redaction.test.ts`
- Create: `packages/observability/package.json`
- Create: `packages/observability/tsconfig.json`
- Create: `packages/observability/src/index.ts`
- Create: `packages/observability/src/context.ts`
- Create: `packages/observability/src/logger.ts`
- Test: `packages/observability/src/context.test.ts`
- Create: `packages/localization/package.json`
- Create: `packages/localization/tsconfig.json`
- Create: `packages/localization/src/index.ts`
- Test: `packages/localization/src/index.test.ts`
- Create: `packages/notifications/package.json`
- Create: `packages/notifications/tsconfig.json`
- Create: `packages/notifications/src/index.ts`
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/tokens.ts`
- Create: `packages/testing/package.json`
- Create: `packages/testing/tsconfig.json`
- Create: `packages/testing/src/index.ts`

**Interfaces:**
- Consumes: Zod 4.4.3, Pino 10.3.1, OpenTelemetry API 1.9.1.
- Produces: `loadApiConfig(env)`, `loadWorkerConfig(env)`, `createLogger(options)`, `runWithCorrelationId(id, fn)`, `getCorrelationId()`, `redactSensitive(value)`, `AppError`, `HealthResponseSchema`, `SourceRegistrationSchema`, and `SupportedLocaleSchema`.

- [x] **Step 1: Write fail-closed configuration and redaction tests**

```ts
it("requires a Gemini key and pinned model when Gemini is enabled", () => {
  expect(() => loadWorkerConfig({ NODE_ENV: "production", AI_GEMINI_ENABLED: "true" })).toThrow(
    /AI_GEMINI_API_KEY/,
  );
});
```

```ts
it("redacts nested secret fields without changing safe values", () => {
  expect(redactSensitive({ apiKey: "secret", nested: { requestId: "req-1" } })).toEqual({
    apiKey: "[REDACTED]",
    nested: { requestId: "req-1" },
  });
});
```

- [ ] **Step 2: Run focused tests and confirm missing exports fail**

Run: `pnpm exec vitest run packages/config/src/env.test.ts packages/security/src/redaction.test.ts`

Expected: FAIL because the package implementations do not exist.

- [x] **Step 3: Implement shared contracts and fail-closed config**

Use Zod coercion and a cross-field refinement:

```ts
const WorkerEnvSchema = BaseEnvSchema.extend({
  REDIS_URL: z.url(),
  AI_GEMINI_ENABLED: BooleanStringSchema.default("false"),
  AI_GEMINI_API_KEY: z.string().min(20).optional(),
  AI_GEMINI_MODEL: z.literal("gemini-3.6-flash").optional(),
}).superRefine((value, context) => {
  if (value.AI_GEMINI_ENABLED && !value.AI_GEMINI_API_KEY) {
    context.addIssue({ code: "custom", path: ["AI_GEMINI_API_KEY"], message: "required when Gemini is enabled" });
  }
  if (value.AI_GEMINI_ENABLED && value.AI_GEMINI_MODEL !== "gemini-3.6-flash") {
    context.addIssue({ code: "custom", path: ["AI_GEMINI_MODEL"], message: "must pin gemini-3.6-flash" });
  }
});
```

`toRedactedConfig()` returns booleans indicating whether secrets are configured; it never returns secret values.

- [x] **Step 4: Implement correlation context and structured logging**

```ts
const storage = new AsyncLocalStorage<{ correlationId: string }>();

export function runWithCorrelationId<T>(correlationId: string, work: () => T): T {
  return storage.run({ correlationId }, work);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
```

Pino serializers must apply `redactSensitive`, emit `service`, `environment`,
`correlationId`, and normalized error fields, and never serialize raw request bodies.

- [x] **Step 5: Implement locale, notification, UI-token, and test contracts**

```ts
export const SupportedLocaleSchema = z.enum(["ar", "en", "fr", "es"]);
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;
```

UI tokens contain only black, white, and neutral gray semantic values. Notification
contracts contain channel, priority, template ID, locale, recipient reference, and
correlation ID without vendor-specific fields.

- [x] **Step 6: Run package tests, type checking, and build**

Run: `pnpm exec vitest run packages`

Expected: configuration, redaction, correlation, and locale tests pass.

Run: `pnpm typecheck && pnpm build`

Expected: project references compile without implicit `any` or unresolved exports.

- [x] **Step 7: Commit shared platform packages**

```powershell
git add packages tsconfig.json
git commit -S -m "feat: add governed platform contracts"
```

---

### Task 3: Web, API, and Worker Composition Roots

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/plugins/request-context.ts`
- Create: `apps/api/src/routes/health.ts`
- Test: `apps/api/src/app.test.ts`
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/runtime.ts`
- Create: `apps/worker/src/main.ts`
- Test: `apps/worker/src/runtime.test.ts`

**Interfaces:**
- Consumes: shared config, contracts, security, observability, localization, and UI tokens.
- Produces: `createApiApp(dependencies)`, `GET /v1/health`, `createWorkerRuntime(dependencies)`, and a production web build with no Manus runtime.

- [x] **Step 1: Write API and worker lifecycle tests**

```ts
it("returns a validated health response and correlation id", async () => {
  const app = await createApiApp({ config: testApiConfig(), logger: silentLogger() });
  const response = await app.inject({ method: "GET", url: "/v1/health", headers: { "x-correlation-id": "req-1" } });
  expect(response.statusCode).toBe(200);
  expect(response.headers["x-correlation-id"]).toBe("req-1");
  expect(HealthResponseSchema.parse(response.json()).status).toBe("ok");
});
```

```ts
it("starts and stops every registered worker exactly once", async () => {
  const lifecycle = createWorkerRuntime([fakeWorker("ingestion"), fakeWorker("notifications")]);
  await lifecycle.start();
  await lifecycle.stop();
  expect(lifecycle.snapshot()).toEqual({ state: "stopped", workers: ["ingestion", "notifications"] });
});
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `pnpm exec vitest run apps/api/src/app.test.ts apps/worker/src/runtime.test.ts`

Expected: FAIL because the composition roots are absent.

- [x] **Step 3: Implement Fastify API with correlation and normalized errors**

`createApiApp()` uses Fastify 5.11.2, registers request context before routes,
validates health output with Zod, returns RFC 9457-style problem details for
`AppError`, and maps unknown errors to a non-secret `internal_error` response.

```ts
app.get("/v1/health", async () => ({
  status: "ok",
  service: "jovia-api",
  version: config.version,
  timestamp: clock.now().toISOString(),
}));
```

- [x] **Step 4: Implement worker lifecycle without external work at import time**

Workers are created in `main.ts`, start only after configuration validates, handle
`SIGINT` and `SIGTERM`, and close in reverse registration order. Unit tests use
fake worker handles; Redis-backed handles are added with the database task.

- [x] **Step 5: Implement the minimal monochrome React shell**

The page identifies Jovia as an AI operating system for freelancers, exposes a
semantic status region, supports system light/dark mode using neutral tokens, and
contains no platform-integration claims. React Testing Library verifies the main
heading and status region.

- [x] **Step 6: Run application tests and production builds**

Run: `pnpm exec vitest run apps`

Expected: web, API, and worker tests pass.

Run: `pnpm typecheck && pnpm build`

Expected: API/worker TypeScript builds and Vite production build succeed.

- [x] **Step 7: Commit composition roots**

```powershell
git add apps tsconfig.json
git commit -S -m "feat: add application composition roots"
```

---

### Task 4: PostgreSQL, pgvector, Redis, and Queue Baseline

**Files:**
- Create: `compose.yaml`
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/drizzle.config.ts`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/schema/source-registry.ts`
- Create: `packages/database/src/schema/ai-usage-events.ts`
- Create: `packages/database/src/schema/index.ts`
- Create: `packages/database/src/repositories/source-registry.ts`
- Create: `packages/database/drizzle/0000_foundation.sql`
- Test: `packages/database/src/schema/schema.test.ts`
- Test: `packages/database/src/integration/foundation.integration.test.ts`
- Create: `packages/database/scripts/migrate.ts`
- Create: `packages/database/scripts/check.ts`
- Create: `apps/worker/src/adapters/bullmq.ts`
- Test: `apps/worker/src/adapters/bullmq.test.ts`
- Create: `docs/database/local-development.md`

**Interfaces:**
- Consumes: validated `DATABASE_URL` and `REDIS_URL` configuration.
- Produces: `createDatabase(url)`, `SourceRegistryRepository`, forward-only migration `0000_foundation.sql`, pgvector extension verification, and `createBullMqWorkerHandle(options)`.

- [x] **Step 1: Write schema and repository tests**

```ts
it("keeps new sources disabled until legal posture is executable", () => {
  expect(sourceRegistry.enabled.hasDefault).toBe(true);
  expect(sourceRegistrationSchema.parse(validSource()).enabled).toBe(false);
});
```

The integration test applies migrations to an empty database, verifies
`extname = 'vector'`, inserts a disabled Himalayas source with mechanism
`official_api`, reads it through the repository, and verifies Redis `PING`.

- [ ] **Step 2: Run unit tests and confirm missing schema fails**

Run: `pnpm exec vitest run packages/database/src/schema/schema.test.ts`

Expected: FAIL because the database package is absent.

- [x] **Step 3: Implement PostgreSQL-only schema and forward migration**

The migration begins with:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`source_registry` stores code, name, mechanism, legal posture, terms URL,
attribution rule, polling floor, cache TTL, redistribution rule, owner,
`last_verified_at`, and `enabled DEFAULT false`. `ai_usage_events` stores request,
task, provider, model, prompt version, input/output/total tokens, cost in micro-USD,
success, normalized error category, and timestamp.

- [x] **Step 4: Implement local containers with health checks and persistent volumes**

`compose.yaml` defines `postgres` using a digest-pinned `pgvector/pgvector:pg16`
image and `redis` using a digest-pinned Alpine image. Ports bind to loopback only.
Credentials use development-only values mirrored in `.env.example`; production
secrets never appear in Compose.

- [x] **Step 5: Start infrastructure and run integration tests**

Run: `docker compose up -d --wait postgres redis`

Expected: both services report healthy.

Run: `pnpm --filter @jovia/database db:migrate && pnpm test:integration`

Expected: migrations apply once, pgvector exists, the source repository passes,
and Redis responds.

- [x] **Step 6: Implement BullMQ adapter and lifecycle test**

The adapter accepts queue name, Redis connection factory, processor, concurrency,
and logger. It exposes the provider-neutral worker handle from Task 3 and emits
correlation IDs from job data without logging job payloads.

- [x] **Step 7: Stop containers and commit infrastructure**

Run: `docker compose down`

```powershell
git add compose.yaml packages/database apps/worker/src/adapters docs/database .env.example tsconfig.json package.json pnpm-lock.yaml
git commit -S -m "feat: add postgres and queue foundation"
```

---

### Task 5: Provider-Neutral AI Runtime

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/index.ts`
- Create: `packages/ai/src/contracts.ts`
- Create: `packages/ai/src/errors.ts`
- Create: `packages/ai/src/provider-registry.ts`
- Create: `packages/ai/src/task-router.ts`
- Create: `packages/ai/src/retry.ts`
- Create: `packages/ai/src/circuit-breaker.ts`
- Create: `packages/ai/src/structured-output.ts`
- Create: `packages/ai/src/usage.ts`
- Create: `packages/ai/src/prompts.ts`
- Create: `packages/ai/src/safety.ts`
- Create: `packages/ai/src/audit.ts`
- Create: `packages/ai/src/health.ts`
- Create: `packages/ai/src/providers/fake.ts`
- Test: `packages/ai/src/provider-registry.test.ts`
- Test: `packages/ai/src/task-router.test.ts`
- Test: `packages/ai/src/circuit-breaker.test.ts`
- Test: `packages/ai/src/structured-output.test.ts`
- Test: `packages/ai/src/usage.test.ts`
- Test: `packages/ai/src/prompts.test.ts`
- Test: `packages/ai/src/safety.test.ts`

**Interfaces:**
- Consumes: shared contracts, security, observability, Zod, and deterministic testing utilities.
- Produces: `AiProvider`, `AiProviderRegistry`, `AiTaskRouter`, `CircuitBreaker`, `PromptRegistry`, `SafetyGuard`, `AiAuditSink`, `AiUsageSink`, `ProviderHealthRegistry`, and `FakeAiProvider`.

- [x] **Step 1: Write routing, failover, structure, and accounting tests**

```ts
it("fails over after a retryable primary error and records both attempts", async () => {
  const primary = FakeAiProvider.retryableFailure("gemini-primary");
  const fallback = FakeAiProvider.success("fallback", { answer: "ok" });
  const result = await createRouter(primary, fallback).invoke(requestWithSchema(z.object({ answer: z.string() })));
  expect(result.output).toEqual({ answer: "ok" });
  expect(result.audit.attempts.map((attempt) => attempt.providerId)).toEqual(["gemini-primary", "fallback"]);
});
```

```ts
it("opens the circuit after three provider failures and probes after reset", async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 3, resetAfterMs: 30_000, clock: fakeClock });
  breaker.recordFailure(); breaker.recordFailure(); breaker.recordFailure();
  expect(breaker.state()).toBe("open");
  fakeClock.advance(30_000);
  expect(breaker.state()).toBe("half_open");
});
```

- [ ] **Step 2: Run the AI tests and confirm missing modules fail**

Run: `pnpm exec vitest run packages/ai`

Expected: FAIL because the AI package does not exist.

- [x] **Step 3: Implement provider contracts, registry, and task policies**

```ts
export interface AiProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<AiCapability>;
  invoke(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResponse>;
  stream(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamEvent>;
  health(): Promise<ProviderHealth>;
}
```

`AiTaskRouter` receives immutable policies containing task, primary provider,
ordered fallbacks, timeout, max attempts, required capabilities, and safety policy.
Duplicate provider IDs and policies referring to unregistered providers fail at
startup.

- [x] **Step 4: Implement timeout, retry, circuit breaker, and failover**

Retries use bounded exponential backoff with jitter supplied by an injectable
random function. Timeouts use `AbortController`. Authentication, safety,
validation, and non-retryable client errors never retry. Circuit state is tracked
per provider and model. Failover preserves the request ID, prompt version, output
schema, and safety policy.

- [x] **Step 5: Implement structured output, prompt versioning, safety, and audit**

Structured responses validate through the request Zod schema before reaching
business logic. Prompt IDs follow `<bounded-context>.<purpose>` and semantic
versions. Safety runs before every provider call and redacts configured PII fields.
Audit records contain request ID, task, provider, model, prompt version, timestamps,
attempt result, safety outcome, token usage, cost, and error category; they never
contain secret values or raw prompts by default.

- [x] **Step 6: Implement normalized usage and cost accounting**

```ts
export function calculateCostMicrousd(usage: TokenUsage, price: TokenPrice): bigint {
  return (
    (BigInt(usage.inputTokens) * price.inputMicrousdPerMillion +
      BigInt(usage.outputTokens) * price.outputMicrousdPerMillion) /
    1_000_000n
  );
}
```

Unknown model pricing produces `costStatus: "unknown"` rather than fabricating a
zero cost. Database-backed sinks implement the package ports in the composition root.

- [x] **Step 7: Run AI unit tests and commit the provider-neutral runtime**

Run: `pnpm exec vitest run packages/ai && pnpm typecheck && pnpm security:architecture`

Expected: AI tests pass and no provider SDK appears outside an adapter path.

```powershell
git add packages/ai tsconfig.json package.json pnpm-lock.yaml
git commit -S -m "feat: add provider-neutral ai runtime"
```

---

### Task 6: Gemini Provider Adapter

**Files:**
- Create: `packages/ai/src/providers/gemini/client.ts`
- Create: `packages/ai/src/providers/gemini/provider.ts`
- Create: `packages/ai/src/providers/gemini/mapping.ts`
- Create: `packages/ai/src/providers/gemini/usage.ts`
- Test: `packages/ai/src/providers/gemini/provider.test.ts`
- Test: `packages/ai/src/providers/gemini/mapping.test.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/config/src/env.ts`
- Modify: `.env.example`
- Create: `docs/architecture/ai-provider-runtime.md`

**Interfaces:**
- Consumes: `AiProvider`, `ProviderRequest`, `ProviderResponse`, `ProviderStreamEvent`, validated Gemini configuration, and `@google/genai` 2.15.0.
- Produces: `GeminiProvider`, `createGeminiClient(config)`, stable `gemini-3.6-flash` routing, streaming, structured output configuration, normalized usage, and health state.

- [x] **Step 1: Write adapter tests against a fake Gemini client**

```ts
it("maps a Gemini response into provider-neutral output and usage", async () => {
  const provider = new GeminiProvider(fakeGeminiClient({ text: '{"score":91}', prompt: 100, output: 20 }));
  const response = await provider.invoke(providerRequest(), new AbortController().signal);
  expect(response).toMatchObject({ text: '{"score":91}', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } });
});
```

Streaming tests verify ordered deltas, one terminal usage event, abort propagation,
and normalized provider errors without issuing a network request.

- [ ] **Step 2: Run Gemini tests and confirm missing adapter fails**

Run: `pnpm exec vitest run packages/ai/src/providers/gemini`

Expected: FAIL because the adapter does not exist.

- [x] **Step 3: Implement the SDK boundary in `client.ts` only**

`client.ts` is the only file allowed to import `@google/genai`. It exposes a small
Jovia-owned `GeminiClient` interface used by `provider.ts`. Generation uses the
stable API and model `gemini-3.6-flash`, requests JSON MIME type when a structured
schema exists, and maps SDK streaming chunks to `AsyncIterable` events.

- [x] **Step 4: Normalize errors, usage, safety, and health**

Map timeouts, 429s, 5xx responses, authentication failures, content-safety blocks,
and malformed outputs into `AiProviderError` categories. Health state derives from
configuration, circuit state, last success, and last normalized failure; no paid
probe runs solely for a health endpoint.

- [x] **Step 5: Run adapter tests and architecture scan**

Run: `pnpm exec vitest run packages/ai/src/providers/gemini`

Expected: adapter and mapping tests pass without a Gemini credential.

Run: `pnpm security:architecture`

Expected: the only `@google/genai` import is `packages/ai/src/providers/gemini/client.ts`.

- [x] **Step 6: Commit the Gemini adapter**

```powershell
git add packages/ai packages/config .env.example docs/architecture/ai-provider-runtime.md package.json pnpm-lock.yaml
git commit -S -m "feat: add gemini ai provider"
```

---

### Task 7: Authentication and Bounded Service Ports

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/src/contracts.ts`
- Create: `packages/auth/src/policy.ts`
- Create: `packages/auth/src/adapters/in-memory.ts`
- Test: `packages/auth/src/policy.test.ts`
- Test: `packages/auth/src/adapters/in-memory.test.ts`
- Create: `services/opportunity-ingestion/package.json`
- Create: `services/opportunity-ingestion/tsconfig.json`
- Create: `services/opportunity-ingestion/src/index.ts`
- Test: `services/opportunity-ingestion/src/index.test.ts`
- Create: `services/opportunity-scoring/package.json`
- Create: `services/opportunity-scoring/tsconfig.json`
- Create: `services/opportunity-scoring/src/index.ts`
- Create: `services/opportunity-ranking/package.json`
- Create: `services/opportunity-ranking/tsconfig.json`
- Create: `services/opportunity-ranking/src/index.ts`
- Create: `services/proposal-generation/package.json`
- Create: `services/proposal-generation/tsconfig.json`
- Create: `services/proposal-generation/src/index.ts`
- Create: `services/notification-delivery/package.json`
- Create: `services/notification-delivery/tsconfig.json`
- Create: `services/notification-delivery/src/index.ts`
- Create: `docs/architecture/first-delivery-foundation.md`

**Interfaces:**
- Consumes: shared identity, source, notification, AI, and observability contracts.
- Produces: `Authenticator`, `SessionStore`, `AuthorizationPolicy`, `InMemoryAuthAdapter`, `OpportunityIngestionService`, `OpportunityScoringPort`, `OpportunityRankingPort`, `ProposalGenerationPort`, and `NotificationDeliveryPort`.

- [x] **Step 1: Write deterministic auth and legal-source tests**

```ts
it("denies a capability that the actor does not hold", () => {
  expect(policy.can(actorWith("profile:read"), "source:enable")).toBe(false);
});
```

```ts
it("refuses to ingest an unsupported or disabled source", async () => {
  await expect(service.ingest(source({ mechanism: "unsupported", enabled: false }))).rejects.toMatchObject({
    code: "source_not_eligible",
  });
});
```

- [ ] **Step 2: Run focused tests and confirm missing packages fail**

Run: `pnpm exec vitest run packages/auth services/opportunity-ingestion`

Expected: FAIL because the auth and ingestion packages are absent.

- [x] **Step 3: Implement provider-neutral authentication**

Identity uses immutable Jovia actor IDs and external subject references without
vendor names. Session records store opaque hashes rather than bearer tokens.
Authorization is deny-by-default. The in-memory adapter is deterministic and
exported only for tests/local development; no production identity provider is
selected in this batch.

- [x] **Step 4: Implement service ports with lawful-source enforcement**

The ingestion service checks mechanism, enabled state, legal posture, verification
date, and rate policy before invoking a connector. The remaining services expose
typed ports and result contracts without mock external platform claims. All
cross-context dependencies enter through constructor-injected interfaces.

- [x] **Step 5: Run tests, architecture scan, and commit boundaries**

Run: `pnpm exec vitest run packages/auth services && pnpm typecheck && pnpm security:architecture`

Expected: auth/ingestion tests pass and service libraries contain no infrastructure imports.

```powershell
git add packages/auth services docs/architecture/first-delivery-foundation.md tsconfig.json
git commit -S -m "feat: add auth and bounded service ports"
```

---

### Task 8: CI and Security Quality Gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `docs/security/quality-gates.md`
- Create: `docs/operations/local-development.md`
- Create: `docs/api/README.md`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: all root scripts and container integration tests.
- Produces: immutable GitHub Actions jobs for quality, integration, CodeQL, dependency review, and secret scanning.

- [x] **Step 1: Add a workflow-policy assertion to the architecture script**

```js
export function findMutableActionReferences(workflowText) {
  return [...workflowText.matchAll(/uses:\s+[^\s]+@(v\d+|main|master)\b/g)].map((match) => match[0]);
}
```

Add a test proving `actions/checkout@v4` fails and a 40-character SHA passes.

- [ ] **Step 2: Run the policy test and confirm it fails before workflow support exists**

Run: `pnpm exec vitest run scripts/check-architecture.test.ts`

Expected: FAIL for the missing `findMutableActionReferences` export.

- [x] **Step 3: Implement immutable CI actions**

Pin these reviewed action commits:

```text
actions/checkout@11d5960a326750d5838078e36cf38b85af677262
pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa
actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
github/codeql-action@c3400c2f38909e0dcf3c3a41f2030a8217be5d3e
actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48
gitleaks/gitleaks-action@dcedce43c6f43de0b836d1fe38946645c9c638dc
```

The quality job runs frozen install, format check, lint, type check, unit tests with
coverage, builds, architecture scan, secret scan, and high-severity audit. The
integration job starts digest-pinned PostgreSQL/pgvector and Redis services, applies
migrations, and runs integration tests. CodeQL and dependency review use least-
privilege permissions.

- [x] **Step 4: Document exact local and CI procedures**

Operations documentation includes prerequisites, frozen installation, container
startup, migration, tests, build, shutdown, expected health output, and recovery
for occupied ports or unhealthy containers. API documentation defines `/v1`,
OpenAPI generation, RFC 9457 errors, correlation headers, and compatibility rules.

- [x] **Step 5: Run all local equivalents of CI**

Run: `pnpm check`

Expected: every non-container quality gate passes.

Run: `docker compose up -d --wait postgres redis; pnpm test:integration; docker compose down`

Expected: integration tests pass and containers stop cleanly.

- [x] **Step 6: Commit CI and security gates**

```powershell
git add .github scripts docs/security/quality-gates.md docs/operations/local-development.md docs/api/README.md README.md package.json pnpm-lock.yaml
git commit -S -m "ci: enforce foundation quality gates"
```

---

### Task 9: Prototype Inventory, Documentation Status, and Final Evidence

**Files:**
- Create: `docs/migration/prototype-inventory.csv`
- Create: `docs/migration/prototype-inventory.md`
- Create: `docs/migration/documentation-status.md`
- Create: `docs/migration/README.md`
- Create: `docs/architecture/README.md`
- Create: `docs/database/README.md`
- Create: `docs/operations/README.md`
- Create: `docs/security/README.md`
- Create: `docs/api/README.md`
- Modify: `docs/superpowers/plans/2026-08-04-first-delivery-foundation.md`

**Interfaces:**
- Consumes: the external prototype file list, official documentation authority, duplicate analysis, and all first-batch quality evidence.
- Produces: one disposition row for every prototype file, documentation authority/status report, final check evidence, and a clean signed branch ready for review.

- [x] **Step 1: Generate and manually review the inventory**

The CSV header is exact:

```csv
source_path,bounded_context,disposition,reason,target_path,manus_coupling,persistence_coupling,test_evidence,security_notes,migration_commit
```

Every prototype file receives exactly one disposition: `reuse_unchanged`,
`refactor_before_reuse`, `rewrite`, `reject`, or `archive_for_reference`.
Manus runtime/auth/storage/scheduling/build files, MySQL persistence, mock platform
integrations, broken email service imports, dead code, and generated public assets
are rejected or archived. Reviewed design tokens, accessible presentational UI, and
provider-neutral tests are prioritized for refactoring before reuse. No row claims
a migration commit before that migration exists; the field is the explicit value
`not_migrated_in_first_batch`.

- [x] **Step 2: Validate inventory coverage with a one-time local comparison**

Run a read-only comparison between the external prototype file list and CSV
`source_path` values. Expected: missing count `0`, duplicate count `0`, unknown
disposition count `0`.

- [x] **Step 3: Write the documentation status report**

The report records:

- Engineering Constitution v2.0 as supreme engineering authority.
- Strategic Product Vision and Governance documents as approved controlling input.
- ADR-0001 as Accepted foundational architecture.
- Technical Blueprint as the approved integration/database research baseline.
- the combined Knowledge Base constitution as Draft and non-overriding;
- structured Knowledge Base navigation, ADR, architecture, database, and service
  sections that are empty or absent;
- exact duplicate document pairs and the duplicate `.md.md` filenames;
- the high overlap between `Jovia-KnowledgeBase_combined.md` and
  `bibcit-export-2026-07-27.md`;
- additive normalization recommendations without renaming or deleting frozen
  knowledge structures.

- [x] **Step 4: Run the complete acceptance matrix**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm security
docker compose up -d --wait postgres redis
pnpm test:integration
docker compose down
git diff --check
git status --short
```

Expected: every command exits zero, Docker services stop, and only the intended
documentation changes remain before the final commit.

- [x] **Step 5: Mark completed plan checkboxes and commit documentation evidence**

```powershell
git add docs
git commit -S -m "docs: record foundation migration evidence"
```

- [x] **Step 6: Verify every branch commit is SSH-signed**

Run: `git log --show-signature --format="%H %G? %s" docs/adr-0001-monorepo-foundation..HEAD`

Expected: every implementation commit reports signature status `G` and fingerprint
`SHA256:fXTH+W+yI0v8loV+QrzQysM0CVVGrR0eZjMf2Y2X074`.

- [x] **Step 7: Push the implementation branch and verify the remote head**

Run: `git push --set-upstream origin feat/first-delivery-foundation`

Expected: remote branch head equals local `HEAD`; GitHub displays the signed
commits as Verified and CI begins against the pushed branch.
