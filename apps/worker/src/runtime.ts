export interface WorkerHandle {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export type WorkerRuntimeState = "created" | "starting" | "running" | "stopping" | "stopped";

export function createWorkerRuntime(handles: readonly WorkerHandle[]) {
  const names = handles.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new Error("worker names must be unique");
  let state: WorkerRuntimeState = "created";
  let started: WorkerHandle[] = [];

  return {
    async start() {
      if (state === "running") return;
      if (state !== "created") throw new Error(`cannot start worker runtime from ${state}`);
      state = "starting";
      try {
        for (const handle of handles) {
          await handle.start();
          started.push(handle);
        }
        state = "running";
      } catch (error) {
        for (const handle of [...started].reverse()) await handle.stop();
        started = [];
        state = "stopped";
        throw error;
      }
    },
    async stop() {
      if (state === "stopped") return;
      if (state !== "running") throw new Error(`cannot stop worker runtime from ${state}`);
      state = "stopping";
      for (const handle of [...started].reverse()) await handle.stop();
      started = [];
      state = "stopped";
    },
    snapshot() {
      return { state, workers: names } as const;
    },
  };
}
