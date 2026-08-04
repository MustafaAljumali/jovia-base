import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<{ correlationId: string }>();

export function runWithCorrelationId<T>(correlationId: string, work: () => T): T {
  if (!correlationId.trim()) throw new Error("correlationId must not be empty");
  return storage.run({ correlationId }, work);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function enterCorrelationId(correlationId: string): void {
  if (!correlationId.trim()) throw new Error("correlationId must not be empty");
  storage.enterWith({ correlationId });
}
