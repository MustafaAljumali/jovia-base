import { AppError, type SourceRegistration } from "@jovia/contracts";

export * from "./ports.js";
export * from "./source-eligibility.js";
export * from "./deduplication.js";
export * from "./connector/circuit-breaker.js";
export * from "./connector/contracts.js";
export * from "./connector/rate-limiter.js";
export * from "./connector/retry.js";
export * from "./connector/runner.js";
export * from "./normalization/compensation.js";
export * from "./normalization/html.js";
export * from "./normalization/iso.js";
export * from "./normalization/normalize.js";
export * from "./normalization/signature.js";
export * from "./himalayas/connector.js";
export * from "./himalayas/schema.js";
export * from "./lifecycle/service.js";
export * from "./outbox/dispatcher.js";
export * from "./publishing/service.js";
export * from "./quarantine/service.js";

export interface OpportunityCandidate {
  externalId: string;
  sourceCode: string;
  title: string;
  canonicalUrl: string;
  discoveredAt: string;
}

export interface OpportunityConnector {
  discover(options: {
    source: SourceRegistration;
    correlationId: string;
    signal?: AbortSignal;
  }): Promise<readonly OpportunityCandidate[]>;
}

export class OpportunityIngestionService {
  constructor(
    private readonly connectors: ReadonlyMap<string, OpportunityConnector>,
    private readonly clock: { now(): Date },
    private readonly maxLegalReviewAgeDays = 90,
  ) {}

  async ingest(
    source: SourceRegistration,
    options: { correlationId: string; signal?: AbortSignal } = { correlationId: "system" },
  ) {
    const verifiedAt = new Date(source.lastVerifiedAt);
    const ageMs = this.clock.now().getTime() - verifiedAt.getTime();
    const eligible =
      source.enabled &&
      source.mechanism !== "unsupported" &&
      source.legalPosture === "approved" &&
      Number.isFinite(verifiedAt.getTime()) &&
      ageMs >= 0 &&
      ageMs <= this.maxLegalReviewAgeDays * 86_400_000 &&
      source.pollingFloorSeconds > 0;
    const connector = this.connectors.get(source.code);
    if (!eligible || !connector) {
      throw new AppError({
        code: "source_not_eligible",
        status: 422,
        title: "Source is not eligible for ingestion",
      });
    }
    return connector.discover({ source, ...options });
  }
}
