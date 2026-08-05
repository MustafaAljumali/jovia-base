import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const publisherOrganizations = pgTable("publisher_organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  publishingTermsVersion: text("publishing_terms_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const authActors = pgTable("auth_actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const authActorCapabilities = pgTable(
  "auth_actor_capabilities",
  {
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authActors.id),
    capability: text("capability").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.actorId, table.capability] })],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authActors.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => publisherOrganizations.id),
    role: text("role").notNull(),
    acceptedPublishingTermsVersion: text("accepted_publishing_terms_version"),
    acceptedPublishingTermsAt: timestamp("accepted_publishing_terms_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.actorId, table.organizationId] }),
    index("organization_memberships_organization_id_idx").on(table.organizationId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authActors.id),
    opaqueTokenSha256: text("opaque_token_sha256").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("auth_sessions_actor_id_idx").on(table.actorId)],
);
