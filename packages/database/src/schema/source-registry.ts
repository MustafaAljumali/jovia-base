import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const sourceRegistry = pgTable(
  "source_registry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    mechanism: text("mechanism").notNull(),
    legalPosture: text("legal_posture").notNull(),
    termsUrl: text("terms_url").notNull(),
    attributionRule: text("attribution_rule").notNull(),
    pollingFloorSeconds: integer("polling_floor_seconds").notNull(),
    cacheTtlSeconds: integer("cache_ttl_seconds").notNull(),
    redistributionRule: text("redistribution_rule").notNull(),
    owner: text("owner").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    scope: text("scope").notNull().default("external"),
    runtimeStatus: text("runtime_status").notNull().default("disabled"),
    activePolicyId: uuid("active_policy_id"),
    killSwitch: boolean("kill_switch").notNull().default(false),
    nextPollAt: timestamp("next_poll_at", { withTimezone: true, mode: "date" }),
    quarantinedAt: timestamp("quarantined_at", { withTimezone: true, mode: "date" }),
    lastSuccessfulRunAt: timestamp("last_successful_run_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("source_registry_code_unique").on(table.code)],
);
