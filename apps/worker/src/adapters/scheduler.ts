import { randomUUID } from "node:crypto";

import type { WorkerHandle } from "../runtime.js";

export interface PollScheduleQueue {
  add(
    name: "poll-source",
    data: { sourceCode: string; correlationId: string },
    options: { jobId: string; delay: number; removeOnComplete: boolean },
  ): Promise<unknown>;
}

export interface DueSourceQuery {
  listDueSources(
    now: Date,
    limit?: number,
  ): Promise<readonly { sourceCode: string; policyVersion: number; nextPollAt: Date }[]>;
}

export class SourcePollScheduler {
  constructor(
    private readonly sources: DueSourceQuery,
    private readonly queue: PollScheduleQueue,
    private readonly clock: { now(): Date },
  ) {}

  async tick(limit = 100): Promise<number> {
    const now = this.clock.now();
    const due = await this.sources.listDueSources(now, limit);
    for (const source of due) {
      const dueAt = source.nextPollAt.getTime();
      await this.queue.add(
        "poll-source",
        { sourceCode: source.sourceCode, correlationId: randomUUID() },
        {
          jobId: `poll-${source.sourceCode}-v${source.policyVersion}-${dueAt}`,
          delay: Math.max(0, dueAt - now.getTime()),
          removeOnComplete: true,
        },
      );
    }
    return due.length;
  }
}

export function createIntervalWorkerHandle(options: {
  name: string;
  intervalMs: number;
  run(): Promise<unknown>;
  onError(error: unknown): void;
}): WorkerHandle {
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    name: options.name,
    async start() {
      if (timer) return;
      await options.run();
      timer = setInterval(() => void options.run().catch(options.onError), options.intervalMs);
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
