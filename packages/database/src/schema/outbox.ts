import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { opportunities } from "./opportunities.js";

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    payload: jsonb("payload").notNull(),
    correlationId: text("correlation_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    attemptCount: integer("attempt_count").notNull().default(0),
    claimToken: uuid("claim_token"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true, mode: "date" }),
    lastErrorCategory: text("last_error_category"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("outbox_events_event_key_unique").on(table.eventKey),
    index("outbox_events_pending_idx").on(table.availableAt, table.occurredAt, table.id),
  ],
);

export const outboxDispatchAttempts = pgTable(
  "outbox_dispatch_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => outboxEvents.id),
    attemptNumber: integer("attempt_number").notNull(),
    outcome: text("outcome").notNull(),
    errorCategory: text("error_category"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("outbox_dispatch_attempts_event_attempt_unique").on(table.eventId, table.attemptNumber),
  ],
);
