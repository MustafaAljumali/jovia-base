---
document: Opportunity API v1
version: 1.0.0
status: Implemented
authority: Product Owner Approved Batch 2 Specification
ai_context: Read Before Changing Public Opportunity APIs
read_before:
  - docs/architecture/opportunity-core-lawful-discovery.md
read_after: []
owner: Platform API
last_revised: 2026-08-05
last_verified: 2026-08-05
---

# Opportunity API v1

The runtime-validated OpenAPI 3.1 contract is served at `GET /v1/openapi.json`.
Every route below is versioned, authenticated, capability checked, actor-and-route
rate limited, correlated, measured, and serialized from shared Zod contracts.

| Operation | Capability | Additional rule |
|---|---|---|
| `GET /v1/opportunities` | `opportunity:read` | Opaque keyset cursor; maximum 100 |
| `GET /v1/opportunities/{id}` | `opportunity:read` | UUID path validation |
| `POST /v1/opportunities` | `opportunity:publish` | Membership, terms, `Idempotency-Key` |
| `PUT /v1/opportunities/{id}` | `opportunity:publish` | Owning organization, terms, idempotency |
| `DELETE /v1/opportunities/{id}` | `opportunity:publish` | Organization and terms headers, idempotency |
| `GET /v1/admin/opportunity-sources` | `source:read` | Exact policy/runtime state; no connection inference |
| `GET /v1/admin/ingestion-runs` | `admin:operate` | Bounded newest-first history |

Bearer values are opaque and are SHA-256 hashed before database lookup. Redis rate
keys use stable actor ID and route template, never token or IP. A separate bounded
per-instance IP limiter rejects abusive requests before bearer verification can
reach the session database; the actor/route Redis limiter remains the distributed
post-authentication control. A `429` response includes `Retry-After`. Successful
opportunity responses always include source attribution, original URL,
lifecycle/deletion state, and complete provenance.

Errors use `application/problem+json` with RFC 9457 fields, stable Jovia `code`, and
`correlationId`. Stable codes include `authentication_required`,
`capability_denied`, `organization_scope_denied`, `validation_failed`,
`invalid_cursor`, `idempotency_conflict`, `not_found`, and
`rate_limit_exceeded`. Unknown failures are redacted as `internal_error`.

Within `/v1`, additions must be optional and backward compatible. Removing a field,
changing its meaning, narrowing values, or changing error semantics requires a new
version and migration window.
