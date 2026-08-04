export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  random?: (() => number) | undefined;
  sleep?: ((milliseconds: number) => Promise<void>) | undefined;
}

export async function withRetry<Result>(
  operation: (attempt: number) => Promise<Result>,
  shouldRetry: (error: unknown) => boolean,
  options: RetryOptions,
): Promise<Result> {
  const random = options.random ?? Math.random;
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === options.maxAttempts || !shouldRetry(error)) throw error;
      const delay = Math.floor(options.baseDelayMs * 2 ** (attempt - 1) * (0.5 + random() * 0.5));
      await sleep(delay);
    }
  }
  throw new Error("retry attempts exhausted");
}
