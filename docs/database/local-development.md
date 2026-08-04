# Local PostgreSQL, pgvector, and Redis

Jovia uses PostgreSQL 16 as its only system of record. The local image includes
pgvector and is pinned by digest. Redis is ephemeral coordination infrastructure,
not a source of truth.

## Start and verify

1. Copy `.env.example` to `.env` without adding production credentials.
2. Run `docker compose up -d --wait postgres redis`.
3. Run `pnpm --filter @jovia/database db:migrate`.
4. Run `pnpm --filter @jovia/database db:check`.
5. Run `RUN_INTEGRATION_TESTS=true pnpm test:integration` (PowerShell: set the
   environment variable before the command).
6. Run `docker compose down` when finished. Add `--volumes` only when deliberately
   discarding local development data.

Both ports bind to loopback. Credentials in Compose are development-only. A failed
health check usually means ports `5432` or `6379` are occupied; stop the conflicting
local service or change the host-side mapping consistently with your `.env` file.

Migrations are forward-only and idempotently recorded in `jovia_migrations`.
Production rollback is performed with a reviewed compensating migration, never by
editing an applied migration.
