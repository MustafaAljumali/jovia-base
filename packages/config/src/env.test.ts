import { describe, expect, it } from "vitest";

import { loadApiConfig, loadWorkerConfig, toRedactedConfig } from "./env.js";

const workerBase = {
  DATABASE_URL: "postgresql://jovia:jovia_local@127.0.0.1:5432/jovia",
  REDIS_URL: "redis://127.0.0.1:6379",
};

describe("environment configuration", () => {
  it("requires a Gemini key and pinned model when Gemini is enabled", () => {
    expect(() =>
      loadWorkerConfig({ ...workerBase, NODE_ENV: "production", AI_GEMINI_ENABLED: "true" }),
    ).toThrow(/AI_GEMINI_API_KEY/u);
    expect(() =>
      loadWorkerConfig({
        ...workerBase,
        AI_GEMINI_ENABLED: "true",
        AI_GEMINI_API_KEY: "a-secure-placeholder-key",
        AI_GEMINI_MODEL: "gemini-latest",
      }),
    ).toThrow(/AI_GEMINI_MODEL/u);
  });

  it("loads safe defaults and never returns secret values in a redacted view", () => {
    const config = loadWorkerConfig({
      ...workerBase,
      AI_GEMINI_ENABLED: "true",
      AI_GEMINI_API_KEY: "a-secure-placeholder-key",
      AI_GEMINI_MODEL: "gemini-3.6-flash",
    });
    expect(toRedactedConfig(config)).toMatchObject({
      databaseUrl: "[CONFIGURED]",
      gemini: { enabled: true, hasApiKey: true, model: "gemini-3.6-flash" },
      redisUrl: "[CONFIGURED]",
    });
    expect(JSON.stringify(toRedactedConfig(config))).not.toContain("a-secure-placeholder-key");
  });

  it("validates API ports", () => {
    expect(loadApiConfig({ API_PORT: "3100" }).port).toBe(3100);
    expect(() => loadApiConfig({ API_PORT: "70000" })).toThrow(/API_PORT/u);
  });

  it("requires database, Redis and durable raw storage for the production API", () => {
    expect(() => loadApiConfig({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/u);
    expect(
      loadApiConfig({
        NODE_ENV: "production",
        ...workerBase,
        RAW_PAYLOAD_BUCKET: "jovia-raw-production",
        RAW_PAYLOAD_REGION: "eu-central-1",
      }),
    ).toMatchObject({
      databaseUrl: workerBase.DATABASE_URL,
      redisUrl: workerBase.REDIS_URL,
      rawPayload: { bucket: "jovia-raw-production", region: "eu-central-1" },
    });
  });
});
