import {
  AppError,
  CanonicalOpportunitySchema,
  DirectOpportunityCommandSchema,
  IdempotencyKeySchema,
  OpportunityListQuerySchema,
  OpportunityListResponseSchema,
  type CanonicalOpportunity,
  type DirectOpportunityCommand,
} from "@jovia/contracts";
import type { Actor } from "@jovia/auth";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireCapability } from "../plugins/authorization.js";

const OpportunityIdSchema = z.object({ id: z.uuid() }).strict();
const RemoveHeadersSchema = z
  .object({
    organizationId: z.uuid(),
    publishingTermsVersion: z.string().trim().min(1).max(120),
  })
  .strict();
const CursorPayloadSchema = z.tuple([z.iso.datetime(), z.uuid()]);

export interface OpportunityQueryPort {
  getById(id: string): Promise<CanonicalOpportunity | undefined>;
  listActive(input: {
    limit: number;
    cursor?: { publishedAt: Date; id: string };
  }): Promise<readonly CanonicalOpportunity[]>;
}

export interface OpportunityRouteDependencies {
  direct: {
    create(
      actor: Actor,
      input: DirectOpportunityCommand,
      idempotencyKey: string,
      correlationId: string,
    ): Promise<CanonicalOpportunity>;
    replace(
      actor: Actor,
      opportunityId: string,
      input: DirectOpportunityCommand,
      idempotencyKey: string,
      correlationId: string,
    ): Promise<CanonicalOpportunity>;
    remove(
      actor: Actor,
      opportunityId: string,
      organizationId: string,
      publishingTermsVersion: string,
      idempotencyKey: string,
      correlationId: string,
    ): Promise<CanonicalOpportunity>;
  };
  opportunities: OpportunityQueryPort;
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function encodeCursor(opportunity: CanonicalOpportunity): string {
  return Buffer.from(JSON.stringify([opportunity.publishedAt, opportunity.id])).toString(
    "base64url",
  );
}

function decodeCursor(value: string | undefined): { publishedAt: Date; id: string } | undefined {
  if (!value) return undefined;
  try {
    const [publishedAt, id] = CursorPayloadSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return { publishedAt: new Date(publishedAt), id };
  } catch {
    throw new AppError({ code: "invalid_cursor", status: 422, title: "Cursor is invalid" });
  }
}

export function registerOpportunityRoutes(
  app: FastifyInstance,
  dependencies: OpportunityRouteDependencies,
): void {
  app.get("/v1/opportunities", async (request) => {
    requireCapability(request.actor, "opportunity:read");
    const query = OpportunityListQuerySchema.parse(request.query);
    const cursor = decodeCursor(query.cursor);
    const items = await dependencies.opportunities.listActive({
      limit: query.limit,
      ...(cursor ? { cursor } : {}),
    });
    const last = items.at(-1);
    return OpportunityListResponseSchema.parse({
      items,
      nextCursor: items.length === query.limit && last ? encodeCursor(last) : null,
    });
  });

  app.get("/v1/opportunities/:id", async (request) => {
    requireCapability(request.actor, "opportunity:read");
    const { id } = OpportunityIdSchema.parse(request.params);
    const opportunity = await dependencies.opportunities.getById(id);
    if (!opportunity) {
      throw new AppError({ code: "not_found", status: 404, title: "Opportunity not found" });
    }
    return CanonicalOpportunitySchema.parse(opportunity);
  });

  app.post("/v1/opportunities", async (request, reply) => {
    const actor = requireCapability(request.actor, "opportunity:publish");
    const command = DirectOpportunityCommandSchema.parse(request.body);
    const idempotencyKey = IdempotencyKeySchema.parse(header(request.headers["idempotency-key"]));
    const opportunity = await dependencies.direct.create(
      actor,
      command,
      idempotencyKey,
      request.correlationId,
    );
    return reply.status(201).send(CanonicalOpportunitySchema.parse(opportunity));
  });

  app.put("/v1/opportunities/:id", async (request) => {
    const actor = requireCapability(request.actor, "opportunity:publish");
    const { id } = OpportunityIdSchema.parse(request.params);
    const command = DirectOpportunityCommandSchema.parse(request.body);
    const idempotencyKey = IdempotencyKeySchema.parse(header(request.headers["idempotency-key"]));
    return CanonicalOpportunitySchema.parse(
      await dependencies.direct.replace(actor, id, command, idempotencyKey, request.correlationId),
    );
  });

  app.delete("/v1/opportunities/:id", async (request, reply) => {
    const actor = requireCapability(request.actor, "opportunity:publish");
    const { id } = OpportunityIdSchema.parse(request.params);
    const idempotencyKey = IdempotencyKeySchema.parse(header(request.headers["idempotency-key"]));
    const removeHeaders = RemoveHeadersSchema.parse({
      organizationId: header(request.headers["x-publisher-organization-id"]),
      publishingTermsVersion: header(request.headers["x-publishing-terms-version"]),
    });
    await dependencies.direct.remove(
      actor,
      id,
      removeHeaders.organizationId,
      removeHeaders.publishingTermsVersion,
      idempotencyKey,
      request.correlationId,
    );
    return reply.status(204).send();
  });
}
