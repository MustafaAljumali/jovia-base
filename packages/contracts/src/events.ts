import { z } from "zod";

import { OpportunityLifecycleSchema } from "./opportunities.js";

export const OpportunityEventTypeSchema = z.enum([
  "opportunity.discovered.v1",
  "opportunity.updated.v1",
  "opportunity.tombstoned.v1",
  "opportunity.expired.v1",
]);

export const OpportunityEventSchema = z
  .object({
    eventId: z.uuid(),
    eventKey: z.string().min(1).max(512),
    type: OpportunityEventTypeSchema,
    occurredAt: z.iso.datetime(),
    correlationId: z.string().min(1).max(256),
    opportunityId: z.uuid(),
    lifecycle: OpportunityLifecycleSchema,
  })
  .strict();

export type OpportunityEvent = z.infer<typeof OpportunityEventSchema>;
export type OpportunityEventType = z.infer<typeof OpportunityEventTypeSchema>;
