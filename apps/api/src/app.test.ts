import { AppError, HealthResponseSchema } from "@jovia/contracts";
import { describe, expect, it } from "vitest";

import { createApiApp } from "./app.js";

describe("API composition", () => {
  it("returns a validated health response and correlation id", async () => {
    const app = await createApiApp({
      config: { version: "0.1.0" },
      clock: { now: () => new Date("2026-08-04T00:00:00.000Z") },
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: { "x-correlation-id": "req-1" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-correlation-id"]).toBe("req-1");
    expect(HealthResponseSchema.parse(response.json()).status).toBe("ok");
    await app.close();
  });

  it("replaces invalid correlation ids", async () => {
    const app = await createApiApp({ config: { version: "0.1.0" } });
    const response = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: { "x-correlation-id": "not valid whitespace" },
    });
    expect(response.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/u);
    await app.close();
  });

  it("returns safe problem details for known and unknown errors", async () => {
    const app = await createApiApp({
      config: { version: "0.1.0" },
      configure(instance) {
        instance.get("/known", async () => {
          throw new AppError({ code: "denied", status: 403, title: "Denied" });
        });
        instance.get("/unknown", async () => {
          throw new Error("private database detail");
        });
      },
    });
    const known = await app.inject({ method: "GET", url: "/known" });
    expect(known.statusCode).toBe(403);
    expect(known.json()).toMatchObject({ code: "denied", title: "Denied" });
    const unknown = await app.inject({ method: "GET", url: "/unknown" });
    expect(unknown.statusCode).toBe(500);
    expect(unknown.body).not.toContain("private database detail");
    expect(unknown.json()).toMatchObject({ code: "internal_error" });
    await app.close();
  });
});
