import { IngestionRunListResponseSchema } from "@jovia/contracts";
import type { FastifyInstance } from "fastify";

import { requireCapability } from "../plugins/authorization.js";

export interface IngestionRunQueryPort {
  listRuns(limit?: number): Promise<
    readonly {
      id: string;
      sourceCode: string;
      policyId: string;
      status: string;
      pagesCommitted: number;
      recordsCommitted: number;
      correlationId: string;
      startedAt: Date;
      finishedAt: Date | null;
    }[]
  >;
}

export function registerIngestionRunRoutes(
  app: FastifyInstance,
  runs: IngestionRunQueryPort,
): void {
  app.get("/v1/admin/ingestion-runs", async (request) => {
    requireCapability(request.actor, "admin:operate");
    const items = (await runs.listRuns(100)).map((run) => ({
      ...run,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    }));
    return IngestionRunListResponseSchema.parse({ items });
  });
}
