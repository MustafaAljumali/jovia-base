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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("source_registry_code_unique").on(table.code)],
);
