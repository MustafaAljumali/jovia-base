import { createHash } from "node:crypto";

import type { HimalayasCheckpoint, SourceOpportunityRecord } from "@jovia/contracts";
import type { z } from "zod";

import {
  DatasetSupersededError,
  type ConnectorPlanContext,
  type FetchPlan,
  type OpportunityConnector,
  type RawPage,
} from "../connector/contracts.js";
import { ConnectorFetchError } from "../connector/retry.js";
import { HimalayasPageSchema, type HimalayasJob, type HimalayasPage } from "./schema.js";

export type { FetchPlan } from "../connector/contracts.js";

export interface HttpRequest {
  method: "GET";
  url: string;
  headers: Readonly<Record<string, string>>;
}

export interface HttpResponse {
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  bytes: Uint8Array;
}

export interface HttpTransport {
  get(request: HttpRequest, signal: AbortSignal): Promise<HttpResponse>;
}

interface HimalayasRawValue {
  decoded: unknown;
  checkpoint: HimalayasCheckpoint;
  decodeFailed: boolean;
}

function retryAfter(headers: HttpResponse["headers"], status: number): number | undefined {
  const value = headers["retry-after"];
  if (value) {
    const seconds = Number.parseInt(value, 10);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  }
  return status === 429 ? 60 : undefined;
}

function timestamp(milliseconds: number): string {
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new Error("invalid Himalayas timestamp");
  return date.toISOString();
}

function decimalNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error("invalid Himalayas compensation");
  const text = value.toString();
  if (!/[eE]/u.test(text)) return text;
  const [coefficient = "0", exponentText = "0"] = text.toLowerCase().split("e");
  const exponent = Number.parseInt(exponentText, 10);
  const [whole = "0", fraction = ""] = coefficient.split(".");
  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + exponent;
  if (decimalIndex <= 0) return `0.${"0".repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  return `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

const engagement = {
  "Full Time": "full_time",
  "Part Time": "part_time",
  Contractor: "contract",
  Temporary: "temporary",
  Intern: "internship",
  Volunteer: "unknown",
  Other: "unknown",
} as const;

const seniority = {
  "Entry-level": "entry",
  "Mid-level": "mid",
  Senior: "senior",
  Manager: "lead",
  Director: "lead",
  Executive: "executive",
} as const;

function mapJob(job: HimalayasJob, page: HimalayasPage): SourceOpportunityRecord {
  const hasCompensation =
    (job.minSalary !== null && job.minSalary !== undefined) ||
    (job.maxSalary !== null && job.maxSalary !== undefined);
  return {
    externalId: job.guid,
    sourceCode: "himalayas",
    title: job.title,
    descriptionHtml: job.description,
    employerName: job.companyName,
    engagementType: engagement[job.employmentType],
    experienceLevels: [...new Set(job.seniority.map((value) => seniority[value]))],
    categories: job.parentCategories,
    technologies: job.categories,
    languages: [],
    location: {
      remote: true,
      raw: job.locationRestrictions.map(({ name }) => name).join(", ") || "Worldwide",
      countryCodes: job.locationRestrictions.map(({ alpha2 }) => alpha2),
      timezoneRestrictions: job.timezoneRestrictions,
    },
    ...(hasCompensation
      ? {
          compensation: {
            kind: job.salaryPeriod,
            ...(job.minSalary === null || job.minSalary === undefined
              ? {}
              : { minimum: decimalNumber(job.minSalary) }),
            ...(job.maxSalary === null || job.maxSalary === undefined
              ? {}
              : { maximum: decimalNumber(job.maxSalary) }),
            currency: job.currency,
          },
        }
      : {}),
    publishedAt: timestamp(job.pubDate),
    updatedAt: timestamp(page.updatedAt),
    expiresAt: timestamp(job.expiryDate),
    originalUrl: job.applicationLink,
    applicationUrl: job.applicationLink,
    extension: {
      companySlug: job.companySlug,
      excerpt: job.excerpt,
      sourceCategories: job.categories,
      sourceParentCategories: job.parentCategories,
    },
  };
}

function validationMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 20)
    .map((issue) => `${issue.path.join(".") || "response"} ${issue.message}`)
    .join("; ");
}

export class HimalayasConnector implements OpportunityConnector<HimalayasCheckpoint> {
  readonly sourceCode = "himalayas";
  readonly connectorVersion = "1.0.0";
  readonly mapperVersion = "1.0.0";

  constructor(private readonly transport: HttpTransport) {}

  async plan(
    context: ConnectorPlanContext<HimalayasCheckpoint>,
  ): Promise<FetchPlan<HimalayasCheckpoint>> {
    return { checkpoint: context.checkpoint ?? { offset: 0 } };
  }

  async *fetch(
    plan: FetchPlan<HimalayasCheckpoint>,
    signal: AbortSignal,
  ): AsyncIterable<RawPage<HimalayasCheckpoint>> {
    const url = new URL("https://himalayas.app/jobs/api");
    url.searchParams.set("offset", String(plan.checkpoint.offset));
    url.searchParams.set("limit", "20");
    const response = await this.transport.get(
      {
        method: "GET",
        url: url.toString(),
        headers: { accept: "application/json", "user-agent": "Jovia/0.1 opportunity-connector" },
      },
      signal,
    );
    if (response.status < 200 || response.status >= 300) {
      const retryAfterSeconds = retryAfter(response.headers, response.status);
      throw new ConnectorFetchError("http", `Himalayas returned HTTP ${response.status}`, {
        status: response.status,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      });
    }
    yield this.createRawPage(response.bytes, plan.checkpoint);
  }

  private createRawPage(
    bytes: Uint8Array,
    checkpoint: HimalayasCheckpoint,
  ): RawPage<HimalayasCheckpoint> {
    let decoded: unknown;
    let decodeFailed = false;
    try {
      decoded = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      decoded = null;
      decodeFailed = true;
    }
    const parsed = HimalayasPageSchema.safeParse(decoded);
    const pageHash = createHash("sha256").update(bytes).digest("hex");
    const nextCheckpoint = parsed.success
      ? {
          offset: parsed.data.offset + parsed.data.limit,
          datasetUpdatedAt: timestamp(parsed.data.updatedAt),
          lastCommittedPageHash: pageHash,
        }
      : checkpoint;
    return {
      sequence: Math.floor(checkpoint.offset / 20),
      bytes,
      contentType: "application/json",
      fetchedAt: new Date().toISOString(),
      value: { decoded, checkpoint, decodeFailed } satisfies HimalayasRawValue,
      nextCheckpoint,
      complete:
        parsed.success &&
        (parsed.data.jobs.length === 0 ||
          parsed.data.offset + parsed.data.jobs.length >= parsed.data.totalCount),
    };
  }

  createRawPageForTest(
    bytes: Uint8Array,
    checkpoint: HimalayasCheckpoint,
  ): RawPage<HimalayasCheckpoint> {
    return this.createRawPage(bytes, checkpoint);
  }

  parse(page: RawPage<HimalayasCheckpoint>): readonly SourceOpportunityRecord[] {
    const value = page.value as HimalayasRawValue;
    if (value.decodeFailed) throw new Error("response invalid JSON");
    const parsed = HimalayasPageSchema.safeParse(value.decoded);
    if (!parsed.success) throw new Error(validationMessage(parsed.error));
    if (parsed.data.offset !== value.checkpoint.offset || parsed.data.limit !== 20) {
      throw new Error("response pagination does not match the requested page");
    }
    const datasetUpdatedAt = timestamp(parsed.data.updatedAt);
    if (
      value.checkpoint.datasetUpdatedAt !== undefined &&
      value.checkpoint.datasetUpdatedAt !== datasetUpdatedAt
    ) {
      throw new DatasetSupersededError(this.sourceCode);
    }
    return parsed.data.jobs.map((job) => mapJob(job, parsed.data));
  }
}

export class FetchHttpTransport implements HttpTransport {
  async get(request: HttpRequest, signal: AbortSignal): Promise<HttpResponse> {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        signal,
        redirect: "error",
      });
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    } catch (error) {
      if (signal.aborted) {
        const reason = signal.reason;
        if (
          typeof reason === "object" &&
          reason !== null &&
          "name" in reason &&
          reason.name === "TimeoutError"
        ) {
          throw new ConnectorFetchError("timeout", "Himalayas request timed out", {
            cause: error,
          });
        }
        throw new ConnectorFetchError("aborted", "Himalayas request aborted", { cause: error });
      }
      throw new ConnectorFetchError("network", "Himalayas network request failed", {
        cause: error,
      });
    }
  }
}
