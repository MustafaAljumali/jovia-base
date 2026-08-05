import { createHash } from "node:crypto";

import {
  AppError,
  DirectOpportunityCommandSchema,
  type CanonicalOpportunity,
  type DirectOpportunityCommand,
  type RawPayloadReference,
  type SourceOpportunityRecord,
} from "@jovia/contracts";

import type { RawPayloadStore } from "../connector/contracts.js";
import type { NormalizedOpportunity } from "../normalization/normalize.js";
import type { EligibleSourceContext } from "../ports.js";

export interface PublishingActor {
  id: string;
}

export interface PublishingOwnershipPort {
  requirePublisherMembership(
    actorId: string,
    organizationId: string,
    publishingTermsVersion: string,
  ): Promise<void>;
}

export interface StoredIdempotentOpportunity {
  requestSha256: string;
  opportunity: CanonicalOpportunity;
}

export interface DirectOpportunityTransactionPort {
  findIdempotent(
    actorId: string,
    idempotencyKey: string,
  ): Promise<StoredIdempotentOpportunity | undefined>;
  commitCreate(input: {
    actor: PublishingActor;
    idempotencyKey: string;
    requestSha256: string;
    command: DirectOpportunityCommand;
    source: EligibleSourceContext;
    raw: RawPayloadReference;
    normalized: NormalizedOpportunity;
    correlationId: string;
  }): Promise<CanonicalOpportunity>;
  commitReplace(input: {
    actor: PublishingActor;
    opportunityId: string;
    idempotencyKey: string;
    requestSha256: string;
    command: DirectOpportunityCommand;
    source: EligibleSourceContext;
    raw: RawPayloadReference;
    normalized: NormalizedOpportunity;
    correlationId: string;
  }): Promise<CanonicalOpportunity>;
  commitRemove(input: {
    actor: PublishingActor;
    opportunityId: string;
    organizationId: string;
    idempotencyKey: string;
    requestSha256: string;
    source: EligibleSourceContext;
    correlationId: string;
  }): Promise<CanonicalOpportunity>;
}

export interface DirectOpportunityServicePorts {
  ownership: PublishingOwnershipPort;
  eligibility: {
    require(
      sourceCode: string,
      operation: "publish" | "replace" | "remove",
      correlationId: string,
    ): Promise<EligibleSourceContext>;
  };
  rawPayloads: RawPayloadStore;
  transactions: DirectOpportunityTransactionPort;
  normalize(
    record: SourceOpportunityRecord,
    input: { policy: EligibleSourceContext["context"]["policy"]; normalizedAt: Date },
  ): NormalizedOpportunity;
  clock: { now(): Date };
}

function stableCommand(command: DirectOpportunityCommand): string {
  return JSON.stringify(command);
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function ensureReplayMatches(
  replay: StoredIdempotentOpportunity,
  requestSha256: string,
): CanonicalOpportunity {
  if (replay.requestSha256 !== requestSha256) {
    throw new AppError({
      code: "idempotency_conflict",
      status: 409,
      title: "Idempotency key was already used for a different request",
    });
  }
  return replay.opportunity;
}

function toSourceRecord(
  command: DirectOpportunityCommand,
  requestSha256: string,
): SourceOpportunityRecord {
  return {
    externalId: `direct:${command.publisherOrganizationId}:${requestSha256}`,
    sourceCode: "jovia-direct",
    title: command.title,
    descriptionHtml: command.descriptionHtml,
    employerName: command.employerName,
    engagementType: command.engagementType,
    experienceLevels: command.experienceLevels,
    categories: command.categories,
    technologies: command.technologies,
    languages: command.languages,
    location: command.location,
    ...(command.compensation === undefined ? {} : { compensation: command.compensation }),
    publishedAt: command.publishedAt,
    ...(command.expiresAt === undefined ? {} : { expiresAt: command.expiresAt }),
    originalUrl: command.applicationUrl,
    applicationUrl: command.applicationUrl,
    extension: {
      ...command.extension,
      publisherOrganizationId: command.publisherOrganizationId,
      publishingTermsVersion: command.publishingTermsVersion,
    },
  };
}

export class DirectOpportunityService {
  constructor(private readonly ports: DirectOpportunityServicePorts) {}

  async create(
    actor: PublishingActor,
    input: DirectOpportunityCommand,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CanonicalOpportunity> {
    return this.write("publish", actor, undefined, input, idempotencyKey, correlationId);
  }

  async replace(
    actor: PublishingActor,
    opportunityId: string,
    input: DirectOpportunityCommand,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CanonicalOpportunity> {
    return this.write("replace", actor, opportunityId, input, idempotencyKey, correlationId);
  }

  async remove(
    actor: PublishingActor,
    opportunityId: string,
    organizationId: string,
    publishingTermsVersion: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CanonicalOpportunity> {
    await this.ports.ownership.requirePublisherMembership(
      actor.id,
      organizationId,
      publishingTermsVersion,
    );
    const requestSha256 = digest(
      JSON.stringify({
        opportunityId,
        organizationId,
        publishingTermsVersion,
        operation: "remove",
      }),
    );
    const replay = await this.ports.transactions.findIdempotent(actor.id, idempotencyKey);
    if (replay) return ensureReplayMatches(replay, requestSha256);
    const source = await this.ports.eligibility.require("jovia-direct", "remove", correlationId);
    return this.ports.transactions.commitRemove({
      actor,
      opportunityId,
      organizationId,
      idempotencyKey,
      requestSha256,
      source,
      correlationId,
    });
  }

  private async write(
    operation: "publish" | "replace",
    actor: PublishingActor,
    opportunityId: string | undefined,
    input: DirectOpportunityCommand,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<CanonicalOpportunity> {
    const command = DirectOpportunityCommandSchema.parse(input);
    await this.ports.ownership.requirePublisherMembership(
      actor.id,
      command.publisherOrganizationId,
      command.publishingTermsVersion,
    );
    const serialized = stableCommand(command);
    const requestSha256 = digest(serialized);
    const replay = await this.ports.transactions.findIdempotent(actor.id, idempotencyKey);
    if (replay) return ensureReplayMatches(replay, requestSha256);
    const source = await this.ports.eligibility.require("jovia-direct", operation, correlationId);
    const runId = `direct-${digest(`${actor.id}:${idempotencyKey}`).slice(0, 32)}`;
    const raw = await this.ports.rawPayloads.put({
      sourceCode: "jovia-direct",
      runId,
      pageSequence: 0,
      fetchedAt: this.ports.clock.now().toISOString(),
      contentType: "application/json",
      bytes: new TextEncoder().encode(serialized),
    });
    const normalized = this.ports.normalize(toSourceRecord(command, requestSha256), {
      policy: source.context.policy,
      normalizedAt: this.ports.clock.now(),
    });
    const shared = {
      actor,
      idempotencyKey,
      requestSha256,
      command,
      source,
      raw,
      normalized,
      correlationId,
    };
    return operation === "publish"
      ? this.ports.transactions.commitCreate(shared)
      : this.ports.transactions.commitReplace({ ...shared, opportunityId: opportunityId ?? "" });
  }
}
