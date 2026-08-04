import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1 });
try {
  const extensions = await sql<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pgcrypto') ORDER BY extname
  `;
  const names = extensions.map(({ extname }) => extname);
  if (!names.includes("vector") || !names.includes("pgcrypto")) {
    throw new Error("Required PostgreSQL extensions are missing");
  }
  const requiredTables = [
    "source_policy_versions",
    "ingestion_runs",
    "connector_checkpoints",
    "quarantine_records",
    "opportunities",
    "opportunity_provenance",
    "opportunity_audits",
    "outbox_events",
  ];
  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${requiredTables})
  `;
  const foundTables = new Set(tables.map(({ table_name }) => table_name));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Required opportunity tables are missing: ${missingTables.join(", ")}`);
  }
  const sources = await sql<{ code: string; enabled: boolean; runtime_status: string }[]>`
    SELECT code, enabled, runtime_status
    FROM source_registry
    WHERE code IN ('himalayas', 'jovia-direct')
    ORDER BY code
  `;
  if (
    sources.length !== 2 ||
    sources[0]?.code !== "himalayas" ||
    sources[0].enabled ||
    sources[0].runtime_status !== "disabled" ||
    sources[1]?.code !== "jovia-direct" ||
    !sources[1].enabled ||
    sources[1].runtime_status !== "eligible"
  ) {
    throw new Error("Seeded opportunity source states do not match approved policy");
  }
  const missingForeignKeyIndexes = await sql<{ table_name: string; column_name: string }[]>`
    SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
      )
  `;
  if (missingForeignKeyIndexes.length > 0) {
    throw new Error("One or more PostgreSQL foreign keys are not indexed");
  }
  const checksums = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count FROM jovia_migration_checksums
  `;
  if ((checksums[0]?.count ?? 0) < 2) throw new Error("Migration checksum ledger is incomplete");
  process.stdout.write("PostgreSQL opportunity core check passed.\n");
} finally {
  await sql.end({ timeout: 5 });
}
