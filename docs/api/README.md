# Jovia API Policy

All public HTTP routes begin with `/v1`. The initial endpoint is `GET /v1/health`.
Successful responses and events are validated against shared Zod contracts before
leaving the application boundary.

Errors use `application/problem+json` and RFC 9457 fields: `type`, `title`,
`status`, optional `detail` and `instance`, plus stable Jovia `code` and
`correlationId`. Unknown errors return `internal_error` without internal messages,
stack traces, query text, request bodies, or credentials.

Clients may send `x-correlation-id` using 1–128 ASCII letters, digits, dots,
underscores, colons, or hyphens. Invalid or missing IDs are replaced and the
effective value is returned in the same header.

OpenAPI generation must derive from the same runtime schemas used for validation.
Within `/v1`, additive optional fields are compatible; removing fields, changing
meaning, narrowing accepted values, or changing error semantics requires a new API
version and migration window.

See `opportunities-v1.md` for Batch 2 route capabilities, ownership, idempotency,
cursor, attribution, rate-limit, and error contracts.
