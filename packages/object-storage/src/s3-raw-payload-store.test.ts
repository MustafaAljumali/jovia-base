import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  S3RawPayloadStore,
  validateRawPayloadStorageConfig,
  type S3ClientPort,
} from "./s3-raw-payload-store.js";

function harness() {
  const commands: (PutObjectCommand | DeleteObjectCommand)[] = [];
  const client: S3ClientPort = {
    send: vi.fn(async (command) => {
      commands.push(command);
      return {};
    }),
  };
  const config = validateRawPayloadStorageConfig({
    environment: "test",
    bucket: "jovia-raw-test",
    region: "eu-central-1",
    credentialProviderAvailable: true,
  });
  return {
    commands,
    store: new S3RawPayloadStore(client, config, {
      now: () => new Date("2026-08-05T01:00:01.000Z"),
    }),
  };
}

describe("S3RawPayloadStore", () => {
  it("writes private encrypted bytes with a deterministic key and digest metadata", async () => {
    const { commands, store } = harness();
    const bytes = new TextEncoder().encode('{"jobs":[]}');
    const result = await store.put({
      sourceCode: "himalayas",
      runId: "00000000-0000-4000-8000-000000000001",
      pageSequence: 0,
      fetchedAt: "2026-08-05T01:00:00.000Z",
      contentType: "application/json",
      bytes,
    });
    const command = commands[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command?.input).toMatchObject({
      Bucket: "jovia-raw-test",
      Key: expect.stringMatching(
        /^himalayas\/2026\/08\/05\/00000000-0000-4000-8000-000000000001\/page-000000-[a-f0-9]{64}\.json$/u,
      ),
      ServerSideEncryption: "AES256",
      ContentType: "application/json",
      CacheControl: "private, no-store",
      Metadata: { sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
    });
    expect(result).toMatchObject({
      provider: "s3-compatible",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      byteLength: bytes.byteLength,
      contentType: "application/json",
    });
  });

  it("deletes only references from the configured private bucket", async () => {
    const { commands, store } = harness();
    await store.delete({
      provider: "s3-compatible",
      bucket: "jovia-raw-test",
      objectKey: "himalayas/raw.json",
      sha256: "a".repeat(64),
      byteLength: 10,
      contentType: "application/json",
      storedAt: "2026-08-05T00:00:00.000Z",
    });
    expect(commands[0]).toBeInstanceOf(DeleteObjectCommand);
    await expect(
      store.delete({
        provider: "s3-compatible",
        bucket: "another-bucket",
        objectKey: "private/raw.json",
        sha256: "a".repeat(64),
        byteLength: 10,
        storedAt: "2026-08-05T00:00:00.000Z",
      }),
    ).rejects.toThrow("does not belong");
  });

  it("fails closed for non-HTTPS, unapproved or credential-less production configuration", () => {
    expect(() =>
      validateRawPayloadStorageConfig({
        environment: "production",
        bucket: "jovia-raw-production",
        region: "eu-central-1",
        endpoint: "http://s3.internal",
        credentialProviderAvailable: true,
      }),
    ).toThrow("approved HTTPS endpoint");
    expect(() =>
      validateRawPayloadStorageConfig({
        environment: "production",
        bucket: "jovia-raw-production",
        region: "eu-central-1",
        endpoint: "https://unapproved.example",
        approvedEndpointHosts: ["s3.jovia.dev"],
        credentialProviderAvailable: true,
      }),
    ).toThrow("host is not approved");
    expect(() =>
      validateRawPayloadStorageConfig({
        environment: "production",
        bucket: "jovia-raw-production",
        region: "eu-central-1",
      }),
    ).toThrow("credential provider");
  });
});
