import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyMigrations, discoverMigrations } from "../../scripts/migrate.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "true";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://jovia:jovia_local@127.0.0.1:5432/jovia";

describe.runIf(enabled)("opportunity core migration", () => {
  const sql = postgres(databaseUrl, { max: 4, prepare: false });

  beforeAll(async () => {
    await applyMigrations(databaseUrl);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("applies every migration twice and records immutable checksums", async () => {
    await applyMigrations(databaseUrl);
    const migrations = await sql<{ name: string; sha256: string }[]>`
      SELECT name, sha256 FROM jovia_migration_checksums ORDER BY name
    `;
    expect(migrations.map(({ name }) => name)).toEqual([
      "0000_foundation.sql",
      "0001_opportunity_core.sql",
    ]);
    expect(migrations.every(({ sha256 }) => /^[a-f0-9]{64}$/u.test(sha256))).toBe(true);
  });

  it("fails closed when an applied file digest no longer matches", async () => {
    const migrations = await discoverMigrations(new URL("../../drizzle/", import.meta.url));
    const opportunityCore = migrations.find(({ name }) => name === "0001_opportunity_core.sql");
    if (!opportunityCore) throw new Error("opportunity core migration fixture is missing");
    try {
      await sql`
        UPDATE jovia_migration_checksums
        SET sha256 = ${"0".repeat(64)}
        WHERE name = '0001_opportunity_core.sql'
      `;
      await expect(applyMigrations(databaseUrl)).rejects.toThrow(
        "migration checksum mismatch for 0001_opportunity_core.sql",
      );
    } finally {
      await sql`
        UPDATE jovia_migration_checksums
        SET sha256 = ${opportunityCore.sha256}
        WHERE name = '0001_opportunity_core.sql'
      `;
    }
  });

  it("creates all required indexed foreign keys and partial indexes", async () => {
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
      ORDER BY 1, 2
    `;
    expect(missingForeignKeyIndexes).toEqual([]);

    const indexes = await sql<{ index_name: string; predicate: string }[]>`
      SELECT c.relname AS index_name, pg_get_expr(i.indpred, i.indrelid) AS predicate
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname IN ('opportunities_active_published_idx', 'outbox_events_pending_idx')
      ORDER BY c.relname
    `;
    expect(indexes).toHaveLength(2);
    expect(
      indexes.find(({ index_name }) => index_name === "opportunities_active_published_idx")
        ?.predicate,
    ).toContain("lifecycle = 'active'");
    expect(
      indexes.find(({ index_name }) => index_name === "outbox_events_pending_idx")?.predicate,
    ).toContain("published_at IS NULL");
  });

  it("seeds exact approved source policies without claiming Himalayas is connected", async () => {
    const sources = await sql<
      { code: string; enabled: boolean; runtime_status: string; active_policy_version: number }[]
    >`
      SELECT s.code, s.enabled, s.runtime_status, p.version AS active_policy_version
      FROM source_registry s
      JOIN source_policy_versions p ON p.id = s.active_policy_id
      WHERE s.code IN ('himalayas', 'jovia-direct')
      ORDER BY s.code
    `;
    expect(sources).toEqual([
      { code: "himalayas", enabled: false, runtime_status: "disabled", active_policy_version: 1 },
      { code: "jovia-direct", enabled: true, runtime_status: "eligible", active_policy_version: 1 },
    ]);
  });
});
