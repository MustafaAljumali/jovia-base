import type { TokenUsage } from "./contracts.js";

export interface TokenPrice {
  inputMicrousdPerMillion: bigint;
  outputMicrousdPerMillion: bigint;
}

export function calculateCostMicrousd(usage: TokenUsage, price: TokenPrice): bigint {
  return (
    (BigInt(usage.inputTokens) * price.inputMicrousdPerMillion +
      BigInt(usage.outputTokens) * price.outputMicrousdPerMillion) /
    1_000_000n
  );
}

export function accountUsage(usage: TokenUsage, price?: TokenPrice) {
  return price
    ? { usage, costStatus: "known" as const, costMicrousd: calculateCostMicrousd(usage, price) }
    : { usage, costStatus: "unknown" as const };
}

export interface AiUsageSink {
  record(event: {
    requestId: string;
    task: string;
    provider: string;
    model: string;
    promptVersion: string;
    usage: TokenUsage;
    costMicrousd?: bigint;
    success: boolean;
  }): Promise<void>;
}
