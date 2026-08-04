import pino, { type Logger, type LoggerOptions } from "pino";

import { redactSensitive, serializeSafeError } from "@jovia/security";

import { getCorrelationId } from "./context.js";

export interface LoggerFactoryOptions {
  service: string;
  environment: string;
  level?: LoggerOptions["level"];
  destination?: pino.DestinationStream;
}

export function createLogger(options: LoggerFactoryOptions): Logger {
  return pino(
    {
      base: { service: options.service, environment: options.environment },
      level: options.level ?? "info",
      mixin: () => ({ correlationId: getCorrelationId() }),
      serializers: {
        err: serializeSafeError,
        error: serializeSafeError,
        request: (request: unknown) => redactSensitive(request),
      },
      redact: {
        paths: ["req.body", "request.body", "body"],
        censor: "[REDACTED]",
      },
    },
    options.destination,
  );
}
