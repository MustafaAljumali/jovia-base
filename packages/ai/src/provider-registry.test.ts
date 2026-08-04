import { describe, expect, it } from "vitest";

import { FakeAiProvider } from "./providers/fake.js";
import { AiProviderRegistry } from "./provider-registry.js";

describe("AI provider registry", () => {
  it("rejects duplicate ids and missing providers", () => {
    const provider = FakeAiProvider.success("fake", { text: "ok" });
    expect(() => new AiProviderRegistry([provider, provider])).toThrow(/duplicate/u);
    const registry = new AiProviderRegistry([provider]);
    expect(registry.ids()).toEqual(["fake"]);
    expect(registry.has("fake")).toBe(true);
    expect(() => registry.get("missing")).toThrow(/not registered/u);
  });
});
