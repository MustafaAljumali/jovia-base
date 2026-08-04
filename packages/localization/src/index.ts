import { z } from "zod";

export const SupportedLocaleSchema = z.enum(["ar", "en", "fr", "es"]);
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;
export const supportedLocales = SupportedLocaleSchema.options;

export function resolveLocale(value: string | undefined, fallback: SupportedLocale = "en") {
  const candidate = value?.split(/[-_]/u)[0]?.toLowerCase();
  const result = SupportedLocaleSchema.safeParse(candidate);
  return result.success ? result.data : fallback;
}
