const SOURCE_CODES = new Set(["himalayas", "jovia-direct"]);
const EVENT_TYPES = new Set([
  "opportunity.discovered.v1",
  "opportunity.updated.v1",
  "opportunity.tombstoned.v1",
  "opportunity.expired.v1",
]);
const OUTBOX_OUTCOMES = new Set(["published", "retry", "dead_lettered"]);

export interface OperationalMetricSink {
  gauge(name: string, value: number, labels: Readonly<Record<string, string>>): void;
}

export class LoggerOperationalMetricSink implements OperationalMetricSink {
  constructor(
    private readonly logger: {
      info(bindings: Record<string, unknown>, message: string): unknown;
    },
  ) {}

  gauge(name: string, value: number, labels: Readonly<Record<string, string>>): void {
    this.logger.info({ metric: name, value, ...labels }, "Opportunity operational metric");
  }
}

export class BoundedConnectorMetrics {
  constructor(private readonly sink: OperationalMetricSink) {}

  increment(name: string, labels: Readonly<Record<string, string>>): void {
    this.observe(name, 1, labels);
  }

  observe(name: string, value: number, labels: Readonly<Record<string, string>>): void {
    const source = labels.source;
    if (source && !SOURCE_CODES.has(source)) throw new Error("unbounded source metric label");
    this.sink.gauge(name, value, labels);
  }
}

export class WorkerSourceEligibilityMetrics {
  constructor(private readonly sink: OperationalMetricSink) {}

  recordEligibilityDecision(sourceCode: string, eligible: boolean, reason: string): void {
    if (!SOURCE_CODES.has(sourceCode)) throw new Error("unbounded source metric label");
    this.sink.gauge("jovia_source_eligibility_total", 1, {
      source: sourceCode,
      outcome: eligible ? "eligible" : "denied",
      reason,
    });
  }
}

export class WorkerOutboxMetrics {
  constructor(private readonly sink: OperationalMetricSink) {}

  record(eventType: string, outcome: "published" | "retry" | "dead_lettered"): void {
    if (!EVENT_TYPES.has(eventType) || !OUTBOX_OUTCOMES.has(outcome)) {
      throw new Error("unbounded outbox metric label");
    }
    this.sink.gauge("jovia_outbox_dispatch_total", 1, { event_type: eventType, outcome });
  }
}

export interface OperationalMetricsQuery {
  operationalMetrics(now: Date): Promise<{
    sources: readonly {
      sourceCode: string;
      freshnessLagSeconds: number;
      tombstoneLagSeconds: number;
      quarantineCount: number;
      circuitState: "closed" | "open" | "half_open";
    }[];
    pendingOutbox: readonly { eventType: string; count: number }[];
  }>;
}

export class OpportunityOperationalMetricsJob {
  constructor(
    private readonly query: OperationalMetricsQuery,
    private readonly sink: OperationalMetricSink,
    private readonly clock: { now(): Date },
  ) {}

  async run(): Promise<void> {
    const snapshot = await this.query.operationalMetrics(this.clock.now());
    for (const source of snapshot.sources) {
      if (!SOURCE_CODES.has(source.sourceCode)) continue;
      const labels = { source: source.sourceCode };
      this.sink.gauge("jovia_source_freshness_lag_seconds", source.freshnessLagSeconds, labels);
      this.sink.gauge("jovia_source_tombstone_lag_seconds", source.tombstoneLagSeconds, labels);
      this.sink.gauge("jovia_source_quarantine_records", source.quarantineCount, labels);
      this.sink.gauge(`jovia_source_circuit_${source.circuitState}`, 1, labels);
    }
    for (const event of snapshot.pendingOutbox) {
      if (!EVENT_TYPES.has(event.eventType)) continue;
      this.sink.gauge("jovia_outbox_pending", event.count, { event_type: event.eventType });
    }
  }
}
