# Database

- `local-development.md`: PostgreSQL 16 pgvector Redis migration and health-check
  procedures.
- `../../packages/database/drizzle/0000_foundation.sql`: forward-only foundation
  migration.
- `0001-opportunity-core.md`: opportunity migrations, checksum enforcement,
  transaction boundaries, indexes, and CI evidence.

PostgreSQL is the only system of record. Redis is rebuildable coordination state.
