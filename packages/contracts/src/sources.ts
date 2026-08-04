import { z } from "zod";

export const SourceCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/u);
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const SourceScopeSchema = z.enum(["external", "first_party"]);
export const SourceMechanismSchema = z.enum([
  "official_api",
  "licensed_feed",
  "approved_partnership",
  "rss",
  "user_authorized_import",
  "manual_submission",
  "unsupported",
]);
export const LegalPostureSchema = z.enum(["approved", "conditional", "blocked", "unreviewed"]);
export const SourceRuntimeStatusSchema = z.enum([
  "disabled",
  "eligible",
  "polling",
  "rate_limited",
  "stale",
  "quarantined",
  "circuit_open",
]);
export const CircuitStateSchema = z.enum(["closed", "open", "half_open"]);

export const AttributionPolicySchema = z
  .object({
    required: z.boolean(),
    displayText: z.string().trim().min(1).max(240),
    sourceUrl: z.url(),
    originalLinkRequired: z.boolean(),
    logoPolicy: z.enum(["text_only", "approved_logo"]),
  })
  .strict();

export const OfficialRequestLimitSchema = z
  .object({ requests: z.number().int().positive(), windowSeconds: z.number().int().positive() })
  .strict();

export const PollingPolicySchema = z
  .object({
    pollingFloorSeconds: z.number().int().positive(),
    maximumConcurrency: z.number().int().positive(),
    minimumRequestSpacingMs: z.number().int().nonnegative(),
    honorRetryAfter: z.boolean(),
    retryAfterDefaultSeconds: z.number().int().positive(),
    officialRequestLimit: OfficialRequestLimitSchema.nullable(),
  })
  .strict();

export const RetentionPolicySchema = z
  .object({
    servingTtlSeconds: z.number().int().nonnegative(),
    inactiveRetentionDays: z.number().int().nonnegative(),
    rawPayloadRetentionDays: z.number().int().nonnegative(),
    tombstoneSlaSeconds: z.number().int().nonnegative(),
  })
  .strict();

export const RedistributionPolicySchema = z.enum([
  "prohibited",
  "first_party_only",
  "attribution_permitted",
  "licensed",
]);

export const ContentModificationPolicySchema = z
  .object({
    allowedFields: z.array(
      z.enum([
        "description_sanitization",
        "compensation_normalization",
        "location_normalization",
        "language_normalization",
        "taxonomy_mapping",
      ]),
    ),
    translationAllowed: z.boolean(),
  })
  .strict();

export const SourceRegistrationSchema = z.object({
  code: SourceCodeSchema,
  name: z.string().min(1),
  mechanism: SourceMechanismSchema,
  legalPosture: LegalPostureSchema,
  termsUrl: z.url(),
  attributionRule: z.string().min(1),
  pollingFloorSeconds: z.number().int().positive(),
  cacheTtlSeconds: z.number().int().nonnegative(),
  redistributionRule: z.string().min(1),
  owner: z.string().min(1),
  lastVerifiedAt: z.iso.datetime(),
  enabled: z.boolean().default(false),
});

export const SourceIdentitySchema = z
  .object({
    id: z.uuid(),
    code: SourceCodeSchema,
    name: z.string().trim().min(1).max(160),
    scope: SourceScopeSchema,
    enabled: z.boolean(),
    runtimeStatus: SourceRuntimeStatusSchema,
    activePolicyId: z.uuid().nullable(),
    nextPollAt: z.iso.datetime().nullable(),
    quarantinedAt: z.iso.datetime().nullable(),
    lastSuccessfulRunAt: z.iso.datetime().nullable(),
  })
  .strict();

export const SourcePolicyVersionSchema = z
  .object({
    id: z.uuid(),
    sourceCode: SourceCodeSchema,
    version: z.number().int().positive(),
    scope: SourceScopeSchema,
    mechanism: SourceMechanismSchema,
    legalPosture: LegalPostureSchema,
    termsUrl: z.url(),
    termsSnapshotRef: z.string().trim().min(1),
    termsSnapshotSha256: Sha256Schema,
    attribution: AttributionPolicySchema,
    polling: PollingPolicySchema,
    retention: RetentionPolicySchema,
    redistribution: RedistributionPolicySchema,
    contentModification: ContentModificationPolicySchema,
    owner: z.string().trim().min(1),
    verifiedAt: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    approvedBy: z.string().trim().min(1),
    approvedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const SourceExecutionContextSchema = z
  .object({
    source: SourceIdentitySchema,
    policy: SourcePolicyVersionSchema,
    circuit: z
      .object({
        state: CircuitStateSchema,
        consecutiveFailures: z.number().int().nonnegative(),
        openedAt: z.iso.datetime().nullable(),
        halfOpenAfter: z.iso.datetime().nullable(),
      })
      .strict(),
  })
  .strict();

export const SourceOperationSchema = z.enum(["poll", "publish", "replace", "remove"]);
export const SourceIneligibilityReasonSchema = z.enum([
  "source_missing",
  "disabled",
  "unsupported",
  "not_approved",
  "policy_incomplete",
  "approval_missing",
  "verification_in_future",
  "policy_expired",
  "source_policy_mismatch",
  "mechanism_not_permitted",
  "quarantined",
  "circuit_open",
  "poll_not_due",
]);

export const SourceEligibilityDecisionSchema = z.discriminatedUnion("eligible", [
  z
    .object({ eligible: z.literal(true), sourceCode: SourceCodeSchema, policyId: z.uuid() })
    .strict(),
  z
    .object({
      eligible: z.literal(false),
      sourceCode: SourceCodeSchema,
      reason: SourceIneligibilityReasonSchema,
    })
    .strict(),
]);

export type SourceRegistration = z.infer<typeof SourceRegistrationSchema>;
export type SourceIdentity = z.infer<typeof SourceIdentitySchema>;
export type SourcePolicyVersion = z.infer<typeof SourcePolicyVersionSchema>;
export type SourceExecutionContext = z.infer<typeof SourceExecutionContextSchema>;
export type SourceOperation = z.infer<typeof SourceOperationSchema>;
export type SourceEligibilityDecision = z.infer<typeof SourceEligibilityDecisionSchema>;
