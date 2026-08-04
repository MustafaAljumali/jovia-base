import type { Compensation, CompensationInput } from "@jovia/contracts";

import { normalizeCurrency } from "./iso.js";

const multiplier = {
  hourly: 2_080n,
  daily: 260n,
  weekly: 52n,
  fortnightly: 26n,
  monthly: 12n,
  annual: 1n,
} as const;

export class CompensationNormalizationError extends Error {
  readonly code: "invalid_compensation" | "invalid_currency";

  constructor(code: CompensationNormalizationError["code"], message: string) {
    super(message);
    this.name = "CompensationNormalizationError";
    this.code = code;
  }
}

function parseDecimal(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
    throw new CompensationNormalizationError("invalid_compensation", "invalid decimal amount");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length, value };
}

function formatAtScale(integer: bigint, sourceScale: number, outputScale: number): string {
  const adjusted = integer * 10n ** BigInt(outputScale - sourceScale);
  const digits = adjusted.toString().padStart(outputScale + 1, "0");
  if (outputScale === 0) return digits;
  return `${digits.slice(0, -outputScale)}.${digits.slice(-outputScale)}`;
}

function annualize(value: string, period: keyof typeof multiplier): string {
  const decimal = parseDecimal(value);
  if (period === "annual") return decimal.value;
  const outputScale = Math.max(decimal.scale, 2);
  return formatAtScale(decimal.integer * multiplier[period], decimal.scale, outputScale);
}

function compareDecimals(left: string, right: string): number {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale);
  const leftValue = a.integer * 10n ** BigInt(scale - a.scale);
  const rightValue = b.integer * 10n ** BigInt(scale - b.scale);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

export function normalizeCompensation(input: CompensationInput): Compensation {
  const currency = normalizeCurrency(input.currency);
  if (!currency)
    throw new CompensationNormalizationError("invalid_currency", "unknown ISO 4217 currency");
  if (input.minimum !== undefined) parseDecimal(input.minimum);
  if (input.maximum !== undefined) parseDecimal(input.maximum);
  if (
    input.minimum !== undefined &&
    input.maximum !== undefined &&
    compareDecimals(input.minimum, input.maximum) > 0
  ) {
    throw new CompensationNormalizationError(
      "invalid_compensation",
      "minimum compensation exceeds maximum",
    );
  }

  const normalized: Compensation = {
    kind: input.kind,
    currency,
    sourcePeriod: input.kind,
    ...(input.minimum === undefined ? {} : { minimum: input.minimum }),
    ...(input.maximum === undefined ? {} : { maximum: input.maximum }),
  };
  if (input.kind === "project") return normalized;
  return {
    ...normalized,
    ...(input.minimum === undefined
      ? {}
      : { annualizedMinimum: annualize(input.minimum, input.kind) }),
    ...(input.maximum === undefined
      ? {}
      : { annualizedMaximum: annualize(input.maximum, input.kind) }),
  };
}
