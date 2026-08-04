export interface DeduplicationCandidate {
  opportunityId: string;
  canonicalOpportunityId: string;
  sourceScope: "external" | "first_party";
  sourceReliability: number;
  firstSeenAt: string;
}

export interface DeduplicationCandidatePort {
  findExactWithinWindow(
    contentSignature: string,
    publishedAt: string,
    windowSeconds: number,
  ): Promise<readonly DeduplicationCandidate[]>;
}

export interface DeduplicationInput {
  contentSignature: string;
  publishedAt: string;
  proposed: DeduplicationCandidate;
}

export type DeduplicationDecision =
  | { kind: "new"; canonicalOpportunityId: string }
  | { kind: "duplicate"; canonicalOpportunityId: string; duplicateOpportunityIds: string[] }
  | { kind: "promote"; canonicalOpportunityId: string; supersededCanonicalIds: string[] };

export interface DeduplicationStrategy {
  readonly kind: "deterministic" | "semantic";
  decide(input: DeduplicationInput): Promise<DeduplicationDecision>;
}

export function selectCanonicalCandidate(
  candidates: readonly DeduplicationCandidate[],
): DeduplicationCandidate {
  const winner = [...candidates].sort((left, right) => {
    const leftFirstParty = left.sourceScope === "first_party" ? 1 : 0;
    const rightFirstParty = right.sourceScope === "first_party" ? 1 : 0;
    if (leftFirstParty !== rightFirstParty) return rightFirstParty - leftFirstParty;
    if (left.sourceReliability !== right.sourceReliability) {
      return right.sourceReliability - left.sourceReliability;
    }
    const firstSeen = left.firstSeenAt.localeCompare(right.firstSeenAt);
    if (firstSeen !== 0) return firstSeen;
    return left.opportunityId.localeCompare(right.opportunityId);
  })[0];
  if (!winner) throw new Error("at least one deduplication candidate is required");
  return winner;
}

export class DeterministicDeduplicationStrategy implements DeduplicationStrategy {
  readonly kind = "deterministic" as const;

  constructor(private readonly candidates: DeduplicationCandidatePort) {}

  async decide(input: DeduplicationInput): Promise<DeduplicationDecision> {
    const existing = await this.candidates.findExactWithinWindow(
      input.contentSignature,
      input.publishedAt,
      86_400,
    );
    if (existing.length === 0) {
      return { kind: "new", canonicalOpportunityId: input.proposed.opportunityId };
    }
    const winner = selectCanonicalCandidate([...existing, input.proposed]);
    if (winner.opportunityId === input.proposed.opportunityId) {
      return {
        kind: "promote",
        canonicalOpportunityId: input.proposed.opportunityId,
        supersededCanonicalIds: sortedIds(
          existing.map(({ canonicalOpportunityId }) => canonicalOpportunityId),
        ),
      };
    }
    return {
      kind: "duplicate",
      canonicalOpportunityId: winner.canonicalOpportunityId,
      duplicateOpportunityIds: [input.proposed.opportunityId],
    };
  }
}

function sortedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}
