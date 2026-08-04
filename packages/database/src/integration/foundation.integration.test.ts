import { SourceRegistrationSchema } from "@jovia/contracts";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyFoundationMigration } from "../../scripts/migrate.js";
import { createDatabase } from "../client.js";
import { SourceRegistryRepository } from "../repositories/source-registry.js";

const enabled = process.env.RUN_INTEGRATION_TESTS === "true";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://jovia:jovia_local@127.0.0.1:5432/jovia";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

describe.runIf(enabled)("foundation infrastructure", () => {
  const database = createDatabase(databaseUrl);
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

  beforeAll(async () => {
    await applyFoundationMigration(databaseUrl);
    await redis.connect();
  });

  afterAll(async () => {
    redis.disconnect();
    await database.close();
  });

  it("enables pgvector, persists a disabled source, and reaches Redis", async () => {
    const extensions = await database.sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    expect(extensions).toEqual([{ extname: "vector" }]);

    const repository = new SourceRegistryRepository(database.db);
    const source = SourceRegistrationSchema.parse({
      code: "himalayas",
      name: "Himalayas",
      mechanism: "official_api",
      legalPosture: "approved",
      termsUrl: "https://himalayas.app/terms",
      attributionRule: "Link to source",
      pollingFloorSeconds: 300,
      cacheTtlSeconds: 300,
      redistributionRule: "Metadata only",
      owner: "Product Operations",
      lastVerifiedAt: "2026-08-04T00:00:00.000Z",
    });
    await repository.save(source);
    expect(await repository.findByCode("himalayas")).toMatchObject({ enabled: false });
    expect(await redis.ping()).toBe("PONG");
  });
});
