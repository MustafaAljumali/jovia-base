import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { authActors } from "./auth.js";
import { sourcePolicyVersions } from "./source-policies.js";
import { sourceRegistry } from "./source-registry.js";

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRegistry.id),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => sourcePolicyVersions.id),
    status: text("status").notNull(),
    startingCheckpoint: jsonb("starting_checkpoint"),
    finalCheckpoint: jsonb("final_checkpoint"),
    pagesCommitted: integer("pages_committed").notNull().default(0),
    recordsCommitted: integer("records_committed").notNull().default(0),
    correlationId: text("correlation_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    supersededBy: uuid("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("ingestion_runs_source_id_started_idx").on(table.sourceId, table.startedAt)],
);

export const rawPayloadReferences = pgTable(
  "raw_payload_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRegistry.id),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => sourcePolicyVersions.id),
    runId: uuid("run_id").references(() => ingestionRuns.id),
    provider: text("provider").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    sha256: text("sha256").notNull(),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    storedAt: timestamp("stored_at", { withTimezone: true, mode: "date" }).notNull(),
    retentionDeadline: timestamp("retention_deadline", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    purgedAt: timestamp("purged_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("raw_payload_references_location_unique").on(
      table.provider,
      table.bucket,
      table.objectKey,
    ),
  ],
);

export const ingestionPages = pgTable(
  "ingestion_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ingestionRuns.id),
    pageSequence: integer("page_sequence").notNull(),
    rawPayloadId: uuid("raw_payload_id")
      .notNull()
      .unique()
      .references(() => rawPayloadReferences.id),
    pageSha256: text("page_sha256").notNull(),
    nextCheckpoint: jsonb("next_checkpoint").notNull(),
    recordCount: integer("record_count").notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("ingestion_pages_run_sequence_unique").on(table.runId, table.pageSequence)],
);

export const connectorCheckpoints = pgTable("connector_checkpoints", {
  sourceId: uuid("source_id")
    .primaryKey()
    .references(() => sourceRegistry.id),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => sourcePolicyVersions.id),
  state: jsonb("state").notNull(),
  lastCommittedPageSha256: text("last_committed_page_sha256"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const connectorLeases = pgTable("connector_leases", {
  sourceId: uuid("source_id")
    .primaryKey()
    .references(() => sourceRegistry.id),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => sourcePolicyVersions.id),
  leaseId: uuid("lease_id").notNull().unique(),
  ownerCorrelationId: text("owner_correlation_id").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true, mode: "date" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true, mode: "date" }),
});

export const quarantineRecords = pgTable("quarantine_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sourceRegistry.id),
  runId: uuid("run_id")
    .notNull()
    .references(() => ingestionRuns.id),
  rawPayloadId: uuid("raw_payload_id")
    .notNull()
    .references(() => rawPayloadReferences.id),
  reason: text("reason").notNull(),
  safeFieldPaths: text("safe_field_paths").array().notNull(),
  connectorVersion: text("connector_version").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  releasedAt: timestamp("released_at", { withTimezone: true, mode: "date" }),
  releasedBy: uuid("released_by").references(() => authActors.id),
  replayedAt: timestamp("replayed_at", { withTimezone: true, mode: "date" }),
});

export const connectorCircuits = pgTable("connector_circuits", {
  sourceId: uuid("source_id")
    .primaryKey()
    .references(() => sourceRegistry.id),
  state: text("state").notNull(),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }),
  halfOpenAfter: timestamp("half_open_after", { withTimezone: true, mode: "date" }),
  version: bigint("version", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const ingestionRunSeen = pgTable(
  "ingestion_run_seen",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => ingestionRuns.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRegistry.id),
    externalId: text("external_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.sourceId, table.externalId] })],
);
