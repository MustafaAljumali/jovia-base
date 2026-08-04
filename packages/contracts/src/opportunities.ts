import { z } from "zod";

import { Sha256Schema, SourceCodeSchema } from "./sources.js";

export const DecimalStringSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/u);
export const IsoCurrencySchema = z.string().regex(/^[A-Z]{3}$/u);
export const IsoLanguageSchema = z.string().regex(/^[a-z]{2}$/u);
export const IsoCountrySchema = z.string().regex(/^[A-Z]{2}$/u);
export const OpportunityLifecycleSchema = z.enum([
  "draft",
  "active",
  "expired",
  "filled",
  "removed",
]);
export const DeletionStateSchema = z.enum(["present", "tombstoned", "purged"]);
export const EngagementTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
  "freelance",
  "project",
  "unknown",
]);
export const ExperienceLevelSchema = z.enum([
  "intern",
  "entry",
  "mid",
  "senior",
  "lead",
  "executive",
  "unknown",
]);
export const CompensationPeriodSchema = z.enum([
  "hourly",
  "daily",
  "weekly",
  "fortnightly",
  "monthly",
  "annual",
  "project",
]);

export const CompensationInputSchema = z
  .object({
    kind: CompensationPeriodSchema,
    minimum: DecimalStringSchema.optional(),
    maximum: DecimalStringSchema.optional(),
    currency: IsoCurrencySchema,
  })
  .strict()
  .refine((value) => value.minimum !== undefined || value.maximum !== undefined, {
    message: "at least one compensation bound is required",
  });

export const CompensationSchema = z
  .object({
    kind: CompensationPeriodSchema,
    minimum: DecimalStringSchema.optional(),
    maximum: DecimalStringSchema.optional(),
    currency: IsoCurrencySchema,
    sourcePeriod: CompensationPeriodSchema,
    annualizedMinimum: DecimalStringSchema.optional(),
    annualizedMaximum: DecimalStringSchema.optional(),
  })
  .strict();

export const OpportunityLocationSchema = z
  .object({
    remote: z.boolean(),
    raw: z.string().max(2_000).optional(),
    countryCodes: z.array(IsoCountrySchema).max(249),
    timezoneRestrictions: z.array(z.string().trim().min(1).max(120)).max(64),
  })
  .strict();

export const OpportunityAttributionSchema = z
  .object({
    source: SourceCodeSchema,
    sourceName: z.string().trim().min(1).max(160),
    attributionText: z.string().trim().min(1).max(240),
    sourceUrl: z.url(),
    originalUrl: z.url(),
  })
  .strict();

export const DirectOpportunityCommandSchema = z
  .object({
    publisherOrganizationId: z.uuid(),
    publishingTermsVersion: z.string().trim().min(1).max(120),
    title: z.string().trim().min(3).max(240),
    descriptionHtml: z.string().min(1).max(100_000),
    employerName: z.string().trim().min(1).max(240),
    engagementType: EngagementTypeSchema,
    experienceLevels: z.array(ExperienceLevelSchema).max(8),
    categories: z.array(z.string().trim().min(1).max(80)).max(32),
    technologies: z.array(z.string().trim().min(1).max(80)).max(64),
    languages: z.array(IsoLanguageSchema).max(32),
    location: OpportunityLocationSchema,
    compensation: CompensationInputSchema.optional(),
    publishedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().optional(),
    applicationUrl: z.url(),
    extension: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const OpportunityProvenanceSchema = z.object({
  id: z.uuid(),
  sourceCode: SourceCodeSchema,
  sourcePolicyId: z.uuid(),
  externalId: z.string().min(1).max(512),
  originalUrl: z.url(),
  rawObjectKey: z.string().min(1),
  rawSha256: Sha256Schema,
  fetchedAt: z.iso.datetime(),
  sourcePublishedAt: z.iso.datetime().nullable(),
  sourceUpdatedAt: z.iso.datetime().nullable(),
  ingestionRunId: z.uuid(),
  connectorVersion: z.string().min(1),
  mapperVersion: z.string().min(1),
  normalizationVersion: z.string().min(1),
  deletionState: DeletionStateSchema,
  tombstonedAt: z.iso.datetime().nullable(),
  purgedAt: z.iso.datetime().nullable(),
});

export const CanonicalOpportunitySchema = z.object({
  id: z.uuid(),
  publisherOrganizationId: z.uuid().nullable(),
  lifecycle: OpportunityLifecycleSchema,
  title: z.string().min(1),
  descriptionHtml: z.string(),
  descriptionText: z.string(),
  employerName: z.string().min(1),
  employerKey: z.string().min(1),
  engagementType: EngagementTypeSchema,
  experienceLevels: z.array(ExperienceLevelSchema),
  categories: z.array(z.string()),
  technologies: z.array(z.string()),
  languages: z.array(IsoLanguageSchema),
  location: OpportunityLocationSchema,
  compensation: CompensationSchema.nullable(),
  publishedAt: z.iso.datetime(),
  sourceUpdatedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  deadlineAt: z.iso.datetime().nullable(),
  firstSeenAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  normalizedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  originalUrl: z.url(),
  applicationUrl: z.url(),
  contentSignature: Sha256Schema,
  canonicalOpportunityId: z.uuid(),
  deduplicationStrategy: z.enum(["deterministic", "semantic"]),
  deletionState: DeletionStateSchema,
  tombstoneReason: z.string().nullable(),
  tombstonedAt: z.iso.datetime().nullable(),
  purgeEligibleAt: z.iso.datetime().nullable(),
  purgedAt: z.iso.datetime().nullable(),
  extension: z.record(z.string(), z.unknown()),
  attribution: OpportunityAttributionSchema,
  provenance: z.array(OpportunityProvenanceSchema),
});

export const OpportunityListQuerySchema = z
  .object({
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const OpportunityListResponseSchema = z.object({
  items: z.array(CanonicalOpportunitySchema),
  nextCursor: z.string().nullable(),
});

export const IdempotencyKeySchema = z.string().trim().min(8).max(200);

export type Compensation = z.infer<typeof CompensationSchema>;
export type CompensationInput = z.infer<typeof CompensationInputSchema>;
export type DirectOpportunityCommand = z.infer<typeof DirectOpportunityCommandSchema>;
export type CanonicalOpportunity = z.infer<typeof CanonicalOpportunitySchema>;
export type OpportunityListQuery = z.infer<typeof OpportunityListQuerySchema>;
