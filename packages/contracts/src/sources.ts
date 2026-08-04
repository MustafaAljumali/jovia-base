import { z } from "zod";

export const SourceMechanismSchema = z.enum([
  "official_api",
  "licensed_feed",
  "approved_partnership",
  "rss",
  "unsupported",
]);

export const LegalPostureSchema = z.enum(["approved", "conditional", "blocked", "unreviewed"]);

export const SourceRegistrationSchema = z.object({
  code: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/u),
  name: z.string().min(1),
  mechanism: SourceMechanismSchema,
  legalPosture: LegalPostureSchema,
  termsUrl: z.url(),
  attributionRule: z.string().min(1),
  pollingFloorSeconds: z.number().int().positive(),
  cacheTtlSeconds: z.number().int().nonnegative(),
  redistributionRule: z.string().min(1),
  owner: z.string().min(1),
  lastVerifiedAt: z.iso.datetime(),
  enabled: z.boolean().default(false),
});

export type SourceRegistration = z.infer<typeof SourceRegistrationSchema>;
