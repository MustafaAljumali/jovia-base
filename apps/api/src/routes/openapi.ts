import { createOpportunityOpenApiDocument } from "@jovia/contracts";
import type { FastifyInstance } from "fastify";

import { requireCapability } from "../plugins/authorization.js";

export function registerOpenApiRoute(app: FastifyInstance): void {
  app.get("/v1/openapi.json", async (request) => {
    requireCapability(request.actor, "opportunity:read");
    return createOpportunityOpenApiDocument();
  });
}
