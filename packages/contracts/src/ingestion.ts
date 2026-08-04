import { z } from "zod";

import {
  CompensationInputSchema,
  EngagementTypeSchema,
  ExperienceLevelSchema,
  OpportunityLocationSchema,
} from "./opportunities.js";
import { Sha256Schema, SourceCodeSchema } from "./sources.js";

export const HimalayasCheckpointSchema = z
  .object({
    offset: z.number().int().nonnegative(),
    datasetUpdatedAt: z.iso.datetime().optional(),
    lastCommittedPageHash: Sha256Schema.optional(),
  })
  .strict();

export const IngestionCheckpointSchema = z
  .object({
    sourceCode: SourceCodeSchema,
    policyId: z.uuid(),
    state: z.record(z.string(), z.unknown()),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const RawPayloadReferenceSchema = z
  .object({
    provider: z.literal("s3-compatible"),
    bucket: z.string().min(1),
    objectKey: z.string().min(1),
    sha256: Sha256Schema,
    byteLength: z.number().int().nonnegative(),
    storedAt: z.iso.datetime(),
  })
  .strict();

export const SourceOpportunityRecordSchema = z
  .object({
    externalId: z.string().min(1).max(512),
    sourceCode: SourceCodeSchema,
    title: z.string().trim().min(1).max(2_000),
    descriptionHtml: z.string().max(1_000_000),
    employerName: z.string().trim().min(1).max(2_000),
    engagementType: EngagementTypeSchema,
    experienceLevels: z.array(ExperienceLevelSchema),
    categories: z.array(z.string()),
    technologies: z.array(z.string()),
    languages: z.array(z.string()),
    location: OpportunityLocationSchema.extend({
      countryCodes: z.array(z.string()),
    }),
    compensation: CompensationInputSchema.extend({ currency: z.string() }).optional(),
    publishedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
    deadlineAt: z.iso.datetime().optional(),
    originalUrl: z.url(),
    applicationUrl: z.url(),
    extension: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const IngestionRunOutcomeSchema = z.enum([
  "completed",
  "partial",
  "failed",
  "superseded",
  "quarantined",
  "policy_denied",
  "circuit_open",
  "rate_limited",
]);

export const QuarantineRecordSchema = z
  .object({
    id: z.uuid(),
    sourceCode: SourceCodeSchema,
    runId: z.uuid(),
    rawReference: RawPayloadReferenceSchema,
    reason: z.enum(["decode_failed", "schema_invalid", "canonical_invalid", "schema_changed"]),
    safeFieldPaths: z.array(z.string().min(1)).max(100),
    connectorVersion: z.string().min(1),
    correlationId: z.string().min(1),
    createdAt: z.iso.datetime(),
    releasedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const OperationalMetricsSnapshotSchema = z.object({
  sourceCode: SourceCodeSchema,
  freshnessLagSeconds: z.number().nonnegative(),
  tombstoneLagSeconds: z.number().nonnegative(),
  quarantineCount: z.number().int().nonnegative(),
  circuitState: z.enum(["closed", "open", "half_open"]),
  pendingOutboxByType: z.record(z.string(), z.number().int().nonnegative()),
  capturedAt: z.iso.datetime(),
});

export type HimalayasCheckpoint = z.infer<typeof HimalayasCheckpointSchema>;
export type IngestionCheckpoint = z.infer<typeof IngestionCheckpointSchema>;
export type RawPayloadReference = z.infer<typeof RawPayloadReferenceSchema>;
export type SourceOpportunityRecord = z.infer<typeof SourceOpportunityRecordSchema>;
export type QuarantineRecord = z.infer<typeof QuarantineRecordSchema>;
