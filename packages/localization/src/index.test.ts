import { describe, expect, it } from "vitest";

import { resolveLocale, SupportedLocaleSchema, supportedLocales } from "./index.js";

describe("localization contract", () => {
  it("supports the four approved product locales", () => {
    expect(supportedLocales).toEqual(["ar", "en", "fr", "es"]);
    expect(SupportedLocaleSchema.parse("ar")).toBe("ar");
  });

  it("normalizes regional locale tags and falls back safely", () => {
    expect(resolveLocale("fr-CA")).toBe("fr");
    expect(resolveLocale("de-DE", "ar")).toBe("ar");
  });
});
