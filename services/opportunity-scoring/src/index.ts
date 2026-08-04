import type { OpportunityCandidate } from "@jovia/opportunity-ingestion";

export interface OpportunityScore {
  opportunity: OpportunityCandidate;
  overall: number;
  dimensions: Readonly<
    Record<
      | "skillMatch"
      | "budgetFairness"
      | "clientQuality"
      | "winProbability"
      | "roi"
      | "careerImpact"
      | "portfolioValue"
      | "learningValue"
      | "longTermBenefit",
      number
    >
  >;
  explanation: readonly string[];
}

export interface OpportunityScoringPort {
  score(
    opportunity: OpportunityCandidate,
    actorId: string,
    signal?: AbortSignal,
  ): Promise<OpportunityScore>;
}
