import { z } from "zod";

const BooleanStringSchema = z.enum(["true", "false"]).transform((value) => value === "true");

const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().min(1).default("0.1.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const ApiEnvSchema = BaseEnvSchema.extend({
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url().optional(),
  REDIS_URL: z.url().optional(),
  RAW_PAYLOAD_BUCKET: z.string().min(3).optional(),
  RAW_PAYLOAD_REGION: z.string().min(1).optional(),
  RAW_PAYLOAD_ENDPOINT: z.url().optional(),
  RAW_PAYLOAD_APPROVED_ENDPOINT_HOSTS: z.string().optional(),
  API_RATE_LIMIT_REQUESTS: z.coerce.number().int().positive().default(120),
  API_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  for (const key of [
    "DATABASE_URL",
    "REDIS_URL",
    "RAW_PAYLOAD_BUCKET",
    "RAW_PAYLOAD_REGION",
  ] as const) {
    if (!value[key]) {
      context.addIssue({ code: "custom", path: [key], message: "required in production" });
    }
  }
});

const WorkerEnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  AI_GEMINI_ENABLED: BooleanStringSchema.default(false),
  AI_GEMINI_API_KEY: z.string().min(20).optional(),
  AI_GEMINI_MODEL: z.literal("gemini-3.6-flash").optional(),
}).superRefine((value, context) => {
  if (value.AI_GEMINI_ENABLED && !value.AI_GEMINI_API_KEY) {
    context.addIssue({
      code: "custom",
      path: ["AI_GEMINI_API_KEY"],
      message: "required when Gemini is enabled",
    });
  }
  if (value.AI_GEMINI_ENABLED && value.AI_GEMINI_MODEL !== "gemini-3.6-flash") {
    context.addIssue({
      code: "custom",
      path: ["AI_GEMINI_MODEL"],
      message: "must pin gemini-3.6-flash",
    });
  }
});

export type ApiConfig = ReturnType<typeof loadApiConfig>;
export type WorkerConfig = ReturnType<typeof loadWorkerConfig>;

export function loadApiConfig(environment: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const parsed = ApiEnvSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    environment: parsed.NODE_ENV,
    host: parsed.API_HOST,
    logLevel: parsed.LOG_LEVEL,
    port: parsed.API_PORT,
    rateLimit: {
      requests: parsed.API_RATE_LIMIT_REQUESTS,
      windowSeconds: parsed.API_RATE_LIMIT_WINDOW_SECONDS,
    },
    rawPayload: {
      approvedEndpointHosts: (parsed.RAW_PAYLOAD_APPROVED_ENDPOINT_HOSTS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      bucket: parsed.RAW_PAYLOAD_BUCKET,
      endpoint: parsed.RAW_PAYLOAD_ENDPOINT,
      region: parsed.RAW_PAYLOAD_REGION,
    },
    redisUrl: parsed.REDIS_URL,
    version: parsed.APP_VERSION,
  } as const;
}

export function loadWorkerConfig(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
) {
  const parsed = WorkerEnvSchema.parse(environment);
  return {
    databaseUrl: parsed.DATABASE_URL,
    environment: parsed.NODE_ENV,
    gemini: {
      apiKey: parsed.AI_GEMINI_API_KEY,
      enabled: parsed.AI_GEMINI_ENABLED,
      model: parsed.AI_GEMINI_MODEL,
    },
    logLevel: parsed.LOG_LEVEL,
    redisUrl: parsed.REDIS_URL,
    version: parsed.APP_VERSION,
  } as const;
}

export function toRedactedConfig(config: ApiConfig | WorkerConfig) {
  if ("gemini" in config) {
    return {
      ...config,
      databaseUrl: "[CONFIGURED]",
      gemini: {
        enabled: config.gemini.enabled,
        hasApiKey: Boolean(config.gemini.apiKey),
        model: config.gemini.model,
      },
      redisUrl: "[CONFIGURED]",
    };
  }
  return {
    ...config,
    databaseUrl: config.databaseUrl ? "[CONFIGURED]" : undefined,
    rawPayload: {
      ...config.rawPayload,
      endpoint: config.rawPayload.endpoint ? "[CONFIGURED]" : undefined,
    },
    redisUrl: config.redisUrl ? "[CONFIGURED]" : undefined,
  };
}
