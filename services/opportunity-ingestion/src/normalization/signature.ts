import { createHash } from "node:crypto";

export interface ContentSignatureInput {
  title: string;
  employerKey: string;
  countryCodes: readonly string[];
  compensation: {
    kind: string;
    minimum?: string | undefined;
    maximum?: string | undefined;
    currency: string;
  } | null;
  engagementType: string;
}

function canonicalText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/gu, " ");
}

function lengthDelimited(values: readonly string[]): string {
  return values.map((value) => `${Buffer.byteLength(value, "utf8")}:${value}`).join("|");
}

export function computeContentSignature(input: ContentSignatureInput): string {
  const compensation = input.compensation;
  const values = [
    canonicalText(input.title),
    canonicalText(input.employerKey),
    [...input.countryCodes].sort().join(","),
    compensation?.kind ?? "",
    compensation?.minimum ?? "",
    compensation?.maximum ?? "",
    compensation?.currency ?? "",
    input.engagementType,
  ];
  return createHash("sha256").update(lengthDelimited(values), "utf8").digest("hex");
}
