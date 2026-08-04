import type { OpportunityCandidate } from "@jovia/opportunity-ingestion";

export interface ProposalDraft {
  subject?: string;
  body: string;
  pricingRationale: string;
  negotiationNotes: readonly string[];
}

export interface ProposalGenerationPort {
  draft(input: {
    actorId: string;
    opportunity: OpportunityCandidate;
    portfolioItemIds: readonly string[];
    targetRateMicrousd: bigint;
    correlationId: string;
  }): Promise<ProposalDraft>;
}
