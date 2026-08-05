import { createHash } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { RawPayloadStore, RawPayloadWrite } from "@jovia/opportunity-ingestion";

type RawPayloadReference = Parameters<RawPayloadStore["delete"]>[0];

export interface S3ClientPort {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
}

export interface RawPayloadStorageConfigInput {
  environment: "development" | "test" | "production";
  bucket?: string;
  region?: string;
  endpoint?: string;
  approvedEndpointHosts?: readonly string[];
  credentialProviderAvailable?: boolean;
}

export interface RawPayloadStorageConfig {
  environment: RawPayloadStorageConfigInput["environment"];
  bucket: string;
  region: string;
  endpoint?: string;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required for durable raw payload storage`);
  return normalized;
}

export function validateRawPayloadStorageConfig(
  input: RawPayloadStorageConfigInput,
): RawPayloadStorageConfig {
  const bucket = required(input.bucket, "RAW_PAYLOAD_BUCKET");
  const region = required(input.region, "RAW_PAYLOAD_REGION");
  if (!/^(?!\d{1,3}(?:\.\d{1,3}){3}$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket)) {
    throw new Error("RAW_PAYLOAD_BUCKET must be a valid private S3 bucket name");
  }
  let endpoint: string | undefined;
  if (input.endpoint) {
    const parsed = new URL(input.endpoint);
    if (parsed.protocol !== "https:") {
      throw new Error("raw payload storage requires an approved HTTPS endpoint");
    }
    const approved = new Set(input.approvedEndpointHosts ?? []);
    if (input.environment === "production" && !approved.has(parsed.hostname)) {
      throw new Error("raw payload storage endpoint host is not approved");
    }
    endpoint = parsed.origin;
  }
  if (input.environment === "production" && input.credentialProviderAvailable !== true) {
    throw new Error("a resolvable production credential provider is required");
  }
  return { environment: input.environment, bucket, region, ...(endpoint ? { endpoint } : {}) };
}

function segment(value: string): string {
  const normalized = value.toLocaleLowerCase("en").replace(/[^a-z0-9._-]+/gu, "-");
  const trimmed = normalized.replace(/^-+|-+$/gu, "");
  if (!trimmed) throw new Error("raw payload object key segment is empty");
  return trimmed.slice(0, 128);
}

function extension(contentType: string): string {
  return contentType.toLocaleLowerCase("en").includes("json") ? "json" : "bin";
}

export class S3RawPayloadStore implements RawPayloadStore {
  constructor(
    private readonly client: S3ClientPort,
    private readonly config: RawPayloadStorageConfig,
    private readonly clock: { now(): Date },
  ) {}

  async put(input: RawPayloadWrite): Promise<RawPayloadReference> {
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const fetchedAt = new Date(input.fetchedAt);
    if (!Number.isFinite(fetchedAt.getTime()))
      throw new Error("fetchedAt must be a valid timestamp");
    const year = fetchedAt.getUTCFullYear().toString().padStart(4, "0");
    const month = (fetchedAt.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = fetchedAt.getUTCDate().toString().padStart(2, "0");
    const page = input.pageSequence.toString().padStart(6, "0");
    const objectKey = [
      segment(input.sourceCode),
      year,
      month,
      day,
      segment(input.runId),
      `page-${page}-${sha256}.${extension(input.contentType)}`,
    ].join("/");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: input.bytes,
        ContentType: input.contentType,
        ServerSideEncryption: "AES256",
        CacheControl: "private, no-store",
        Metadata: { sha256 },
      }),
    );
    return {
      provider: "s3-compatible",
      bucket: this.config.bucket,
      objectKey,
      sha256,
      byteLength: input.bytes.byteLength,
      contentType: input.contentType,
      storedAt: this.clock.now().toISOString(),
    };
  }

  async delete(reference: RawPayloadReference): Promise<void> {
    if (reference.provider !== "s3-compatible" || reference.bucket !== this.config.bucket) {
      throw new Error("raw payload reference does not belong to the configured private bucket");
    }
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: reference.objectKey }),
    );
  }
}
