import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { authActors, publisherOrganizations } from "./auth.js";
import { ingestionRuns, rawPayloadReferences } from "./ingestion.js";
import { sourcePolicyVersions } from "./source-policies.js";
import { sourceRegistry } from "./source-registry.js";

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publisherOrganizationId: uuid("publisher_organization_id").references(
      () => publisherOrganizations.id,
    ),
    lifecycle: text("lifecycle").notNull(),
    title: text("title").notNull(),
    descriptionHtml: text("description_html").notNull(),
    descriptionText: text("description_text").notNull(),
    employerName: text("employer_name").notNull(),
    employerKey: text("employer_key").notNull(),
    engagementType: text("engagement_type").notNull(),
    experienceLevels: text("experience_levels").array().notNull(),
    categories: text("categories").array().notNull(),
    technologies: text("technologies").array().notNull(),
    languages: text("languages").array().notNull(),
    locationRaw: text("location_raw"),
    countryCodes: text("country_codes").array().notNull(),
    timezoneRestrictions: text("timezone_restrictions").array().notNull(),
    remote: boolean("remote").notNull(),
    compensationKind: text("compensation_kind"),
    compensationMinimum: numeric("compensation_minimum"),
    compensationMaximum: numeric("compensation_maximum"),
    compensationCurrency: text("compensation_currency"),
    compensationSourcePeriod: text("compensation_source_period"),
    compensationAnnualMinimum: numeric("compensation_annual_minimum"),
    compensationAnnualMaximum: numeric("compensation_annual_maximum"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }).notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true, mode: "date" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
    normalizedAt: timestamp("normalized_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    originalUrl: text("original_url").notNull(),
    applicationUrl: text("application_url").notNull(),
    contentSignature: text("content_signature").notNull(),
    canonicalOpportunityId: uuid("canonical_opportunity_id"),
    deduplicationStrategy: text("deduplication_strategy").notNull().default("deterministic"),
    deletionState: text("deletion_state").notNull().default("present"),
    tombstoneReason: text("tombstone_reason"),
    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true, mode: "date" }),
    purgeEligibleAt: timestamp("purge_eligible_at", { withTimezone: true, mode: "date" }),
    purgedAt: timestamp("purged_at", { withTimezone: true, mode: "date" }),
    extension: jsonb("extension").notNull().default({}),
  },
  (table) => [
    index("opportunities_signature_published_idx").on(
      table.contentSignature,
      table.publishedAt,
      table.id,
    ),
  ],
);

export const opportunityProvenance = pgTable(
  "opportunity_provenance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRegistry.id),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => sourcePolicyVersions.id),
    externalId: text("external_id").notNull(),
    originalUrl: text("original_url").notNull(),
    rawPayloadId: uuid("raw_payload_id")
      .notNull()
      .references(() => rawPayloadReferences.id),
    rawSha256: text("raw_sha256").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull(),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true, mode: "date" }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
    ingestionRunId: uuid("ingestion_run_id")
      .notNull()
      .references(() => ingestionRuns.id),
    connectorVersion: text("connector_version").notNull(),
    mapperVersion: text("mapper_version").notNull(),
    normalizationVersion: text("normalization_version").notNull(),
    deletionState: text("deletion_state").notNull().default("present"),
    tombstoneReason: text("tombstone_reason"),
    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true, mode: "date" }),
    purgeEligibleAt: timestamp("purge_eligible_at", { withTimezone: true, mode: "date" }),
    purgedAt: timestamp("purged_at", { withTimezone: true, mode: "date" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("opportunity_provenance_source_external_unique").on(table.sourceId, table.externalId),
  ],
);

export const opportunityAudits = pgTable("opportunity_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  action: text("action").notNull(),
  actorId: uuid("actor_id").references(() => authActors.id),
  sourceId: uuid("source_id").references(() => sourceRegistry.id),
  correlationId: text("correlation_id").notNull(),
  reason: text("reason").notNull(),
  priorStateSha256: text("prior_state_sha256"),
  resultingStateSha256: text("resulting_state_sha256").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const opportunityIdempotency = pgTable(
  "opportunity_idempotency",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authActors.id),
    publisherOrganizationId: uuid("publisher_organization_id")
      .notNull()
      .references(() => publisherOrganizations.id),
    idempotencyKey: text("idempotency_key").notNull(),
    requestSha256: text("request_sha256").notNull(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    responseStatus: numeric("response_status", { mode: "number" }),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("opportunity_idempotency_actor_key_unique").on(table.actorId, table.idempotencyKey),
  ],
);

export const opportunityDuplicateLinks = pgTable(
  "opportunity_duplicate_links",
  {
    canonicalOpportunityId: uuid("canonical_opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    duplicateOpportunityId: uuid("duplicate_opportunity_id")
      .notNull()
      .unique()
      .references(() => opportunities.id),
    strategy: text("strategy").notNull(),
    contentSignature: text("content_signature").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.canonicalOpportunityId, table.duplicateOpportunityId] }),
  ],
);
