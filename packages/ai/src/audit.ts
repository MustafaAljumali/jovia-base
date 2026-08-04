import type { AiInvocationAudit } from "./contracts.js";

export interface AiAuditSink {
  record(audit: AiInvocationAudit): Promise<void>;
}

export class InMemoryAiAuditSink implements AiAuditSink {
  readonly records: AiInvocationAudit[] = [];

  async record(audit: AiInvocationAudit) {
    this.records.push(structuredClone(audit));
  }
}
