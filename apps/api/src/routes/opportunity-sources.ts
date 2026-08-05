import { SourceListResponseSchema, type SourceExecutionContext } from "@jovia/contracts";
import type { FastifyInstance } from "fastify";

import { requireCapability } from "../plugins/authorization.js";

export function registerOpportunitySourceRoutes(
  app: FastifyInstance,
  sources: { listSources(limit?: number): Promise<readonly SourceExecutionContext[]> },
): void {
  app.get("/v1/admin/opportunity-sources", async (request) => {
    requireCapability(request.actor, "source:read");
    return SourceListResponseSchema.parse({ items: await sources.listSources(100) });
  });
}
