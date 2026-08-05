import type { CanonicalOpportunity } from "@jovia/contracts";

export interface ProposalDraft {
  subject?: string;
  body: string;
  pricingRationale: string;
  negotiationNotes: readonly string[];
}

export interface ProposalGenerationPort {
  draft(input: {
    actorId: string;
    opportunity: CanonicalOpportunity;
    portfolioItemIds: readonly string[];
    targetRateMicrousd: bigint;
    correlationId: string;
  }): Promise<ProposalDraft>;
}
