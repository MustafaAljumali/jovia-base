import type { ConnectorRunner } from "@jovia/opportunity-ingestion";

export class SourcePollJob {
  constructor(private readonly runner: Pick<ConnectorRunner, "run">) {}

  run(
    data: { sourceCode: string; correlationId: string },
    signal: AbortSignal = new AbortController().signal,
  ) {
    return this.runner.run(data.sourceCode, data.correlationId, signal);
  }
}
