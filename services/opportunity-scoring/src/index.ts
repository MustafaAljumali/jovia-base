import type { CanonicalOpportunity } from "@jovia/contracts";

export interface OpportunityScore {
  opportunity: CanonicalOpportunity;
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
    opportunity: CanonicalOpportunity,
    actorId: string,
    signal?: AbortSignal,
  ): Promise<OpportunityScore>;
}
