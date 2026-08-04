import { z } from "zod";
import { describe, expect, it } from "vitest";

import { parseStructuredOutput } from "./structured-output.js";

describe("structured AI output", () => {
  it("parses schema-valid JSON and rejects malformed or invalid output", () => {
    const schema = z.object({ score: z.number().min(0).max(100) });
    expect(parseStructuredOutput('{"score":91}', schema, "fake")).toEqual({ score: 91 });
    expect(() => parseStructuredOutput("not-json", schema, "fake")).toThrow(/malformed/u);
    expect(() => parseStructuredOutput('{"score":101}', schema, "fake")).toThrow(/schema/u);
  });
});
