import { readFile } from "node:fs/promises";

import type { HimalayasCheckpoint } from "@jovia/contracts";
import { describe, expect, it, vi } from "vitest";

import type { FetchPlan, HttpResponse, HttpTransport } from "./connector.js";
import { HimalayasConnector } from "./connector.js";
import { HimalayasPageSchema } from "./schema.js";

async function fixture(name: string): Promise<Uint8Array> {
  return readFile(new URL(`./fixtures/${name}.json`, import.meta.url));
}

function transport(responses: readonly HttpResponse[]) {
  const queue = [...responses];
  const requests: Array<{
    method: string;
    url: string;
    headers: Readonly<Record<string, string>>;
  }> = [];
  const get: HttpTransport["get"] = vi.fn(async (request) => {
    requests.push(request);
    const response = queue.shift();
    if (!response) throw new Error("fake HTTP response exhausted");
    return response;
  });
  return { get, requests };
}

async function firstPage(connector: HimalayasConnector, plan: FetchPlan<HimalayasCheckpoint>) {
  const iterator = connector.fetch(plan, new AbortController().signal)[Symbol.asyncIterator]();
  const result = await iterator.next();
  if (result.done) throw new Error("expected a Himalayas page");
  return result.value;
}

describe("Himalayas official API connector contract", () => {
  it("requests only the documented browse endpoint with limit 20", async () => {
    const fake = transport([
      {
        status: 200,
        headers: { "content-type": "application/json" },
        bytes: await fixture("page-0"),
      },
    ]);
    const connector = new HimalayasConnector(fake);
    const plan = await connector.plan({
      checkpoint: undefined,
      policy: {} as never,
      runId: "run-1",
    });
    const page = await firstPage(connector, plan);

    expect(fake.requests).toEqual([
      {
        method: "GET",
        url: "https://himalayas.app/jobs/api?offset=0&limit=20",
        headers: { accept: "application/json", "user-agent": "Jovia/0.1 opportunity-connector" },
      },
    ]);
    expect(page.nextCheckpoint).toMatchObject({
      offset: 20,
      datasetUpdatedAt: "2026-08-05T00:00:00.000Z",
    });
    expect(page.complete).toBe(false);
  });

  it("maps the source application link and salary period without exposing companyLogo", async () => {
    const bytes = await fixture("page-0");
    const connector = new HimalayasConnector(transport([]));
    const raw = connector.createRawPageForTest(bytes, { offset: 0 });
    const [record] = connector.parse(raw);
    const source = HimalayasPageSchema.parse(JSON.parse(new TextDecoder().decode(bytes))).jobs[0];

    expect(record).toMatchObject({
      externalId: source?.guid,
      sourceCode: "himalayas",
      engagementType: "contract",
      experienceLevels: ["senior"],
      compensation: {
        kind: source?.salaryPeriod,
        minimum: "50.25",
        maximum: "75",
        currency: source?.currency,
      },
      originalUrl: source?.applicationLink,
      applicationUrl: source?.applicationLink,
      extension: { companySlug: "example-systems" },
    });
    expect(record?.extension).not.toHaveProperty("companyLogo");
  });

  it("fails closed on a required upstream type change", async () => {
    const invalid = JSON.stringify({
      updatedAt: 1785888000000,
      offset: 0,
      limit: 20,
      totalCount: 1,
      jobs: [
        {
          ...HimalayasPageSchema.parse(
            JSON.parse(new TextDecoder().decode(await fixture("page-0"))),
          ).jobs[0],
          guid: 42,
        },
      ],
    });
    const connector = new HimalayasConnector(transport([]));
    expect(() =>
      connector.parse(
        connector.createRawPageForTest(new TextEncoder().encode(invalid), { offset: 0 }),
      ),
    ).toThrow("jobs.0.guid");
  });

  it("classifies 429 with the official 60-second retry instruction", async () => {
    const connector = new HimalayasConnector(
      transport([
        { status: 429, headers: {}, bytes: new TextEncoder().encode('{"error":"rate limited"}') },
      ]),
    );
    await expect(firstPage(connector, { checkpoint: { offset: 0 } })).rejects.toMatchObject({
      kind: "http",
      status: 429,
      retryAfterSeconds: 60,
    });
  });

  it("marks a changed dataset during resume without advancing old history", async () => {
    const connector = new HimalayasConnector(transport([]));
    const page = connector.createRawPageForTest(await fixture("page-20"), {
      offset: 20,
      datasetUpdatedAt: "2026-08-04T00:00:00.000Z",
      lastCommittedPageHash: "a".repeat(64),
    });
    expect(() => connector.parse(page)).toThrow("Himalayas dataset changed during a partial run");
  });
});
