const sensitiveKey =
  /(?:api[-_]?key|authorization|cookie|credential|password|secret|session|token)/iu;

export function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactSensitive(nested, seen),
    ]),
  );
}

export function serializeSafeError(error: unknown) {
  if (!(error instanceof Error)) return { name: "Error", message: "Unknown error" };
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}
