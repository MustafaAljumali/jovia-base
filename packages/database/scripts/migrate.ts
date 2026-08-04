import { readFile } from "node:fs/promises";

import postgres from "postgres";

export async function applyFoundationMigration(databaseUrl: string): Promise<void> {
  const migrationUrl = new URL("../drizzle/0000_foundation.sql", import.meta.url);
  const migration = await readFile(migrationUrl, "utf8");
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql.begin(async (transaction) => {
      await transaction`CREATE TABLE IF NOT EXISTS jovia_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;
      const applied = await transaction<{ name: string }[]>`
        SELECT name FROM jovia_migrations WHERE name = '0000_foundation.sql'
      `;
      if (applied.length === 0) {
        await transaction.unsafe(migration);
        await transaction`INSERT INTO jovia_migrations (name) VALUES ('0000_foundation.sql')`;
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:///").href) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  await applyFoundationMigration(databaseUrl);
  process.stdout.write("Foundation migration applied.\n");
}
