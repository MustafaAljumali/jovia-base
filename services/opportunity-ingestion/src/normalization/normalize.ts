import type { Compensation, SourceOpportunityRecord, SourcePolicyVersion } from "@jovia/contracts";

import { CompensationNormalizationError, normalizeCompensation } from "./compensation.js";
import { htmlToPlainText, sanitizeOpportunityHtml } from "./html.js";
import { normalizeCountry, normalizeLanguage, sortedUnique } from "./iso.js";
import { computeContentSignature } from "./signature.js";

export type NormalizationErrorCode =
  | "invalid_currency"
  | "invalid_language"
  | "invalid_country"
  | "invalid_compensation"
  | "modification_not_permitted"
  | "source_policy_mismatch";

export class NormalizationError extends Error {
  constructor(
    readonly code: NormalizationErrorCode,
    message: string,
    readonly fieldPath: string,
  ) {
    super(message);
    this.name = "NormalizationError";
  }
}

export interface NormalizedOpportunity {
  externalId: string;
  sourceCode: string;
  sourcePolicyId: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  employerName: string;
  employerKey: string;
  engagementType: SourceOpportunityRecord["engagementType"];
  experienceLevels: SourceOpportunityRecord["experienceLevels"];
  categories: string[];
  technologies: string[];
  languages: string[];
  location: {
    remote: boolean;
    raw?: string;
    countryCodes: string[];
    timezoneRestrictions: string[];
  };
  compensation: Compensation | null;
  publishedAt: string;
  sourceUpdatedAt: string | null;
  expiresAt: string | null;
  deadlineAt: string | null;
  originalUrl: string;
  applicationUrl: string;
  normalizedAt: string;
  contentSignature: string;
  deduplicationStrategy: "deterministic";
  extension: Readonly<Record<string, unknown>>;
}

function requireModification(
  policy: SourcePolicyVersion,
  field: SourcePolicyVersion["contentModification"]["allowedFields"][number],
): void {
  if (!policy.contentModification.allowedFields.includes(field)) {
    throw new NormalizationError(
      "modification_not_permitted",
      `active policy does not permit ${field}`,
      "policy.contentModification.allowedFields",
    );
  }
}

function normalizedTaxonomy(values: readonly string[], lowerCase: boolean): string[] {
  const normalized = values
    .map((value) => value.normalize("NFKC").trim().replace(/\s+/gu, " "))
    .filter((value) => value.length > 0)
    .map((value) => (lowerCase ? value.toLocaleLowerCase("en") : value));
  return sortedUnique(normalized);
}

function employerKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function normalizeOpportunity(
  record: SourceOpportunityRecord,
  context: { policy: SourcePolicyVersion; normalizedAt: Date },
): NormalizedOpportunity {
  if (record.sourceCode !== context.policy.sourceCode) {
    throw new NormalizationError(
      "source_policy_mismatch",
      "record and policy source codes differ",
      "sourceCode",
    );
  }
  requireModification(context.policy, "description_sanitization");
  requireModification(context.policy, "location_normalization");
  requireModification(context.policy, "language_normalization");
  requireModification(context.policy, "taxonomy_mapping");
  if (record.compensation) requireModification(context.policy, "compensation_normalization");

  const languages = record.languages.map((value, index) => {
    const normalized = normalizeLanguage(value);
    if (!normalized) {
      throw new NormalizationError(
        "invalid_language",
        "unknown ISO 639-1 language",
        `languages.${index}`,
      );
    }
    return normalized;
  });
  const countryCodes = record.location.countryCodes.map((value, index) => {
    const normalized = normalizeCountry(value);
    if (!normalized) {
      throw new NormalizationError(
        "invalid_country",
        "unknown ISO 3166-1 country",
        `location.countryCodes.${index}`,
      );
    }
    return normalized;
  });

  let compensation: Compensation | null = null;
  if (record.compensation) {
    try {
      compensation = normalizeCompensation(record.compensation);
    } catch (error) {
      if (error instanceof CompensationNormalizationError) {
        throw new NormalizationError(error.code, error.message, "compensation");
      }
      throw error;
    }
  }

  const title = record.title.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const descriptionHtml = sanitizeOpportunityHtml(record.descriptionHtml);
  const normalizedEmployerName = record.employerName.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const normalizedEmployerKey = employerKey(normalizedEmployerName);
  const location = {
    remote: record.location.remote,
    ...(record.location.raw === undefined ? {} : { raw: record.location.raw.trim() }),
    countryCodes: sortedUnique(countryCodes),
    timezoneRestrictions: sortedUnique(
      record.location.timezoneRestrictions.map((value) => value.trim()).filter(Boolean),
    ),
  };
  const normalized: Omit<NormalizedOpportunity, "contentSignature"> = {
    externalId: record.externalId,
    sourceCode: record.sourceCode,
    sourcePolicyId: context.policy.id,
    title,
    descriptionHtml,
    descriptionText: htmlToPlainText(descriptionHtml),
    employerName: normalizedEmployerName,
    employerKey: normalizedEmployerKey,
    engagementType: record.engagementType,
    experienceLevels: [...record.experienceLevels],
    categories: normalizedTaxonomy(record.categories, true),
    technologies: normalizedTaxonomy(record.technologies, false),
    languages: sortedUnique(languages),
    location,
    compensation,
    publishedAt: record.publishedAt,
    sourceUpdatedAt: record.updatedAt ?? null,
    expiresAt: record.expiresAt ?? null,
    deadlineAt: record.deadlineAt ?? null,
    originalUrl: record.originalUrl,
    applicationUrl: record.applicationUrl,
    normalizedAt: context.normalizedAt.toISOString(),
    deduplicationStrategy: "deterministic",
    extension: { ...record.extension },
  };
  return {
    ...normalized,
    contentSignature: computeContentSignature({
      title: normalized.title,
      employerKey: normalized.employerKey,
      countryCodes: normalized.location.countryCodes,
      compensation: normalized.compensation,
      engagementType: normalized.engagementType,
    }),
  };
}
