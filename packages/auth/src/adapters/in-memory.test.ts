import { describe, expect, it } from "vitest";

import type { Actor } from "../contracts.js";
import { InMemoryAuthAdapter } from "./in-memory.js";

const actor: Actor = {
  id: "actor-1",
  capabilities: new Set(["profile:read"]),
  externalSubjects: [{ issuer: "local-development", subject: "subject-1" }],
};

describe("in-memory authentication adapter", () => {
  it("stores only an opaque hash and honors expiry and revocation", async () => {
    let now = new Date("2026-08-04T00:00:00.000Z");
    const adapter = new InMemoryAuthAdapter([actor], { now: () => now });
    await adapter.createSession({
      id: "session-1",
      actorId: actor.id,
      opaqueToken: "opaque-local-token",
      expiresAt: new Date("2026-08-04T01:00:00.000Z"),
    });
    expect(await adapter.authenticate("opaque-local-token")).toMatchObject({ id: actor.id });
    expect(JSON.stringify(adapter.sessionSnapshot("session-1"))).not.toContain(
      "opaque-local-token",
    );
    await adapter.revoke("session-1", now);
    expect(await adapter.authenticate("opaque-local-token")).toBeUndefined();

    await adapter.createSession({
      id: "session-2",
      actorId: actor.id,
      opaqueToken: "opaque-second-token",
      expiresAt: new Date("2026-08-04T01:00:00.000Z"),
    });
    now = new Date("2026-08-04T02:00:00.000Z");
    expect(await adapter.authenticate("opaque-second-token")).toBeUndefined();
  });

  it("rejects sessions for unknown actors", async () => {
    const adapter = new InMemoryAuthAdapter();
    await expect(
      adapter.createSession({
        id: "session-1",
        actorId: "missing",
        opaqueToken: "opaque-token",
        expiresAt: new Date("2026-08-05T00:00:00.000Z"),
      }),
    ).rejects.toThrow(/not registered/u);
  });
});
