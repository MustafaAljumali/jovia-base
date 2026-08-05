import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { sourceRegistry } from "./source-registry.js";

export const sourcePolicyVersions = pgTable(
  "source_policy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRegistry.id),
    sourceCode: text("source_code").notNull(),
    version: integer("version").notNull(),
    scope: text("scope").notNull(),
    mechanism: text("mechanism").notNull(),
    legalPosture: text("legal_posture").notNull(),
    termsUrl: text("terms_url").notNull(),
    termsSnapshotRef: text("terms_snapshot_ref").notNull(),
    termsSnapshotSha256: text("terms_snapshot_sha256").notNull(),
    attributionRequired: boolean("attribution_required").notNull(),
    attributionText: text("attribution_text").notNull(),
    attributionSourceUrl: text("attribution_source_url").notNull(),
    originalLinkRequired: boolean("original_link_required").notNull(),
    logoPolicy: text("logo_policy").notNull(),
    pollingFloorSeconds: integer("polling_floor_seconds").notNull(),
    maximumConcurrency: integer("maximum_concurrency").notNull(),
    minimumRequestSpacingMs: integer("minimum_request_spacing_ms").notNull(),
    officialLimitRequests: integer("official_limit_requests"),
    officialLimitWindowSeconds: integer("official_limit_window_seconds"),
    honorRetryAfter: boolean("honor_retry_after").notNull(),
    retryAfterDefaultSeconds: integer("retry_after_default_seconds").notNull(),
    servingTtlSeconds: integer("serving_ttl_seconds").notNull(),
    inactiveRetentionDays: integer("inactive_retention_days").notNull(),
    rawPayloadRetentionDays: integer("raw_payload_retention_days").notNull(),
    tombstoneSlaSeconds: integer("tombstone_sla_seconds").notNull(),
    redistribution: text("redistribution").notNull(),
    contentModification: jsonb("content_modification").notNull(),
    owner: text("owner").notNull(),
    reliabilityScore: smallint("reliability_score").notNull().default(50),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }).notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("source_policy_versions_source_version_unique").on(table.sourceId, table.version),
    unique("source_policy_versions_code_version_unique").on(table.sourceCode, table.version),
    index("source_policy_versions_source_id_idx").on(table.sourceId),
  ],
);

export const sourcePolicyApprovals = pgTable("source_policy_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  policyId: uuid("policy_id")
    .notNull()
    .unique()
    .references(() => sourcePolicyVersions.id),
  approvedBy: text("approved_by").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }).notNull(),
  governanceNote: text("governance_note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const sourceAudits = pgTable(
  "source_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").references(() => sourceRegistry.id),
    policyId: uuid("policy_id").references(() => sourcePolicyVersions.id),
    operation: text("operation").notNull(),
    eligible: boolean("eligible"),
    reason: text("reason"),
    actorId: uuid("actor_id"),
    correlationId: text("correlation_id").notNull(),
    details: jsonb("details").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("source_audits_occurred_at_idx").on(table.occurredAt)],
);
