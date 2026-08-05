import { AppError, OpportunityEventSchema } from "@jovia/contracts";
import type { ClaimedOutboxEvent, OutboxDispatchPort } from "@jovia/opportunity-ingestion";
import type postgres from "postgres";

interface ClaimedRow {
  id: string;
  claim_token: string;
  attempt_count: number;
  payload: unknown;
}

function assertClaimUpdated(rows: readonly unknown[]): void {
  if (rows.length === 0) {
    throw new AppError({
      code: "outbox_claim_lost",
      status: 409,
      title: "Outbox claim is no longer owned by this dispatcher",
    });
  }
}

export class PostgresOutboxRepository implements OutboxDispatchPort {
  constructor(
    private readonly sql: postgres.Sql,
    private readonly claimTtlMs = 300_000,
  ) {}

  async claim(limit: number, claimedAt: Date): Promise<readonly ClaimedOutboxEvent[]> {
    const claimExpiresAt = new Date(claimedAt.getTime() + this.claimTtlMs);
    const rows = await this.sql<ClaimedRow[]>`
      WITH candidates AS (
        SELECT id
        FROM outbox_events
        WHERE published_at IS NULL AND dead_lettered_at IS NULL
          AND available_at <= ${claimedAt}
          AND (claim_token IS NULL OR claim_expires_at <= ${claimedAt})
        ORDER BY available_at, occurred_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE outbox_events e
      SET claim_token = gen_random_uuid(), claimed_at = ${claimedAt},
          claim_expires_at = ${claimExpiresAt}, attempt_count = e.attempt_count + 1
      FROM candidates c
      WHERE e.id = c.id
      RETURNING e.id, e.claim_token, e.attempt_count, e.payload
    `;
    return rows.map((row) => ({
      id: row.id,
      claimToken: row.claim_token,
      attemptNumber: row.attempt_count,
      event: OpportunityEventSchema.parse(row.payload),
    }));
  }

  async markPublished(
    id: string,
    claimToken: string,
    attemptNumber: number,
    publishedAt: Date,
  ): Promise<void> {
    await this.sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE outbox_events
        SET published_at = ${publishedAt}, claim_token = NULL, claimed_at = NULL,
            claim_expires_at = NULL, last_error_category = NULL
        WHERE id = ${id} AND claim_token = ${claimToken}
          AND attempt_count = ${attemptNumber} AND published_at IS NULL
        RETURNING id
      `;
      assertClaimUpdated(updated);
      await tx`
        INSERT INTO outbox_dispatch_attempts (event_id, attempt_number, outcome, attempted_at)
        VALUES (${id}, ${attemptNumber}, 'published', ${publishedAt})
        ON CONFLICT (event_id, attempt_number) DO NOTHING
      `;
    });
  }

  async scheduleRetry(input: {
    id: string;
    claimToken: string;
    attemptNumber: number;
    availableAt: Date;
    errorCategory: string;
    attemptedAt: Date;
  }): Promise<void> {
    await this.sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE outbox_events
        SET available_at = ${input.availableAt}, last_error_category = ${input.errorCategory},
            claim_token = NULL, claimed_at = NULL, claim_expires_at = NULL
        WHERE id = ${input.id} AND claim_token = ${input.claimToken}
          AND attempt_count = ${input.attemptNumber} AND published_at IS NULL
        RETURNING id
      `;
      assertClaimUpdated(updated);
      await tx`
        INSERT INTO outbox_dispatch_attempts (
          event_id, attempt_number, outcome, error_category, attempted_at
        ) VALUES (
          ${input.id}, ${input.attemptNumber}, 'retry_scheduled',
          ${input.errorCategory}, ${input.attemptedAt}
        )
        ON CONFLICT (event_id, attempt_number) DO NOTHING
      `;
    });
  }

  async deadLetter(input: {
    id: string;
    claimToken: string;
    attemptNumber: number;
    errorCategory: string;
    attemptedAt: Date;
  }): Promise<void> {
    await this.sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE outbox_events
        SET dead_lettered_at = ${input.attemptedAt},
            last_error_category = ${input.errorCategory}, claim_token = NULL,
            claimed_at = NULL, claim_expires_at = NULL
        WHERE id = ${input.id} AND claim_token = ${input.claimToken}
          AND attempt_count = ${input.attemptNumber} AND published_at IS NULL
        RETURNING id
      `;
      assertClaimUpdated(updated);
      await tx`
        INSERT INTO outbox_dispatch_attempts (
          event_id, attempt_number, outcome, error_category, attempted_at
        ) VALUES (
          ${input.id}, ${input.attemptNumber}, 'dead_lettered',
          ${input.errorCategory}, ${input.attemptedAt}
        )
        ON CONFLICT (event_id, attempt_number) DO NOTHING
      `;
    });
  }
}
