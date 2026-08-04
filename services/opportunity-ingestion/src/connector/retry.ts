export type ConnectorFailureKind = "network" | "timeout" | "http" | "aborted" | "schema" | "policy";

export class ConnectorFetchError extends Error {
  readonly kind: ConnectorFailureKind;
  readonly status: number | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    kind: ConnectorFailureKind,
    message: string,
    options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ConnectorFetchError";
    this.kind = kind;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isRetryableConnectorError(error: unknown): error is ConnectorFetchError {
  if (!(error instanceof ConnectorFetchError)) return false;
  if (error.kind === "network" || error.kind === "timeout") return true;
  return (
    error.kind === "http" &&
    error.status !== undefined &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

export interface RetryOptions {
  maximumAttempts: number;
  sleep(milliseconds: number): Promise<void>;
  backoffMs(attempt: number): number;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  if (!Number.isInteger(options.maximumAttempts) || options.maximumAttempts < 1) {
    throw new Error("maximumAttempts must be a positive integer");
  }
  for (let attempt = 1; attempt <= options.maximumAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableConnectorError(error) || attempt === options.maximumAttempts) throw error;
      const delay =
        error.retryAfterSeconds === undefined
          ? options.backoffMs(attempt)
          : error.retryAfterSeconds * 1_000;
      await options.sleep(Math.max(0, delay));
    }
  }
  throw new Error("retry loop exhausted without a result");
}

export function boundedExponentialBackoff(
  attempt: number,
  jitter: (maximumExclusive: number) => number = () => 0,
): number {
  const base = Math.min(30_000, 250 * 2 ** Math.max(0, attempt - 1));
  const boundedJitter = Math.max(0, Math.min(base - 1, Math.floor(jitter(base))));
  return base + boundedJitter;
}
