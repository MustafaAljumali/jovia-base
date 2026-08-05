import type { SourcePolicyVersion } from "@jovia/contracts";

export interface DistributedRateLimitState {
  sourceCode: string;
  nextRequestAt: string;
  remaining: number | null;
  windowEndsAt: string | null;
}

export function stricterRequestSpacingMilliseconds(
  polling: SourcePolicyVersion["polling"],
): number {
  const official = polling.officialRequestLimit;
  if (!official) return polling.minimumRequestSpacingMs;
  const officialSpacing = Math.ceil((official.windowSeconds * 1_000) / official.requests);
  return Math.max(polling.minimumRequestSpacingMs, officialSpacing);
}
