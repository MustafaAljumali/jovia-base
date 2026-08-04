# First Delivery Foundation Architecture

Jovia starts as a modular monolith with independently scalable workers. `apps/api`
is the HTTP composition root, `apps/worker` owns asynchronous execution, and
`apps/web` consumes versioned contracts. Top-level `services/*` are bounded
application libraries, not separately deployed microservices.

## Dependency direction

```text
apps/* -> services/* -> packages/contracts and provider-neutral ports
apps/* -> infrastructure adapters (database, queues, identity, model providers)
infrastructure adapters -> external SDKs and services
```

Business services never import database drivers, queue clients, model-provider
SDKs, storage SDKs, or identity-vendor SDKs. Composition roots construct and inject
those adapters. Architecture checks enforce this rule on every change.

## Runtime flow

1. A request receives or generates a correlation ID at the API boundary.
2. Authentication resolves an immutable Jovia actor; authorization denies by
   default unless the actor holds the required capability.
3. Service logic invokes Jovia-owned ports.
4. Opportunity ingestion checks enabled state, mechanism, approved legal posture,
   verification recency, and rate policy before any connector runs.
5. AI work passes through safety, task routing, structured validation, audit, and
   usage accounting before results reach a service.
6. PostgreSQL is the system of record. Redis and BullMQ coordinate retryable work
   and may be rebuilt without loss of authoritative data.

## Initial deployment boundary

The web application, API, and worker are the only initial deployables. This keeps
transactions and operations understandable while package boundaries preserve a
future extraction path. Horizontal scaling is stateless for web/API; workers scale
by queue and concurrency. No external source is enabled by default.
