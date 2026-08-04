import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import postgres from "postgres";

export interface MigrationFile {
  name: string;
  sql: string;
  sha256: string;
}

export function sha256Migration(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function assertMigrationChecksum(name: string, expected: string, actual: string): void {
  if (expected !== actual) throw new Error(`migration checksum mismatch for ${name}`);
}

export async function discoverMigrations(
  directoryUrl = new URL("../drizzle/", import.meta.url),
): Promise<MigrationFile[]> {
  const entries = (await readdir(directoryUrl, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^\d{4}_[a-z0-9_]+\.sql$/u.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const prefixes = entries.map(({ name }) => name.slice(0, 4));
  if (new Set(prefixes).size !== prefixes.length) {
    throw new Error("migration sequence contains duplicate numeric prefixes");
  }
  return Promise.all(
    entries.map(async ({ name }) => {
      const bytes = await readFile(new URL(name, directoryUrl));
      return { name, sql: bytes.toString("utf8"), sha256: sha256Migration(bytes) };
    }),
  );
}

export async function applyMigrations(databaseUrl: string): Promise<void> {
  const migrations = await discoverMigrations();
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    for (const migration of migrations) {
      await sql.begin(async (transaction) => {
        await transaction`CREATE TABLE IF NOT EXISTS jovia_migrations (
          name text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`;
        const applied = await transaction<{ name: string }[]>`
          SELECT name FROM jovia_migrations WHERE name = ${migration.name}
        `;
        const [ledger] = await transaction<{ relation: string | null }[]>`
          SELECT to_regclass('public.jovia_migration_checksums')::text AS relation
        `;
        if (applied.length > 0) {
          if (ledger?.relation) {
            const [checksum] = await transaction<{ sha256: string }[]>`
              SELECT sha256 FROM jovia_migration_checksums WHERE name = ${migration.name}
            `;
            if (checksum)
              assertMigrationChecksum(migration.name, checksum.sha256, migration.sha256);
          }
          return;
        }

        await transaction.unsafe(migration.sql);
        await transaction`INSERT INTO jovia_migrations (name) VALUES (${migration.name})`;
        const [createdLedger] = await transaction<{ relation: string | null }[]>`
          SELECT to_regclass('public.jovia_migration_checksums')::text AS relation
        `;
        if (createdLedger?.relation) {
          await transaction`
            INSERT INTO jovia_migration_checksums (name, sha256)
            VALUES (${migration.name}, ${migration.sha256})
            ON CONFLICT (name) DO NOTHING
          `;
        }
      });
    }

    await sql.begin(async (transaction) => {
      for (const migration of migrations) {
        const [applied] = await transaction<{ name: string }[]>`
          SELECT name FROM jovia_migrations WHERE name = ${migration.name}
        `;
        if (!applied) throw new Error(`migration history missing ${migration.name}`);
        const [checksum] = await transaction<{ sha256: string }[]>`
          SELECT sha256 FROM jovia_migration_checksums WHERE name = ${migration.name}
        `;
        if (!checksum) {
          await transaction`
            INSERT INTO jovia_migration_checksums (name, sha256)
            VALUES (${migration.name}, ${migration.sha256})
          `;
        } else {
          assertMigrationChecksum(migration.name, checksum.sha256, migration.sha256);
        }
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export const applyFoundationMigration = applyMigrations;

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  await applyMigrations(databaseUrl);
  process.stdout.write("All forward-only migrations applied and checksum verified.\n");
}
