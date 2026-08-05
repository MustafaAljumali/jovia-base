import { AppError, type QuarantineRecord, type RawPayloadReference } from "@jovia/contracts";

export interface QuarantineActor {
  id: string;
  capabilities: ReadonlySet<string>;
}

export interface QuarantineRepositoryPort {
  record(input: {
    sourceCode: string;
    runId: string;
    raw: RawPayloadReference;
    reason: QuarantineRecord["reason"];
    safeFieldPaths: readonly string[];
    connectorVersion: string;
    correlationId: string;
  }): Promise<void>;
  find(id: string): Promise<QuarantineRecord | undefined>;
  releaseForReplay(input: {
    id: string;
    actorId: string;
    mapperVersion: string;
    releasedAt: Date;
  }): Promise<QuarantineRecord>;
}

export class QuarantineService {
  constructor(
    private readonly repository: QuarantineRepositoryPort,
    private readonly clock: { now(): Date },
  ) {}

  record(input: Parameters<QuarantineRepositoryPort["record"]>[0]): Promise<void> {
    return this.repository.record(input);
  }

  async releaseForReplay(
    actor: QuarantineActor,
    quarantineId: string,
    mapperVersion: string,
  ): Promise<QuarantineRecord> {
    if (!actor.capabilities.has("admin:operate")) {
      throw new AppError({
        code: "capability_denied",
        status: 403,
        title: "Administrative capability is required",
      });
    }
    const record = await this.repository.find(quarantineId);
    if (!record) {
      throw new AppError({ code: "not_found", status: 404, title: "Quarantine record not found" });
    }
    if (record.releasedAt !== null) {
      throw new AppError({
        code: "quarantine_already_released",
        status: 409,
        title: "Quarantine record was already released",
      });
    }
    if (mapperVersion === record.connectorVersion) {
      throw new AppError({
        code: "mapper_version_unchanged",
        status: 409,
        title: "Replay requires a changed mapper version",
      });
    }
    return this.repository.releaseForReplay({
      id: quarantineId,
      actorId: actor.id,
      mapperVersion,
      releasedAt: this.clock.now(),
    });
  }
}
