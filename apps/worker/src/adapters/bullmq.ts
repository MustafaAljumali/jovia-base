import { Worker, type ConnectionOptions, type Job, type Processor } from "bullmq";

import type { WorkerHandle } from "../runtime.js";

interface QueueWorker {
  run(): Promise<void>;
  close(): Promise<void>;
}

export interface BullMqWorkerOptions<Data = unknown, Result = unknown> {
  queueName: string;
  connection: ConnectionOptions;
  concurrency: number;
  processor: Processor<Data, Result>;
  logger: {
    error(bindings: Record<string, unknown>, message: string): unknown;
    info(bindings: Record<string, unknown>, message: string): unknown;
  };
  workerFactory?: () => QueueWorker;
}

export function createBullMqWorkerHandle<Data, Result>(
  options: BullMqWorkerOptions<Data, Result>,
): WorkerHandle {
  const create =
    options.workerFactory ??
    (() =>
      new Worker<Data, Result>(options.queueName, options.processor, {
        autorun: false,
        concurrency: options.concurrency,
        connection: options.connection,
      }));
  const worker = create();
  let runPromise: Promise<void> | undefined;

  return {
    name: options.queueName,
    async start() {
      if (runPromise) return;
      runPromise = worker.run();
      void runPromise.catch((error: unknown) =>
        options.logger.error({ err: error, queue: options.queueName }, "Queue worker failed"),
      );
      options.logger.info({ queue: options.queueName }, "Queue worker started");
    },
    async stop() {
      await worker.close();
      await runPromise?.catch(() => undefined);
      options.logger.info({ queue: options.queueName }, "Queue worker stopped");
    },
  };
}

export function correlationIdFromJob(job: Pick<Job, "data">): string | undefined {
  if (!job.data || typeof job.data !== "object" || !("correlationId" in job.data)) return undefined;
  const value = job.data.correlationId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
