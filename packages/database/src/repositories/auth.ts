import { createHash } from "node:crypto";

import { AppError } from "@jovia/contracts";
import type { Actor, Authenticator, Capability } from "@jovia/auth";
import type { PublishingOwnershipPort } from "@jovia/opportunity-ingestion";
import type postgres from "postgres";

const CAPABILITIES = new Set<Capability>([
  "profile:read",
  "profile:write",
  "source:read",
  "source:enable",
  "opportunity:read",
  "opportunity:publish",
  "proposal:generate",
  "admin:operate",
]);

interface AuthRow {
  actor_id: string;
  capability: string | null;
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class PostgresAuthenticator implements Authenticator {
  constructor(
    private readonly sql: postgres.Sql,
    private readonly clock: { now(): Date },
  ) {}

  async authenticate(opaqueToken: string): Promise<Actor | undefined> {
    if (opaqueToken.length < 32 || opaqueToken.length > 4096) return undefined;
    const rows = await this.sql<AuthRow[]>`
      SELECT s.actor_id, c.capability
      FROM auth_sessions s
      JOIN auth_actors a ON a.id = s.actor_id
      LEFT JOIN auth_actor_capabilities c ON c.actor_id = s.actor_id
      WHERE s.opaque_token_sha256 = ${tokenDigest(opaqueToken)}
        AND s.revoked_at IS NULL AND s.expires_at > ${this.clock.now()}
        AND a.status = 'active'
    `;
    const actorId = rows[0]?.actor_id;
    if (!actorId) return undefined;
    const capabilities = new Set<Capability>();
    for (const row of rows) {
      if (row.capability && CAPABILITIES.has(row.capability as Capability)) {
        capabilities.add(row.capability as Capability);
      }
    }
    return { id: actorId, capabilities, externalSubjects: [] };
  }
}

export class PostgresPublishingOwnershipRepository implements PublishingOwnershipPort {
  constructor(private readonly sql: postgres.Sql) {}

  async requirePublisherMembership(
    actorId: string,
    organizationId: string,
    publishingTermsVersion: string,
  ): Promise<void> {
    const [membership] = await this.sql<{ allowed: boolean }[]>`
      SELECT true AS allowed
      FROM organization_memberships m
      JOIN publisher_organizations o ON o.id = m.organization_id
      WHERE m.actor_id = ${actorId} AND m.organization_id = ${organizationId}
        AND m.role IN ('owner', 'publisher', 'administrator')
        AND m.accepted_publishing_terms_version = ${publishingTermsVersion}
        AND o.publishing_terms_version = ${publishingTermsVersion}
        AND o.status = 'active'
      LIMIT 1
    `;
    if (!membership) {
      throw new AppError({
        code: "organization_scope_denied",
        status: 403,
        title: "Publisher organization access or terms acceptance is missing",
      });
    }
  }
}
