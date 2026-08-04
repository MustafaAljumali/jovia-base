import { describe, expect, it } from "vitest";

import { assertMigrationChecksum, discoverMigrations, sha256Migration } from "./migrate.js";

describe("forward-only migration discovery", () => {
  it("discovers migrations once in lexical order with stable SHA-256", async () => {
    const migrations = await discoverMigrations(new URL("../drizzle/", import.meta.url));
    expect(migrations.map(({ name }) => name)).toEqual([
      "0000_foundation.sql",
      "0001_opportunity_core.sql",
    ]);
    for (const migration of migrations) {
      expect(migration.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(migration.sha256).toBe(sha256Migration(migration.sql));
    }
  });

  it("rejects a changed checksum and accepts an exact applied digest", () => {
    expect(() =>
      assertMigrationChecksum("0001_opportunity_core.sql", "a".repeat(64), "a".repeat(64)),
    ).not.toThrow();
    expect(() =>
      assertMigrationChecksum("0001_opportunity_core.sql", "a".repeat(64), "b".repeat(64)),
    ).toThrow("migration checksum mismatch for 0001_opportunity_core.sql");
  });
});
