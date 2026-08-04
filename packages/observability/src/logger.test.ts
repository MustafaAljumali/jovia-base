import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { runWithCorrelationId } from "./context.js";
import { createLogger } from "./logger.js";

describe("structured logger", () => {
  it("adds service context and redacts request bodies", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ service: "test", environment: "test", destination });
    runWithCorrelationId("req-1", () =>
      logger.info({ request: { body: { token: "secret" } } }, "ok"),
    );
    const record = JSON.parse(output) as Record<string, unknown>;
    expect(record).toMatchObject({ service: "test", environment: "test", correlationId: "req-1" });
    expect(output).not.toContain("secret");
  });
});
