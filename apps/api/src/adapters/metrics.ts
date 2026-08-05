import type { FastifyBaseLogger } from "fastify";

import type { ApiMetricsPort } from "../plugins/metrics.js";

export class LoggerApiMetrics implements ApiMetricsPort {
  constructor(private readonly logger: FastifyBaseLogger) {}

  observe(input: { route: string; method: string; statusCode: number; durationMs: number }): void {
    this.logger.info(
      {
        metric: "jovia_api_request_duration_ms",
        route: input.route,
        method: input.method,
        statusCode: input.statusCode,
        value: input.durationMs,
      },
      "API request metric",
    );
  }
}

export class LoggerSourceEligibilityMetrics {
  constructor(private readonly logger: FastifyBaseLogger) {}

  recordEligibilityDecision(sourceCode: string, eligible: boolean, reason: string): void {
    this.logger.info(
      {
        metric: "jovia_source_eligibility_total",
        source: sourceCode,
        outcome: eligible ? "eligible" : "denied",
        reason,
        value: 1,
      },
      "Source eligibility metric",
    );
  }
}
