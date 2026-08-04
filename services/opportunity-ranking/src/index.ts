import type { OpportunityScore } from "@jovia/opportunity-scoring";

export interface RankedOpportunity extends OpportunityScore {
  rank: number;
}

export interface OpportunityRankingPort {
  rank(scores: readonly OpportunityScore[]): Promise<readonly RankedOpportunity[]>;
}
